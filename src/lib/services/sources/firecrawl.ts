import Firecrawl from '@mendable/firecrawl-js'

export class FirecrawlRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FirecrawlRateLimitError'
  }
}

export class FirecrawlCreditsExhaustedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FirecrawlCreditsExhaustedError'
  }
}

function getFirecrawl() {
  return new Firecrawl({
    apiKey: process.env.FIRECRAWL_API_KEY || '',
  })
}

interface FirecrawlSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'reddit' | 'hackernews' | 'producthunt' | 'google_news' | 'twitter'
  createdAt: Date
  metadata: Record<string, any>
}

export async function scrapeUrl(url: string): Promise<{
  title: string
  content: string
  metadata: Record<string, any>
} | null> {
  try {
    const result = await getFirecrawl().scrape(url, {
      formats: ['markdown'],
    })

    if (!result.markdown) {
      return null
    }

    return {
      title: result.metadata?.title || 'Untitled',
      content: result.markdown,
      metadata: result.metadata || {},
    }
  } catch (error) {
    console.error('Firecrawl scrape error:', error)
    return null
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function searchWithFirecrawl(
  query: string,
  options?: {
    limit?: number
  }
): Promise<FirecrawlSearchResult[]> {
  const MAX_RETRIES = 2
  let lastError: any

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Firecrawl searching for: "${query}"${attempt > 0 ? ` (retry ${attempt})` : ''}`)
      const response = await getFirecrawl().search(query, {
        limit: options?.limit || 10,
        scrapeOptions: {
          formats: ['markdown'],
        },
      })

      // Debug: log raw response structure
      const responseAny = response as any
      console.log(`Firecrawl raw response type: ${typeof responseAny}`)
      console.log(`Firecrawl raw response keys: ${responseAny ? Object.keys(responseAny) : 'null'}`)

      // Handle different response formats
      let results: any[] = []
      if (Array.isArray(responseAny)) {
        results = responseAny
      } else if (responseAny && typeof responseAny === 'object') {
        // Firecrawl v1 returns { success: true, data: [...] }
        if (responseAny.data && Array.isArray(responseAny.data)) {
          results = responseAny.data
        } else if (responseAny.results && Array.isArray(responseAny.results)) {
          results = responseAny.results
        }
      }

      console.log(`Firecrawl parsed ${results.length} results for "${query}"`)

      if (results.length === 0) {
        return []
      }

      return results.map((item: any) => ({
        title: item.title || 'Untitled',
        content: item.markdown || item.description || item.content || '',
        url: item.url,
        author: extractAuthor(item.url),
        source: detectSource(item.url),
        createdAt: new Date(),
        metadata: {
          description: item.description,
          ...item.metadata,
        },
      }))
    } catch (error: any) {
      lastError = error

      if (error?.status === 402 || error?.message?.includes('Insufficient credits')) {
        console.error('Firecrawl credits exhausted')
        throw new FirecrawlCreditsExhaustedError('Firecrawl credits exhausted')
      }

      if (error?.status === 429 || error?.message?.includes('Rate limit')) {
        console.warn(`Firecrawl rate limit hit in search (attempt ${attempt + 1}/${MAX_RETRIES + 1})`)

        // On last attempt, throw to abort scan
        if (attempt === MAX_RETRIES) {
          throw new FirecrawlRateLimitError('Firecrawl rate limited after retries')
        }

        // Exponential backoff: 10s, 20s
        const backoffMs = 10000 * Math.pow(2, attempt)
        console.log(`Waiting ${backoffMs}ms before retry...`)
        await sleep(backoffMs)
        continue // Retry
      }

      // Non-rate-limit error, log and return empty
      console.error('Firecrawl search error:', error)
      return []
    }
  }

  // If we exhausted retries
  console.error('Firecrawl search failed after retries:', lastError)
  return []
}

export async function crawlWebsite(
  url: string,
  options?: {
    maxPages?: number
    includePaths?: string[]
    excludePaths?: string[]
  }
): Promise<Array<{ url: string; title: string; content: string }>> {
  try {
    const result = await getFirecrawl().crawl(url, {
      limit: options?.maxPages || 10,
      includePaths: options?.includePaths,
      excludePaths: options?.excludePaths,
      scrapeOptions: {
        formats: ['markdown'],
      },
    })

    if (!result || !Array.isArray(result)) {
      return []
    }

    return result.map((page: any) => ({
      url: page.url || url,
      title: page.metadata?.title || 'Untitled',
      content: page.markdown || '',
    }))
  } catch (error) {
    console.error('Firecrawl crawl error:', error)
    return []
  }
}

function detectSource(url: string): FirecrawlSearchResult['source'] {
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('news.ycombinator.com') || url.includes('hn.algolia.com')) return 'hackernews'
  if (url.includes('producthunt.com')) return 'producthunt'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  return 'google_news'
}

function extractAuthor(url: string): string {
  try {
    const urlObj = new URL(url)

    // Reddit author extraction
    if (url.includes('reddit.com')) {
      const match = url.match(/\/user\/([^\/]+)/)
      if (match) return match[1]
    }

    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}

// Convert phrase keywords to better search queries
// "any alternative to" -> alternative OR alternatives
// "I need a tool that" -> "need tool" OR "looking for tool"
function optimizeKeywordForSearch(keyword: string): string {
  const lower = keyword.toLowerCase()

  // Extract meaningful tokens (skip common words)
  const stopWords = new Set(['i', 'a', 'an', 'the', 'to', 'for', 'that', 'is', 'are', 'any', 'need', 'want', 'looking'])
  const tokens = lower
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopWords.has(t))

  // If we have meaningful tokens, use them
  if (tokens.length > 0) {
    return tokens.join(' ')
  }

  // Fallback to original
  return keyword
}

export async function searchRedditWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  const optimized = optimizeKeywordForSearch(keyword)
  console.log(`Reddit search: "${keyword}" -> "${optimized}"`)
  return searchWithFirecrawl(`site:reddit.com ${optimized}`, { limit: 5 }) // Reduced from 15
}

export async function searchHNWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  const optimized = optimizeKeywordForSearch(keyword)
  console.log(`HN search: "${keyword}" -> "${optimized}"`)
  return searchWithFirecrawl(`site:news.ycombinator.com ${optimized}`, { limit: 5 }) // Reduced from 15
}

export async function searchProductHuntWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  const optimized = optimizeKeywordForSearch(keyword)
  console.log(`ProductHunt search: "${keyword}" -> "${optimized}"`)
  return searchWithFirecrawl(`site:producthunt.com ${optimized}`, { limit: 3 }) // Reduced from 10
}

export async function searchNewsWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  const optimized = optimizeKeywordForSearch(keyword)
  console.log(`News search: "${keyword}" -> "${optimized}"`)
  return searchWithFirecrawl(optimized, { limit: 5 }) // Reduced from 15
}
