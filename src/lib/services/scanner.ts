import { createClient } from '@supabase/supabase-js'
import { searchAllSources, type SearchResult } from './sources'
import { FirecrawlRateLimitError, FirecrawlCreditsExhaustedError } from './sources/firecrawl'
import { analyzeMatch } from './ai'
import { sendEmailAlert, sendSlackAlert, sendDiscordAlert } from './alerts'
import type { Keyword, UserSettings } from '@/types/database'

// Create admin client for server-side operations
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log(`Supabase URL exists: ${!!url}`)
  console.log(`Supabase Service Role Key exists: ${!!key}`)

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
  const results: ScanResult[] = []

  // Get user's active keywords
  const { data: keywords, error: keywordsError } = await supabase
    .from('keywords')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (keywordsError || !keywords?.length) {
    console.log(`No active keywords for user ${userId}`)
    return results
  }

  // Get user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get user email
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  for (const keyword of keywords) {
    const result = await scanKeyword(keyword, settings, user?.email)
    results.push(result)
  }

  return results
}

async function scanKeyword(
  keyword: Keyword,
  settings: UserSettings | null,
  userEmail: string | undefined
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
    console.log(`Scanning keyword: "${keyword.keyword}"`)
    const searchResults = await searchAllSources(keyword.keyword)

    console.log(`Firecrawl returned ${searchResults.length} results for "${keyword.keyword}"`)

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

    console.log(`New results after filtering existing: ${newResults.length}`)

    if (newResults.length === 0) {
      return result
    }

    // Analyze and store new matches
    const newMatches = []
    for (const searchResult of newResults.slice(0, 20)) { // Limit to 20 per scan
      const analysis = await analyzeMatch(
        searchResult.title,
        searchResult.content,
        keyword.keyword
      )

      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          keyword_id: keyword.id,
          user_id: keyword.user_id,
          source: searchResult.source,
          title: searchResult.title,
          content: searchResult.content.slice(0, 5000),
          url: searchResult.url,
          author: searchResult.author,
          sentiment: analysis.sentiment,
          ai_summary: analysis.summary,
          lead_score: analysis.leadScore,
        })
        .select('*, keywords(keyword)')
        .single()

      if (!error && match) {
        newMatches.push(match)
        result.matchesFound++
      }
    }

    // Send alerts if enabled
    if (newMatches.length > 0 && settings) {
      // Email alerts
      if (settings.email_alerts && userEmail) {
        const sent = await sendEmailAlert(userEmail, newMatches)
        if (sent) {
          await recordAlerts(newMatches, keyword.user_id, 'email', sent)
          result.alertsSent++
        }
      }

      // Slack alerts
      if (settings.slack_webhook) {
        const sent = await sendSlackAlert(settings.slack_webhook, newMatches)
        if (sent) {
          await recordAlerts(newMatches, keyword.user_id, 'slack', sent)
          result.alertsSent++
        }
      }

      // Discord alerts
      if (settings.discord_webhook) {
        const sent = await sendDiscordAlert(settings.discord_webhook, newMatches)
        if (sent) {
          await recordAlerts(newMatches, keyword.user_id, 'discord', sent)
          result.alertsSent++
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

// Rate limiting: max keywords to scan per cron run to avoid Firecrawl limits
// Firecrawl free tier: 20 req/min = 1 request every 3 seconds
// Each keyword hits 4 sources (Reddit, HN, PH, News)
const MAX_KEYWORDS_PER_RUN = 2 // Reduced from 3 to be safe
const DELAY_BETWEEN_KEYWORDS_MS = 15000 // 15 seconds between keywords (was 5s)

export async function runFullScan(): Promise<{ usersScanned: number; totalMatches: number; keywordsScanned: number }> {
  const startedAt = Date.now()
  let usersScanned = 0
  let totalMatches = 0
  let keywordsScanned = 0

  // Register scan run
  const { data: scanRun, error: scanRunError } = await supabase
    .from('scan_runs')
    .insert({})
    .select()
    .single()

  if (scanRunError) {
    console.error('Failed to create scan run entry:', scanRunError)
  }

  const scanRunId = scanRun?.id

  // Get all users with active keywords
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, scan_interval_minutes, plan')

  console.log(`Found ${users?.length || 0} users, error: ${usersError?.message || 'none'}`)

  if (!users?.length) {
    console.log('No users found in database')
    return { usersScanned: 0, totalMatches: 0, keywordsScanned: 0 }
  }

  // Get all active keywords across all users
  const { data: allKeywords, error: keywordsError } = await supabase
    .from('keywords')
    .select('*')
    .eq('is_active', true)
    .order('last_scanned', { ascending: true, nullsFirst: true })
    .limit(MAX_KEYWORDS_PER_RUN)

  console.log(`Found ${allKeywords?.length || 0} active keywords, error: ${keywordsError?.message || 'none'}`)

  if (!allKeywords?.length) {
    console.log('No active keywords to scan')
    return { usersScanned: 0, totalMatches: 0, keywordsScanned: 0 }
  }

  const userIds = new Set<string>()

  for (const keyword of allKeywords) {
    try {
      // Get user settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', keyword.user_id)
        .single()

      // Get user email
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', keyword.user_id)
        .single()

      const result = await scanKeyword(keyword, settings, user?.email)
      totalMatches += result.matchesFound
      keywordsScanned++
      userIds.add(keyword.user_id)

      // Update last_scanned timestamp AFTER processing
      await supabase
        .from('keywords')
        .update({ last_scanned: new Date().toISOString() })
        .eq('id', keyword.id)

      // Delay between keywords to respect rate limits
      if (keywordsScanned < allKeywords.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_KEYWORDS_MS))
      }
    } catch (error: any) {
      if (error instanceof FirecrawlCreditsExhaustedError || error?.status === 402) {
        console.warn(`Credits exhausted during "${keyword.keyword}", stopping full scan`)

        // Log abort status
        if (scanRunId) {
          await supabase
            .from('scan_runs')
            .update({
              aborted: true,
              error: 'insufficient_credits',
              finished_at: new Date().toISOString(),
              keywords_scanned: keywordsScanned,
              matches_found: totalMatches,
              duration_ms: Date.now() - startedAt,
            })
            .eq('id', scanRunId)
        }
        break
      }

      if (error instanceof FirecrawlRateLimitError || error?.status === 429) {
        console.warn(`Rate limited during "${keyword.keyword}", stopping full scan to save quota`)

        // Log abort status
        if (scanRunId) {
          await supabase
            .from('scan_runs')
            .update({
              aborted: true,
              error: 'rate_limited',
              finished_at: new Date().toISOString(),
              keywords_scanned: keywordsScanned,
              matches_found: totalMatches,
              duration_ms: Date.now() - startedAt,
            })
            .eq('id', scanRunId)
        }
        break
      }
      console.error(`Error scanning keyword "${keyword.keyword}":`, error)
    }
  }

  usersScanned = userIds.size

  // Log successful completion
  if (scanRunId) {
    await supabase
      .from('scan_runs')
      .update({
        finished_at: new Date().toISOString(),
        keywords_scanned: keywordsScanned,
        matches_found: totalMatches,
        duration_ms: Date.now() - startedAt,
      })
      .eq('id', scanRunId)
  }

  return { usersScanned, totalMatches, keywordsScanned }
}
