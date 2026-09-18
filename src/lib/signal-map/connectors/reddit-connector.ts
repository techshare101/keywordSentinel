/**
 * Reddit Connector — Discussion Venues
 * 
 * Searches Reddit for discussions related to the ICP and returns
 * subreddit activity metrics, top posts, and engagement patterns.
 * 
 * Uses the public Reddit JSON API (no auth required for public subs).
 */

import type { 
  SignalConnector, 
  SignalConnectorInput, 
  SignalConnectorResult,
  DiscussionVenue 
} from '@/types/signal-map'
import { extractSearchQuery } from '../utils'

const REDDIT_HEADERS = {
  'User-Agent': 'KeywordSentinel/1.0 (ICP Signal Map)',
}

interface RedditPost {
  title: string
  permalink: string
  score: number
  num_comments: number
  created_utc: number
  subreddit: string
}

export class RedditConnector implements SignalConnector {
  id = 'reddit-discussion-venues'
  name = 'Reddit Discussion Venues'
  section_type = 'discussion_venues' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { icp_description, seed_domains, report_id } = input
    const sources: SignalConnectorResult['sources'] = []
    const raw_fetches: SignalConnectorResult['raw_fetches'] = []

    // Extract key terms from ICP description
    const searchTerms = this.extractSearchTerms(icp_description)
    if (searchTerms.length === 0) {
      return {
        section_type: this.section_type,
        status: 'no_data',
        data: { venues: [] },
        sources: [],
        raw_fetches: [],
        error_message: 'Could not extract search terms from ICP description'
      }
    }

    // Search Reddit for each term
    const subredditData = new Map<string, RedditPost[]>()

    for (const term of searchTerms.slice(0, 5)) {
      const startTime = Date.now()
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=relevance&t=month&limit=25`
      
      try {
        const response = await fetch(url, { headers: REDDIT_HEADERS })
        const latency_ms = Date.now() - startTime
        
        raw_fetches.push({
          report_id,
          connector_id: this.id,
          source: 'reddit',
          request_url: url,
          request_params: { q: term },
          response_body: null, // Don't store full response to save space
          response_status: response.status,
          latency_ms,
        })

        if (response.ok) {
          const data = await response.json()
          const posts: RedditPost[] = data?.data?.children?.map((c: any) => c.data) || []
          
          // Aggregate by subreddit
          for (const post of posts) {
            const sub = post.subreddit.toLowerCase()
            if (!subredditData.has(sub)) {
              subredditData.set(sub, [])
            }
            subredditData.get(sub)!.push(post)
          }
        }

        sources.push({
          source: 'reddit',
          url: `https://reddit.com/search?q=${encodeURIComponent(term)}`,
          description: `Reddit search for "${term}"`,
          fetched_at: new Date().toISOString(),
        })

        // Rate limit: 2 requests per second
        await new Promise(r => setTimeout(r, 500))
      } catch (error) {
        raw_fetches.push({
          report_id,
          connector_id: this.id,
          source: 'reddit',
          request_url: url,
          request_params: { q: term },
          response_body: { error: String(error) },
          response_status: 0,
          latency_ms: Date.now() - startTime,
        })
      }
    }

    // Build venue list
    const venues: DiscussionVenue[] = []
    for (const [subreddit, posts] of subredditData) {
      if (posts.length < 2) continue // Skip low-activity subs
      
      venues.push({
        subreddit,
        post_count: posts.length,
        avg_score: Math.round(posts.reduce((sum, p) => sum + p.score, 0) / posts.length),
        avg_comments: Math.round(posts.reduce((sum, p) => sum + p.num_comments, 0) / posts.length),
        top_posts: posts
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(p => ({
            title: p.title,
            url: `https://reddit.com${p.permalink}`,
            score: p.score,
            created_utc: new Date(p.created_utc * 1000).toISOString(),
          })),
        date_range: {
          from: new Date(Math.min(...posts.map(p => p.created_utc)) * 1000).toISOString(),
          to: new Date(Math.max(...posts.map(p => p.created_utc)) * 1000).toISOString(),
        }
      })
    }

    // Sort by post count
    venues.sort((a, b) => b.post_count - a.post_count)

    return {
      section_type: this.section_type,
      status: venues.length > 0 ? 'completed' : 'no_data',
      data: { venues: venues.slice(0, 15) },
      sources,
      raw_fetches,
    }
  }

  private extractSearchTerms(description: string): string[] {
    const query = extractSearchQuery(description, 100)
    if (!query) return []

    // Split on commas and common separators
    const terms = query
      .toLowerCase()
      .split(/[,\n]/)
      .map(t => t.trim())
      .filter(t => t.length > 3 && t.length < 100)
      .slice(0, 5)

    // Also extract 2-3 word phrases from the query
    const words = query.toLowerCase().split(/\s+/)
    const phrases: string[] = []
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      if (phrase.length > 5 && !['the a', 'is a', 'of the', 'in the', 'to the'].includes(phrase)) {
        phrases.push(phrase)
      }
    }

    return [...new Set([query, ...terms, ...phrases.slice(0, 3)])]
  }
}
