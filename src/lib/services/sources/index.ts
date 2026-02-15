import { searchReddit } from './reddit'
import { searchHackerNews, searchHNComments } from './hackernews'
import { searchProductHunt } from './producthunt'
import { searchGoogleNews } from './googlenews'
import { searchDevTo } from './devto'
import { searchStackOverflow } from './stackoverflow'
import { searchGitHub } from './github'
import { searchTwitter } from './twitter'
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

/**
 * Search all sources for a keyword using FREE APIs only.
 * 
 * IMPORTANT: Firecrawl is NEVER used in automated scans.
 * Firecrawl is a protected resource - only used for manual enrichment.
 * 
 * This keeps scanning costs at $0 while still finding leads.
 */
export async function searchAllSources(keyword: string, plan: string = 'free'): Promise<SearchResult[]> {
  const allResultsMap = new Map<string, SearchResult>()

  // Run FREE APIs only - no Firecrawl in automated scans
  console.log(`[Search] Scanning free sources for: "${keyword}" (Plan: ${plan})`)
  
  const sourceNames = [
    'Reddit', 'HackerNews', 'HN Comments', 'Google News',
    'Product Hunt', 'Dev.to', 'StackOverflow', 'GitHub', 'Twitter/X',
  ]

  const results = await Promise.allSettled([
    searchReddit(keyword),
    searchHackerNews(keyword),
    searchHNComments(keyword),
    searchGoogleNews(keyword),
    searchProductHunt(keyword),
    searchDevTo(keyword),
    searchStackOverflow(keyword),
    searchGitHub(keyword),
    searchTwitter(keyword),
  ])

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      console.log(`[Search] ${sourceNames[i]}: ${result.value.length} results`)
      result.value.forEach(r => {
        if (!allResultsMap.has(r.url)) {
          allResultsMap.set(r.url, r)
        }
      })
    } else {
      console.error(`[Search] ${sourceNames[i]} FAILED:`, result.reason?.message || result.reason)
    }
  }

  const finalResults = Array.from(allResultsMap.values())

  // Sort by date, newest first
  finalResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  console.log(`[Search] Found ${finalResults.length} results for "${keyword}"`)

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
    case 'devto':
      return searchDevTo(keyword)
    case 'stackoverflow':
      return searchStackOverflow(keyword)
    case 'github':
      return searchGitHub(keyword)
    case 'twitter':
      return searchTwitter(keyword)
    default:
      return []
  }
}

export { searchReddit } from './reddit'
export { searchHackerNews, searchHNComments } from './hackernews'
export { searchProductHunt } from './producthunt'
export { searchGoogleNews } from './googlenews'
export { searchDevTo } from './devto'
export { searchStackOverflow } from './stackoverflow'
export { searchGitHub } from './github'
export { searchTwitter, enrichTweetWithFxTwitter } from './twitter'
