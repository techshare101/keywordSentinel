interface DevToArticle {
  id: number
  title: string
  description: string
  url: string
  user: {
    name: string
    username: string
  }
  published_at: string
  positive_reactions_count: number
  comments_count: number
  tag_list: string[]
}

interface DevToSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'devto'
  createdAt: Date
  metadata: {
    reactions: number
    comments: number
    tags: string[]
  }
}

/**
 * Search Dev.to articles using their free public API
 * https://developers.forem.com/api
 */
export async function searchDevTo(keyword: string, limit: number = 25): Promise<DevToSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    
    // Dev.to API - full-text search (not just tags)
    // Try search endpoint first, then fall back to tag-based
    const searchResponse = await fetch(
      `https://dev.to/api/articles?per_page=${limit}&search=${encodedKeyword}`,
      {
        headers: {
          'User-Agent': 'KeywordSentinel/1.0',
          'Accept': 'application/json',
        },
      }
    )

    let articles: DevToArticle[] = []

    if (searchResponse.ok) {
      articles = await searchResponse.json()
    } else {
      // Fallback: tag-based search
      const tagResponse = await fetch(
        `https://dev.to/api/articles?per_page=${limit}&tag=${encodedKeyword}`,
        {
          headers: {
            'User-Agent': 'KeywordSentinel/1.0',
            'Accept': 'application/json',
          },
        }
      )
      if (!tagResponse.ok) {
        console.error('[DevTo] API error:', tagResponse.status)
        return []
      }
      articles = await tagResponse.json()
    }

    // Filter to last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentArticles = articles.filter(
      article => new Date(article.published_at) > oneWeekAgo
    )

    console.log(`[DevTo] Found ${recentArticles.length} articles for "${keyword}"`)

    return recentArticles.map((article) => ({
      title: article.title,
      content: article.description || article.title,
      url: article.url,
      author: article.user?.name || article.user?.username || 'Unknown',
      source: 'devto' as const,
      createdAt: new Date(article.published_at),
      metadata: {
        reactions: article.positive_reactions_count || 0,
        comments: article.comments_count || 0,
        tags: article.tag_list || [],
      },
    }))
  } catch (error) {
    console.error('[DevTo] Error searching:', error)
    return []
  }
}

/**
 * Search Dev.to using full-text search endpoint
 */
export async function searchDevToFullText(keyword: string, limit: number = 25): Promise<DevToSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    
    const response = await fetch(
      `https://dev.to/api/articles?per_page=${limit}&state=rising`,
      {
        headers: {
          'User-Agent': 'KeywordSentinel/1.0',
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('[DevTo] API error:', response.status)
      return []
    }

    const articles: DevToArticle[] = await response.json()

    // Filter articles that contain the keyword in title or description
    const keywordLower = keyword.toLowerCase()
    const matchingArticles = articles.filter(
      article => 
        article.title.toLowerCase().includes(keywordLower) ||
        (article.description && article.description.toLowerCase().includes(keywordLower))
    )

    // Filter to last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentArticles = matchingArticles.filter(
      article => new Date(article.published_at) > oneWeekAgo
    )

    return recentArticles.map((article) => ({
      title: article.title,
      content: article.description || article.title,
      url: article.url,
      author: article.user?.name || article.user?.username || 'Unknown',
      source: 'devto' as const,
      createdAt: new Date(article.published_at),
      metadata: {
        reactions: article.positive_reactions_count || 0,
        comments: article.comments_count || 0,
        tags: article.tag_list || [],
      },
    }))
  } catch (error) {
    console.error('[DevTo] Error searching:', error)
    return []
  }
}
