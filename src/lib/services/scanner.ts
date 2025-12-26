import { createClient } from '@supabase/supabase-js'
import { searchAllSources, type SearchResult } from './sources'
import { analyzeMatch } from './ai'
import { sendEmailAlert, sendSlackAlert, sendDiscordAlert } from './alerts'
import type { Keyword, UserSettings } from '@/types/database'

// Create admin client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const searchResults = await searchAllSources(keyword.keyword)
    
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

export async function runFullScan(): Promise<{ usersScanned: number; totalMatches: number }> {
  let usersScanned = 0
  let totalMatches = 0

  // Get all users with active keywords
  const { data: users } = await supabase
    .from('users')
    .select('id, scan_interval_minutes')

  if (!users?.length) {
    return { usersScanned: 0, totalMatches: 0 }
  }

  for (const user of users) {
    const results = await scanKeywordsForUser(user.id)
    usersScanned++
    totalMatches += results.reduce((sum, r) => sum + r.matchesFound, 0)
  }

  return { usersScanned, totalMatches }
}
