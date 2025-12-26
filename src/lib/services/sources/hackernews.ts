interface HNSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'hackernews'
  createdAt: Date
  metadata: {
    points: number
    comments: number
    storyId: number
  }
}

interface AlgoliaHit {
  objectID: string
  title: string
  url: string
  author: string
  points: number
  num_comments: number
  created_at: string
  story_text?: string
}

export async function searchHackerNews(keyword: string, limit: number = 25): Promise<HNSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400
    
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search_by_date?query=${encodedKeyword}&tags=story&numericFilters=created_at_i>${oneDayAgo}&hitsPerPage=${limit}`
    )

    if (!response.ok) {
      console.error('HN API error:', response.status)
      return []
    }

    const data = await response.json()
    const hits: AlgoliaHit[] = data.hits || []

    return hits.map((hit) => ({
      title: hit.title || 'Untitled',
      content: hit.story_text || hit.title || '',
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author,
      source: 'hackernews' as const,
      createdAt: new Date(hit.created_at),
      metadata: {
        points: hit.points || 0,
        comments: hit.num_comments || 0,
        storyId: parseInt(hit.objectID),
      },
    }))
  } catch (error) {
    console.error('Error searching Hacker News:', error)
    return []
  }
}

export async function searchHNComments(keyword: string, limit: number = 25): Promise<HNSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400
    
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search_by_date?query=${encodedKeyword}&tags=comment&numericFilters=created_at_i>${oneDayAgo}&hitsPerPage=${limit}`
    )

    if (!response.ok) {
      console.error('HN API error:', response.status)
      return []
    }

    const data = await response.json()
    const hits = data.hits || []

    return hits.map((hit: any) => ({
      title: `Comment on: ${hit.story_title || 'Unknown'}`,
      content: hit.comment_text || '',
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author,
      source: 'hackernews' as const,
      createdAt: new Date(hit.created_at),
      metadata: {
        points: hit.points || 0,
        comments: 0,
        storyId: parseInt(hit.story_id || hit.objectID),
      },
    }))
  } catch (error) {
    console.error('Error searching HN comments:', error)
    return []
  }
}
