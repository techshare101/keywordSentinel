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
const useFirecrawl = !!process.env.FIRECRAWL_API_KEY

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function searchAllSources(keyword: string): Promise<SearchResult[]> {
  let results: PromiseSettledResult<SearchResult[]>[]

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
        // Add 4s delay between sources (20 req/min = 1 req per 3s minimum)
        await sleep(4000)
      } catch (error) {
        if (error instanceof FirecrawlRateLimitError) {
          throw error // Propagate to trigger scanner abort
        }
        console.error(`Firecrawl source search failed:`, error)
      }
    }

    // Convert to a format compatible with the rest of the function
    const allResults = resultsArray
    // Sort by date, newest first
    allResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return allResults
  } else {
    // Free API fallback
    results = await Promise.allSettled([
      searchReddit(keyword),
      searchHackerNews(keyword),
      searchHNComments(keyword),
      searchGoogleNews(keyword),
      searchProductHunt(keyword),
    ])
  }

  const allResults: SearchResult[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
    }
  }

  // Sort by date, newest first
  allResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return allResults
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
