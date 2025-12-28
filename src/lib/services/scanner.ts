import { createClient } from '@supabase/supabase-js'
import { searchAllSources, type SearchResult } from './sources'
import { FirecrawlRateLimitError, FirecrawlCreditsExhaustedError } from './sources/firecrawl'
import { analyzeLeadDiscovery } from './llm'
import { sendEmailAlert, sendSlackAlert, sendDiscordAlert } from './alerts'
import type { Keyword, UserSettings } from '@/types/database'

// Create admin client for server-side operations
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(`Missing Supabase env vars: URL=${!!url}, KEY=${!!key}`)
  }

  return createClient(url, key)
}

const supabase = getSupabaseAdmin()

interface ScanResult {
  userId: string
  keywordId: string
  keyword: string
  matchesFound: number
  alertsSent: number
}

export async function scanKeywordsForUser(userId: string): Promise<ScanResult[]> {
  const startedAt = Date.now()
  const results: ScanResult[] = []

  // Create scan_runs entry for this user
  const { data: scanRun } = await supabase
    .from('scan_runs')
    .insert({ user_id: userId })
    .select()
    .single()

  // Get user's active keywords
  const { data: keywords, error: keywordsError } = await supabase
    .from('keywords')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (keywordsError || !keywords?.length) {
    if (scanRun) {
      await supabase.from('scan_runs').update({
        finished_at: new Date().toISOString(),
        keywords_scanned: 0,
        matches_found: 0,
        duration_ms: Date.now() - startedAt
      }).eq('id', scanRun.id)
    }
    return results
  }

  // Get user profile for plan and limit info
  const { data: profile } = await supabase
    .from('users')
    .select('plan, email, subscription_status')
    .eq('id', userId)
    .single()

  const userPlan = profile?.plan || 'free'
  const userEmail = profile?.email
  const subscriptionStatus = profile?.subscription_status || null

  // Get user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  let totalMatches = 0
  for (const keyword of keywords) {
    try {
      const result = await scanKeyword(keyword, settings, userEmail, userPlan, subscriptionStatus)
      results.push(result)
      totalMatches += result.matchesFound
    } catch (err) {
      console.error(`Error scanning keyword ${keyword.keyword}:`, err)
    }
  }

  // Finalize scan run
  if (scanRun) {
    await supabase.from('scan_runs').update({
      finished_at: new Date().toISOString(),
      keywords_scanned: keywords.length,
      matches_found: totalMatches,
      duration_ms: Date.now() - startedAt
    }).eq('id', scanRun.id)
  }

  return results
}

// Trial alert limits
const TRIAL_SLACK_DISCORD_LIMIT_PER_DAY = 10

async function getTrialAlertCountToday(userId: string, channel: 'slack' | 'discord'): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const { count } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', channel)
    .gte('sent_at', today.toISOString())
  
  return count || 0
}

async function canSendTrialAlert(
  userId: string, 
  channel: 'slack' | 'discord',
  subscriptionStatus: string | null
): Promise<{ allowed: boolean; remaining: number }> {
  // Paid users have unlimited alerts
  if (subscriptionStatus === 'active') {
    return { allowed: true, remaining: Infinity }
  }
  
  const countToday = await getTrialAlertCountToday(userId, channel)
  const remaining = Math.max(0, TRIAL_SLACK_DISCORD_LIMIT_PER_DAY - countToday)
  
  return {
    allowed: countToday < TRIAL_SLACK_DISCORD_LIMIT_PER_DAY,
    remaining
  }
}

