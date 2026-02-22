/**
 * TypeScript client for the Crawl4AI microservice.
 * 
 * Used as a fallback when direct API calls to sources fail.
 * The crawler service must be running and CRAWL4AI_SERVICE_URL must be set.
 * 
 * If the service is not configured, all methods return empty results gracefully.
 */

import type { SearchResult } from './index'
import type { SourceType } from '@/types/database'

const CRAWLER_URL = process.env.CRAWL4AI_SERVICE_URL || ''
const CRAWLER_TIMEOUT = 35000 // 35s — crawler needs time for headless browser

interface CrawlerSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: string
  created_at: string
  metadata: Record<string, any>
}

interface CrawlerSearchResponse {
  success: boolean
  source: string
  keyword: string
  results: CrawlerSearchResult[]
  count: number
  error?: string
}

interface CrawlerCrawlResponse {
  success: boolean
  url: string
  title: string
  markdown: string
  links: { href: string; text: string; type: string }[]
  error?: string
}

/**
 * Check if the crawler service is configured and available.
 */
export function isCrawlerAvailable(): boolean {
  return CRAWLER_URL.length > 0
}

/**
 * Search a source via the Crawl4AI service.
 * Returns empty array if service is not configured or fails.
 */
export async function crawlerSearch(
  source: SourceType,
  keyword: string,
  limit: number = 25
): Promise<SearchResult[]> {
  if (!isCrawlerAvailable()) return []

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CRAWLER_TIMEOUT)

    const response = await fetch(`${CRAWLER_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, keyword, limit }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`[Crawler] Search failed for ${source}:`, response.status)
      return []
    }

    const data: CrawlerSearchResponse = await response.json()

    if (!data.success || !data.results) {
      console.warn(`[Crawler] Search returned no results for ${source}:`, data.error)
      return []
    }

    console.log(`[Crawler] Found ${data.count} results for "${keyword}" on ${source}`)

    return data.results.map((r) => ({
      title: r.title,
      content: r.content,
      url: r.url,
      author: r.author,
      source: r.source as SourceType,
      createdAt: new Date(r.created_at),
      metadata: r.metadata || {},
    }))
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(`[Crawler] Search timed out for ${source}`)
    } else {
      console.error(`[Crawler] Search error for ${source}:`, error)
    }
    return []
  }
}

/**
 * Crawl a single URL and return markdown content.
 * Useful for enriching matches with full page content.
 */
export async function crawlerCrawl(
  url: string,
  cssSelector?: string
): Promise<{ title: string; markdown: string; links: { href: string; text: string }[] } | null> {
  if (!isCrawlerAvailable()) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CRAWLER_TIMEOUT)

    const response = await fetch(`${CRAWLER_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, css_selector: cssSelector, timeout: 30 }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`[Crawler] Crawl failed for ${url}:`, response.status)
      return null
    }

    const data: CrawlerCrawlResponse = await response.json()

    if (!data.success) {
      console.warn(`[Crawler] Crawl failed for ${url}:`, data.error)
      return null
    }

    return {
      title: data.title,
      markdown: data.markdown,
      links: data.links.map((l) => ({ href: l.href, text: l.text })),
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(`[Crawler] Crawl timed out for ${url}`)
    } else {
      console.error(`[Crawler] Crawl error for ${url}:`, error)
    }
    return null
  }
}

/**
 * Health check for the crawler service.
 */
export async function crawlerHealthCheck(): Promise<boolean> {
  if (!isCrawlerAvailable()) return false

  try {
    const response = await fetch(`${CRAWLER_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await response.json()
    return data.status === 'ok' && data.crawler_ready === true
  } catch {
    return false
  }
}
