import Firecrawl from '@mendable/firecrawl-js'

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
})

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
    const result = await firecrawl.scrape(url, {
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

export async function searchWithFirecrawl(
  query: string,
  options?: {
    limit?: number
  }
): Promise<FirecrawlSearchResult[]> {
  try {
    const results = await firecrawl.search(query, {
      limit: options?.limit || 10,
      scrapeOptions: {
        formats: ['markdown'],
      },
    })

    if (!results || !Array.isArray(results)) {
      return []
    }

    return results.map((item: any) => ({
      title: item.title || 'Untitled',
      content: item.markdown || item.description || '',
      url: item.url,
      author: extractAuthor(item.url),
      source: detectSource(item.url),
      createdAt: new Date(),
      metadata: {
        description: item.description,
        ...item.metadata,
      },
    }))
  } catch (error) {
    console.error('Firecrawl search error:', error)
    return []
  }
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
    const result = await firecrawl.crawl(url, {
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

export async function searchRedditWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  return searchWithFirecrawl(`site:reddit.com ${keyword}`, { limit: 15 })
}

export async function searchHNWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  return searchWithFirecrawl(`site:news.ycombinator.com ${keyword}`, { limit: 15 })
}

export async function searchProductHuntWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  return searchWithFirecrawl(`site:producthunt.com ${keyword}`, { limit: 10 })
}

export async function searchNewsWithFirecrawl(keyword: string): Promise<FirecrawlSearchResult[]> {
  return searchWithFirecrawl(keyword, { limit: 15 })
}