async function scanKeyword(
  keyword: Keyword,
  settings: UserSettings | null,
  userEmail: string | undefined,
  plan: string = 'free',
  subscriptionStatus: string | null = null
): Promise<ScanResult> {
  const result: ScanResult = {
    userId: keyword.user_id,
    keywordId: keyword.id,
    keyword: keyword.keyword,
    matchesFound: 0,
    alertsSent: 0,
  }

  try {
    // Search all sources for this keyword
    console.log(`Scanning keyword: "${keyword.keyword}" (Plan: ${plan})`)
    const searchResults = await searchAllSources(keyword.keyword, plan)

    if (searchResults.length === 0) {
      return result
    }

    // Filter out already-seen URLs
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('url')
      .eq('keyword_id', keyword.id)

    const existingUrls = new Set(existingMatches?.map((m) => m.url) || [])
    const newResults = searchResults.filter((r) => !existingUrls.has(r.url))

    if (newResults.length === 0) {
      return result
    }

    // Filter out duplicates within the current search results
    const uniqueSearchResults = Array.from(
      new Map(newResults.map(item => [item.url, item])).values()
    )

    // Analyze and store new matches
    const newMatches = []
    const toInsert: any[] = []

    // Pro+ plans get advanced lead scoring
    const useAdvancedScoring = ['pro', 'business', 'enterprise'].includes(plan)
    
    for (const searchResult of uniqueSearchResults.slice(0, 10)) {
      try {
        const discovery = await analyzeLeadDiscovery(
          searchResult.title,
          searchResult.content,
          keyword.keyword,
          useAdvancedScoring
        )

        console.log(`[Scanner] Result "${searchResult.title.slice(0, 50)}..." scored ${discovery.score} (intent: ${discovery.intent})`)

        // Lower threshold to 20 to capture more potential leads
        if (discovery.score < 20) continue

        const bucket = discovery.score >= 70 ? 'hot' : 'warm'

        const matchData = {
          keyword_id: keyword.id,
          user_id: keyword.user_id,
          source: searchResult.source,
          title: searchResult.title,
          content: searchResult.content.slice(0, 5000),
          url: searchResult.url,
          author: searchResult.author,
          sentiment: discovery.intent === 'complaining' ? 'negative' : discovery.intent === 'buying' ? 'positive' : 'neutral',
          ai_summary: discovery.pain_summary,
          lead_score: discovery.score,
          lead_bucket: bucket,
          metadata: {
            intent: discovery.intent,
            why_it_matters: discovery.why_it_matters
          }
        }

        toInsert.push(matchData)
      } catch (err) {
        console.error(`Error analyzing search result ${searchResult.url}:`, err)
      }
    }

    if (toInsert.length > 0) {
      console.log(`[Scanner] Inserting ${toInsert.length} matches for keyword "${keyword.keyword}"`)
      const { data: insertedData, error: insertError } = await supabase
        .from('matches')
        .insert(toInsert)
        .select('*, keywords(keyword)')

      if (insertError) {
        console.error(`[Scanner] Insert error:`, insertError)
      }

      if (!insertError && insertedData) {
        console.log(`[Scanner] Successfully inserted ${insertedData.length} matches`)
        newMatches.push(...insertedData)
        result.matchesFound = insertedData.length
      }
    } else {
      console.log(`[Scanner] No matches passed threshold for keyword "${keyword.keyword}"`)
    }

    // Send alerts if enabled
    if (newMatches.length > 0 && settings) {
      // Email alerts - UNLIMITED for all users (trial + paid)
      if (settings.email_alerts && userEmail) {
        const sent = await sendEmailAlert(userEmail, newMatches)
        if (sent) await recordAlerts(newMatches, keyword.user_id, 'email', sent)
        result.alertsSent++
      }

      // Slack alerts - LIMITED for trial users (10/day), unlimited for paid
      if (settings.slack_webhook) {
        const slackCheck = await canSendTrialAlert(keyword.user_id, 'slack', subscriptionStatus)
        if (slackCheck.allowed) {
          const sent = await sendSlackAlert(settings.slack_webhook, newMatches)
          if (sent) await recordAlerts(newMatches, keyword.user_id, 'slack', sent)
          result.alertsSent++
        } else {
          console.log(`[Scanner] Slack alert limit reached for trial user ${keyword.user_id} (${slackCheck.remaining} remaining)`)
        }
      }

      // Discord alerts - LIMITED for trial users (10/day), unlimited for paid
      if (settings.discord_webhook) {
        const discordCheck = await canSendTrialAlert(keyword.user_id, 'discord', subscriptionStatus)
        if (discordCheck.allowed) {
          const sent = await sendDiscordAlert(settings.discord_webhook, newMatches)
          if (sent) await recordAlerts(newMatches, keyword.user_id, 'discord', sent)
          result.alertsSent++
        } else {
          console.log(`[Scanner] Discord alert limit reached for trial user ${keyword.user_id} (${discordCheck.remaining} remaining)`)
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning keyword "${keyword.keyword}":`, error)
  }

  return result
}

async function recordAlerts(
  matches: any[],
  userId: string,
  channel: 'email' | 'slack' | 'discord',
  success: boolean
) {
  const alerts = matches.map((match) => ({
    match_id: match.id,
    user_id: userId,
    channel,
    status: success ? 'sent' : 'failed',
  }))

  await supabase.from('alerts').insert(alerts)
}

// Delay between keywords to avoid rate limits (5 seconds)
const DELAY_BETWEEN_KEYWORDS_MS = 5000

/**
 * Full scan - scans ALL active keywords for PAID users only
 * Free/trial users can see existing data but no new scans run for them
 * Prioritizes business > pro > starter users
 */
export async function runFullScan(): Promise<{ 
  usersScanned: number
  totalMatches: number
  keywordsScanned: number
  duration: string
  errors: string[]
  skippedFreeUsers: number
}> {
  const scanStartTime = Date.now()
  const errors: string[] = []
  let totalMatches = 0
  let keywordsScanned = 0
  let skippedFreeUsers = 0

  console.log('[FullScan] Starting full scan of PAID users only...')

  // Get all users with active subscriptions (paid plans only)
  // Free users are skipped - they can see existing data but no new scans
  const { data: users } = await supabase
    .from('users')
    .select('id, plan, email, subscription_status')
    .in('plan', ['starter', 'pro', 'business', 'enterprise'])
    .order('plan', { ascending: false }) // business/enterprise first

  // Also get free users count for logging
  const { count: freeCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .or('plan.eq.free,plan.is.null')

  skippedFreeUsers = freeCount || 0

  if (!users?.length) {
    console.log(`[FullScan] No paid users found (${skippedFreeUsers} free users skipped)`)
    return { usersScanned: 0, totalMatches: 0, keywordsScanned: 0, duration: '0s', errors: [], skippedFreeUsers }
  }

  console.log(`[FullScan] Found ${users.length} paid users to scan (${skippedFreeUsers} free users skipped)`)

  // Process each paid user
  for (const user of users) {
    const userStartTime = Date.now()
    
    try {
      // Get user's active keywords
      const { data: keywords } = await supabase
        .from('keywords')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (!keywords?.length) {
        console.log(`[FullScan] User ${user.email} has no active keywords, skipping`)
        continue
      }

      console.log(`[FullScan] Scanning ${keywords.length} keywords for ${user.email} (${user.plan})`)

      // Get user settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      // Create scan run for this user
      const { data: scanRun } = await supabase
        .from('scan_runs')
        .insert({ user_id: user.id })
        .select()
        .single()

      let userMatches = 0

      // Scan each keyword for this user
      for (const keyword of keywords) {
        try {
          const result = await scanKeyword(keyword, settings, user.email, user.plan, user.subscription_status)
          userMatches += result.matchesFound
          keywordsScanned++

          // Update last_scanned timestamp
          await supabase
            .from('keywords')
            .update({ last_scanned: new Date().toISOString() })
            .eq('id', keyword.id)

          // Small delay between keywords to avoid rate limits
          if (keywords.indexOf(keyword) < keywords.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_KEYWORDS_MS))
          }
        } catch (err: any) {
          const errorMsg = `Error scanning keyword "${keyword.keyword}": ${err.message}`
          console.error(`[FullScan] ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      totalMatches += userMatches

      // Finalize scan run
      if (scanRun) {
        await supabase.from('scan_runs').update({
          finished_at: new Date().toISOString(),
          keywords_scanned: keywords.length,
          matches_found: userMatches,
          duration_ms: Date.now() - userStartTime
        }).eq('id', scanRun.id)
      }

      console.log(`[FullScan] Completed ${user.email}: ${userMatches} matches from ${keywords.length} keywords`)

    } catch (err: any) {
      const errorMsg = `Error scanning user ${user.email}: ${err.message}`
      console.error(`[FullScan] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  const duration = `${((Date.now() - scanStartTime) / 1000).toFixed(1)}s`
  console.log(`[FullScan] Complete! ${keywordsScanned} keywords, ${totalMatches} matches, ${duration}`)

  return { 
    usersScanned: users.length, 
    totalMatches, 
    keywordsScanned,
    duration,
    errors,
    skippedFreeUsers
  }
}
