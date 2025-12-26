import { searchReddit } from './reddit'
import { searchHackerNews, searchHNComments } from './hackernews'
import { searchProductHunt } from './producthunt'
import { searchGoogleNews } from './googlenews'
import {
  searchWithFirecrawl,
  searchRedditWithFirecrawl,
  searchHNWithFirecrawl,
  searchProductHuntWithFirecrawl,
  searchNewsWithFirecrawl,
  FirecrawlRateLimitError,
} from './firecrawl'
import type { SourceType } from '@/types/database'

export interface SearchResult {
  title: string
  content: string
  url: string
  author: string
  source: SourceType
  createdAt: Date
  metadata: Record<string, any>
}

// Use Firecrawl if API key is available, otherwise fall back to free APIs
const FIRECRAWL_ENABLED = !!process.env.FIRECRAWL_API_KEY

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function searchAllSources(keyword: string, plan: string = 'free'): Promise<SearchResult[]> {
  const useFirecrawl = FIRECRAWL_ENABLED && plan !== 'free'

  if (useFirecrawl) {
    // Enhanced search with Firecrawl - Sequential to avoid rate limits
    const firecrawlSources = [
      searchRedditWithFirecrawl,
      searchHNWithFirecrawl,
      searchProductHuntWithFirecrawl,
      searchNewsWithFirecrawl,
    ]

    const resultsArray: SearchResult[] = []
    for (const searchFn of firecrawlSources) {
      try {
        const sourceResults = await searchFn(keyword)
        resultsArray.push(...sourceResults)
        // Add 4s delay between sources
        await sleep(4000)
      } catch (error) {
        if (error instanceof FirecrawlRateLimitError) {
          throw error
        }
        console.error(`Firecrawl source search failed:`, error)
      }
    }

    resultsArray.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return resultsArray
  } else {
    // Free API fallback
    const results = await Promise.allSettled([
      searchReddit(keyword),
      searchHackerNews(keyword),
      searchHNComments(keyword),
      searchGoogleNews(keyword),
      searchProductHunt(keyword),
    ])

    const allResults: SearchResult[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value)
      }
    }

    allResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return allResults
  }
}

export async function searchSource(
  source: SourceType,
  keyword: string
): Promise<SearchResult[]> {
  switch (source) {
    case 'reddit':
      return searchReddit(keyword)
    case 'hackernews':
      return [...await searchHackerNews(keyword), ...await searchHNComments(keyword)]
    case 'producthunt':
      return searchProductHunt(keyword)
    case 'google_news':
      return searchGoogleNews(keyword)
    default:
      return []
  }
}

export { searchReddit } from './reddit'
export { searchHackerNews, searchHNComments } from './hackernews'
export { searchProductHunt } from './producthunt'
export { searchGoogleNews } from './googlenews'
