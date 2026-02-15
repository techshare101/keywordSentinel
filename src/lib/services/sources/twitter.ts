interface TwitterSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'twitter'
  createdAt: Date
  metadata: {
    likes: number
    retweets: number
    replies: number
    tweetId: string
  }
}

/**
 * Search Twitter/X using the free FxTwitter API (api.fxtwitter.com)
 * 
 * FxTwitter is a free, open-source API that provides tweet data without
 * requiring Twitter API keys. It works by proxying Twitter's embed data.
 * 
 * Limitations:
 * - No direct search endpoint — we use Nitter RSS as the search layer
 *   and FxTwitter for enrichment
 * - Rate limits are generous but undocumented
 */
export async function searchTwitter(keyword: string, limit: number = 25): Promise<TwitterSearchResult[]> {
  // Strategy 1: Use Nitter RSS instances for search
  const nitterResults = await tryNitterSearch(keyword, limit)
  if (nitterResults.length > 0) return nitterResults

  // Strategy 2: Use Syndication API (Twitter's public embed endpoint)
  const syndicationResults = await trySyndicationSearch(keyword, limit)
  if (syndicationResults.length > 0) return syndicationResults

  console.warn('[Twitter] All strategies failed for keyword:', keyword)
  return []
}

/**
 * Search via Nitter RSS instances (multiple fallbacks)
 */
async function tryNitterSearch(keyword: string, limit: number): Promise<TwitterSearchResult[]> {
  const encodedKeyword = encodeURIComponent(keyword)
  
  // Multiple Nitter instances for redundancy
  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.woodland.cafe',
  ]

  for (const instance of nitterInstances) {
    try {
      const response = await fetch(
        `${instance}/search/rss?f=tweets&q=${encodedKeyword}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
          signal: AbortSignal.timeout(10000),
        }
      )

      if (!response.ok) {
        console.log(`[Twitter] Nitter instance ${instance} returned ${response.status}`)
        continue
      }

      const xml = await response.text()
      const results = parseNitterRss(xml)

      if (results.length > 0) {
        console.log(`[Twitter] Found ${results.length} tweets via Nitter (${instance})`)
        return results.slice(0, limit)
      }
    } catch (error) {
      console.log(`[Twitter] Nitter instance ${instance} failed:`, (error as Error).message)
    }
  }

  return []
}

/**
 * Parse Nitter RSS feed into tweet results
 */
function parseNitterRss(xml: string): TwitterSearchResult[] {
  const results: TwitterSearchResult[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, 'title') || ''
    const link = extractTag(item, 'link') || ''
    const description = extractTag(item, 'description') || ''
    const pubDate = extractTag(item, 'pubDate') || new Date().toISOString()
    const creator = extractTag(item, 'dc:creator') || extractAuthorFromLink(link)

    // Convert Nitter link to real Twitter link
    const twitterUrl = convertToTwitterUrl(link)
    const tweetId = extractTweetId(twitterUrl)

    if (twitterUrl && title) {
      results.push({
        title: decodeEntities(title).slice(0, 200),
        content: decodeEntities(description).replace(/<[^>]+>/g, '').slice(0, 2000),
        url: twitterUrl,
        author: creator,
        source: 'twitter' as const,
        createdAt: new Date(pubDate),
        metadata: {
          likes: 0,
          retweets: 0,
          replies: 0,
          tweetId: tweetId || '',
        },
      })
    }
  }

  return results
}

/**
 * Enrich a tweet with data from FxTwitter API
 * Can be called on individual tweets to get engagement metrics
 */
export async function enrichTweetWithFxTwitter(tweetUrl: string): Promise<{
  likes: number
  retweets: number
  replies: number
  text: string
  author: string
  authorDisplayName: string
} | null> {
  try {
    // Extract username and tweet ID from URL
    const urlMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/)
    if (!urlMatch) return null

    const [, username, tweetId] = urlMatch

    const response = await fetch(
      `https://api.fxtwitter.com/${username}/status/${tweetId}`,
      {
        headers: {
          'User-Agent': 'KeywordSentinel/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!response.ok) {
      console.error('[FxTwitter] API error:', response.status)
      return null
    }

    const data = await response.json()
    const tweet = data.tweet

    if (!tweet) return null

    return {
      likes: tweet.likes || 0,
      retweets: tweet.retweets || 0,
      replies: tweet.replies || 0,
      text: tweet.text || '',
      author: tweet.author?.screen_name || username,
      authorDisplayName: tweet.author?.name || username,
    }
  } catch (error) {
    console.error('[FxTwitter] Error enriching tweet:', error)
    return null
  }
}

/**
 * Fallback: Use Twitter's public syndication/embed API
 */
async function trySyndicationSearch(keyword: string, limit: number): Promise<TwitterSearchResult[]> {
  try {
    // Twitter syndication timeline search (public, no auth needed)
    const encodedKeyword = encodeURIComponent(keyword)
    const response = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/search?query=${encodedKeyword}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!response.ok) {
      console.log('[Twitter] Syndication search returned', response.status)
      return []
    }

    // This endpoint returns HTML with embedded tweet data
    // For now, return empty — the Nitter strategy is more reliable
    return []
  } catch (error) {
    console.log('[Twitter] Syndication search failed:', (error as Error).message)
    return []
  }
}

function convertToTwitterUrl(nitterUrl: string): string {
  // Convert nitter.instance.com/user/status/123 to twitter.com/user/status/123
  try {
    const url = new URL(nitterUrl)
    return `https://twitter.com${url.pathname}`
  } catch {
    // If it's already a twitter URL or relative path
    if (nitterUrl.includes('twitter.com') || nitterUrl.includes('x.com')) {
      return nitterUrl
    }
    return nitterUrl.replace(/https?:\/\/[^/]+/, 'https://twitter.com')
  }
}

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/)
  return match ? match[1] : null
}

function extractAuthorFromLink(link: string): string {
  const match = link.match(/\/([^/]+)\/status\//)
  return match ? `@${match[1]}` : 'Unknown'
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = regex.exec(xml)
  return match ? (match[1] || match[2] || '').trim() : ''
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  }
  return text.replace(/&[^;]+;/g, (e) => entities[e] || e)
}
