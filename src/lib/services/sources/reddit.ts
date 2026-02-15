interface RedditPost {
  title: string
  selftext: string
  url: string
  author: string
  subreddit: string
  created_utc: number
  permalink: string
  score: number
  num_comments: number
}

interface RedditSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'reddit'
  createdAt: Date
  metadata: {
    subreddit: string
    score: number
    comments: number
  }
}

export async function searchReddit(keyword: string, limit: number = 25): Promise<RedditSearchResult[]> {
  const encodedKeyword = encodeURIComponent(keyword)

  // Strategy 1: old.reddit.com JSON (most reliable)
  const jsonResult = await tryRedditJson(encodedKeyword, limit)
  if (jsonResult.length > 0) return jsonResult

  // Strategy 2: Reddit RSS feed (harder to block)
  const rssResult = await tryRedditRss(encodedKeyword)
  if (rssResult.length > 0) return rssResult

  console.warn('[Reddit] All strategies failed for keyword:', keyword)
  return []
}

async function tryRedditJson(encodedKeyword: string, limit: number): Promise<RedditSearchResult[]> {
  const urls = [
    `https://old.reddit.com/search.json?q=${encodedKeyword}&sort=new&limit=${limit}&t=week`,
    `https://www.reddit.com/search.json?q=${encodedKeyword}&sort=new&limit=${limit}&t=week`,
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(`[Reddit] JSON API error (${url}):`, response.status)
        continue
      }

      const data = await response.json()
      const posts: RedditPost[] = data.data?.children?.map((child: any) => child.data) || []

      if (posts.length === 0) continue

      console.log(`[Reddit] Found ${posts.length} posts via JSON`)
      return posts.map(mapRedditPost)
    } catch (error) {
      console.error(`[Reddit] JSON fetch error (${url}):`, error)
    }
  }
  return []
}

async function tryRedditRss(encodedKeyword: string): Promise<RedditSearchResult[]> {
  try {
    const response = await fetch(
      `https://www.reddit.com/search.rss?q=${encodedKeyword}&sort=new&t=week`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      }
    )

    if (!response.ok) {
      console.error('[Reddit] RSS error:', response.status)
      return []
    }

    const xml = await response.text()
    const entries = parseRedditRss(xml)
    console.log(`[Reddit] Found ${entries.length} posts via RSS`)
    return entries
  } catch (error) {
    console.error('[Reddit] RSS fetch error:', error)
    return []
  }
}

function mapRedditPost(post: RedditPost): RedditSearchResult {
  return {
    title: post.title,
    content: post.selftext || post.title,
    url: `https://reddit.com${post.permalink}`,
    author: post.author,
    source: 'reddit' as const,
    createdAt: new Date(post.created_utc * 1000),
    metadata: {
      subreddit: post.subreddit,
      score: post.score,
      comments: post.num_comments,
    },
  }
}

function parseRedditRss(xml: string): RedditSearchResult[] {
  const results: RedditSearchResult[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]
    const title = extractXmlTag(entry, 'title') || 'Untitled'
    const link = entry.match(/<link\s+href="([^"]+)"/)?.[1] || ''
    const author = extractXmlTag(entry, 'name') || 'Unknown'
    const updated = extractXmlTag(entry, 'updated') || new Date().toISOString()
    const content = extractXmlTag(entry, 'content') || title

    if (link) {
      results.push({
        title: decodeHtmlEntities(title),
        content: decodeHtmlEntities(content).replace(/<[^>]+>/g, '').slice(0, 2000),
        url: link,
        author,
        source: 'reddit' as const,
        createdAt: new Date(updated),
        metadata: {
          subreddit: link.match(/\/r\/([^/]+)/)?.[1] || 'unknown',
          score: 0,
          comments: 0,
        },
      })
    }
  }

  return results.slice(0, 25)
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = regex.exec(xml)
  return match ? (match[1] || match[2] || '').trim() : ''
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  }
  return text.replace(/&[^;]+;/g, (e) => entities[e] || e)
}

export async function searchSubreddit(
  subreddit: string,
  keyword: string,
  limit: number = 25
): Promise<RedditSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/search.json?q=${encodedKeyword}&restrict_sr=1&sort=new&limit=${limit}&t=day`,
      {
        headers: {
          'User-Agent': 'KeywordSentinel/1.0',
        },
      }
    )

    if (!response.ok) {
      console.error('Reddit API error:', response.status)
      return []
    }

    const data = await response.json()
    const posts: RedditPost[] = data.data?.children?.map((child: any) => child.data) || []

    return posts.map((post) => ({
      title: post.title,
      content: post.selftext || post.title,
      url: `https://reddit.com${post.permalink}`,
      author: post.author,
      source: 'reddit' as const,
      createdAt: new Date(post.created_utc * 1000),
      metadata: {
        subreddit: post.subreddit,
        score: post.score,
        comments: post.num_comments,
      },
    }))
  } catch (error) {
    console.error('Error searching subreddit:', error)
    return []
  }
}
