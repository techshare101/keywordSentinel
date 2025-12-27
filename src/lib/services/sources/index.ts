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
  FirecrawlCreditsExhaustedError,
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

export async function searchAllSources(keyword: string, plan: string = 'free'): Promise<SearchResult[]> {
  const allResultsMap = new Map<string, SearchResult>()

  // 1. Always run Free/Fallback APIs (Real-time & Reliable)
  console.log(`[Search] Running fallback apps for: "${keyword}"`)
  const fallbackSettled = await Promise.allSettled([
    searchReddit(keyword),
    searchHackerNews(keyword),
    searchHNComments(keyword),
    searchGoogleNews(keyword),
    searchProductHunt(keyword),
  ])

  for (const result of fallbackSettled) {
    if (result.status === 'fulfilled') {
      result.value.forEach(r => {
        if (!allResultsMap.has(r.url)) {
          allResultsMap.set(r.url, r)
        }
      })
    }
  }

  // 2. Enhanced search with Firecrawl for Pro/Team users (Deep Search)
  if (useFirecrawl && plan !== 'free') {
    console.log(`[Search] Running Firecrawl deep search for: "${keyword}" (Plan: ${plan})`)
    const firecrawlSources = [
      searchRedditWithFirecrawl,
      searchHNWithFirecrawl,
      searchProductHuntWithFirecrawl,
      searchNewsWithFirecrawl,
    ]

    for (const searchFn of firecrawlSources) {
      try {
        const sourceResults = await searchFn(keyword)
        sourceResults.forEach(r => {
          // Firecrawl results are often richer, so we can overwrite or just add if new
          if (!allResultsMap.has(r.url)) {
            allResultsMap.set(r.url, r)
          }
        })
        // Add delay between sources to respect rate limits
        await sleep(4000)
      } catch (error) {
        if (error instanceof FirecrawlCreditsExhaustedError) {
          console.warn('Firecrawl credits exhausted.')
          break
        }
        if (error instanceof FirecrawlRateLimitError) {
          console.warn('Firecrawl rate limited.')
          break
        }
        console.error(`Firecrawl source search failed:`, error)
      }
    }
  }

  const finalResults = Array.from(allResultsMap.values())

  // Sort by date, newest first
  finalResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return finalResults
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
