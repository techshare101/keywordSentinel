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
    .select('plan, email')
    .eq('id', userId)
    .single()

  const userPlan = profile?.plan || 'free'
  const userEmail = profile?.email

  // Get user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  let totalMatches = 0
  for (const keyword of keywords) {
    try {
      const result = await scanKeyword(keyword, settings, userEmail, userPlan)
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

async function scanKeyword(
  keyword: Keyword,
  settings: UserSettings | null,
  userEmail: string | undefined,
  plan: string = 'free'
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

    for (const searchResult of uniqueSearchResults.slice(0, 10)) {
      try {
        const discovery = await analyzeLeadDiscovery(
          searchResult.title,
          searchResult.content,
          keyword.keyword
        )

        if (discovery.score < 40) continue

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
      const { data: insertedData, error: insertError } = await supabase
        .from('matches')
        .insert(toInsert)
        .select('*, keywords(keyword)')

      if (!insertError && insertedData) {
        newMatches.push(...insertedData)
        result.matchesFound = insertedData.length
      }
    }

    // Send alerts if enabled
    if (newMatches.length > 0 && settings) {
      if (settings.email_alerts && userEmail) {
        const sent = await sendEmailAlert(userEmail, newMatches)
        if (sent) await recordAlerts(newMatches, keyword.user_id, 'email', sent)
        result.alertsSent++
      }

      if (settings.slack_webhook) {
        const sent = await sendSlackAlert(settings.slack_webhook, newMatches)
        if (sent) await recordAlerts(newMatches, keyword.user_id, 'slack', sent)
        result.alertsSent++
      }

      if (settings.discord_webhook) {
        const sent = await sendDiscordAlert(settings.discord_webhook, newMatches)
        if (sent) await recordAlerts(newMatches, keyword.user_id, 'discord', sent)
        result.alertsSent++
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

const MAX_KEYWORDS_PER_RUN = 2
const DELAY_BETWEEN_KEYWORDS_MS = 15000

export async function runFullScan(): Promise<{ usersScanned: number; totalMatches: number; keywordsScanned: number }> {
  let usersScanned = 0
  let totalMatches = 0
  let keywordsScanned = 0

  const { data: users } = await supabase.from('users').select('id, plan')
  if (!users?.length) return { usersScanned: 0, totalMatches: 0, keywordsScanned: 0 }

  const { data: allKeywords } = await supabase
    .from('keywords')
    .select('*')
    .eq('is_active', true)
    .order('last_scanned', { ascending: true, nullsFirst: true })
    .limit(MAX_KEYWORDS_PER_RUN)

  if (!allKeywords?.length) return { usersScanned: 0, totalMatches: 0, keywordsScanned: 0 }

  const userIds = new Set<string>()

  for (const keyword of allKeywords) {
    const startedAt = Date.now()
    try {
      const { data: scanRun } = await supabase
        .from('scan_runs')
        .insert({ user_id: keyword.user_id })
        .select()
        .single()

      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', keyword.user_id)
        .single()

      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', keyword.user_id)
        .single()

      const userPlan = users?.find(u => u.id === keyword.user_id)?.plan || 'free'
      const result = await scanKeyword(keyword, settings, user?.email, userPlan)

      totalMatches += result.matchesFound
      keywordsScanned++
      userIds.add(keyword.user_id)

      await supabase
        .from('keywords')
        .update({ last_scanned: new Date().toISOString() })
        .eq('id', keyword.id)

      if (scanRun) {
        await supabase.from('scan_runs').update({
          finished_at: new Date().toISOString(),
          keywords_scanned: 1,
          matches_found: result.matchesFound,
          duration_ms: Date.now() - startedAt
        }).eq('id', scanRun.id)
      }

      if (keywordsScanned < allKeywords.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_KEYWORDS_MS))
      }
    } catch (error: any) {
      console.error(`Error scanning keyword "${keyword.keyword}":`, error)
    }
  }

  usersScanned = userIds.size
  return { usersScanned, totalMatches, keywordsScanned }
}
