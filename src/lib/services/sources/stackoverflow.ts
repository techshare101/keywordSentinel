interface SOQuestion {
  question_id: number
  title: string
  body_markdown?: string
  link: string
  owner: {
    display_name: string
  }
  creation_date: number
  score: number
  answer_count: number
  view_count: number
  tags: string[]
}

interface SOSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'stackoverflow'
  createdAt: Date
  metadata: {
    score: number
    answers: number
    views: number
    tags: string[]
  }
}

/**
 * Search Stack Overflow questions using their free public API
 * https://api.stackexchange.com/docs
 * 
 * Rate limit: 300 requests/day without API key, 10,000/day with key
 */
export async function searchStackOverflow(keyword: string, limit: number = 25): Promise<SOSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
    
    // Stack Exchange API - search questions from last 7 days
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=${encodedKeyword}&fromdate=${oneWeekAgo}&site=stackoverflow&pagesize=${limit}&filter=withbody`,
      {
        headers: {
          'Accept-Encoding': 'gzip',
        },
      }
    )

    if (!response.ok) {
      console.error('[StackOverflow] API error:', response.status)
      return []
    }

    const data = await response.json()
    
    if (data.error_id) {
      console.error('[StackOverflow] API error:', data.error_message)
      return []
    }

    const questions: SOQuestion[] = data.items || []

    console.log(`[StackOverflow] Found ${questions.length} questions for "${keyword}"`)

    return questions.map((q) => ({
      title: q.title,
      content: q.body_markdown || q.title,
      url: q.link,
      author: q.owner?.display_name || 'Unknown',
      source: 'stackoverflow' as const,
      createdAt: new Date(q.creation_date * 1000),
      metadata: {
        score: q.score || 0,
        answers: q.answer_count || 0,
        views: q.view_count || 0,
        tags: q.tags || [],
      },
    }))
  } catch (error) {
    console.error('[StackOverflow] Error searching:', error)
    return []
  }
}

/**
 * Search Stack Overflow by tags
 */
export async function searchStackOverflowByTag(tag: string, limit: number = 25): Promise<SOSearchResult[]> {
  try {
    const encodedTag = encodeURIComponent(tag)
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
    
    const response = await fetch(
      `https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&tagged=${encodedTag}&fromdate=${oneWeekAgo}&site=stackoverflow&pagesize=${limit}`,
      {
        headers: {
          'Accept-Encoding': 'gzip',
        },
      }
    )

    if (!response.ok) {
      console.error('[StackOverflow] API error:', response.status)
      return []
    }

    const data = await response.json()
    const questions: SOQuestion[] = data.items || []

    return questions.map((q) => ({
      title: q.title,
      content: q.body_markdown || q.title,
      url: q.link,
      author: q.owner?.display_name || 'Unknown',
      source: 'stackoverflow' as const,
      createdAt: new Date(q.creation_date * 1000),
      metadata: {
        score: q.score || 0,
        answers: q.answer_count || 0,
        views: q.view_count || 0,
        tags: q.tags || [],
      },
    }))
  } catch (error) {
    console.error('[StackOverflow] Error searching by tag:', error)
    return []
  }
}
