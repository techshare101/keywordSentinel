interface GitHubDiscussion {
  title: string
  body: string
  url: string
  author: {
    login: string
  }
  createdAt: string
  comments: {
    totalCount: number
  }
  upvoteCount: number
  category: {
    name: string
  }
}

interface GitHubSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'github'
  createdAt: Date
  metadata: {
    upvotes: number
    comments: number
    category: string
    type: 'discussion' | 'issue'
  }
}

/**
 * Search GitHub Issues using their free REST API
 * No API key required for basic search (60 requests/hour)
 */
export async function searchGitHubIssues(keyword: string, limit: number = 25): Promise<GitHubSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // GitHub Search API - search issues from last 7 days
    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodedKeyword}+created:>${oneWeekAgo}&sort=created&order=desc&per_page=${limit}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'KeywordSentinel/1.0',
        },
      }
    )

    if (!response.ok) {
      console.error('[GitHub] API error:', response.status)
      return []
    }

    const data = await response.json()
    const issues = data.items || []

    console.log(`[GitHub] Found ${issues.length} issues for "${keyword}"`)

    return issues.map((issue: any) => ({
      title: issue.title,
      content: issue.body || issue.title,
      url: issue.html_url,
      author: issue.user?.login || 'Unknown',
      source: 'github' as const,
      createdAt: new Date(issue.created_at),
      metadata: {
        upvotes: issue.reactions?.['+1'] || 0,
        comments: issue.comments || 0,
        category: issue.pull_request ? 'pull_request' : 'issue',
        type: 'issue' as const,
      },
    }))
  } catch (error) {
    console.error('[GitHub] Error searching issues:', error)
    return []
  }
}

/**
 * Search GitHub Discussions using their REST API
 * Searches across public repositories
 */
export async function searchGitHubDiscussions(keyword: string, limit: number = 25): Promise<GitHubSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // GitHub Search API for discussions (type:discussions)
    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodedKeyword}+created:>${oneWeekAgo}+type:discussions&sort=created&order=desc&per_page=${limit}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'KeywordSentinel/1.0',
        },
      }
    )

    if (!response.ok) {
      // Discussions search might not be available, fall back to issues
      console.log('[GitHub] Discussions search not available, using issues only')
      return []
    }

    const data = await response.json()
    const discussions = data.items || []

    return discussions.map((disc: any) => ({
      title: disc.title,
      content: disc.body || disc.title,
      url: disc.html_url,
      author: disc.user?.login || 'Unknown',
      source: 'github' as const,
      createdAt: new Date(disc.created_at),
      metadata: {
        upvotes: disc.reactions?.['+1'] || 0,
        comments: disc.comments || 0,
        category: 'discussion',
        type: 'discussion' as const,
      },
    }))
  } catch (error) {
    console.error('[GitHub] Error searching discussions:', error)
    return []
  }
}

/**
 * Combined GitHub search - issues and discussions
 */
export async function searchGitHub(keyword: string, limit: number = 25): Promise<GitHubSearchResult[]> {
  const [issues, discussions] = await Promise.allSettled([
    searchGitHubIssues(keyword, limit),
    searchGitHubDiscussions(keyword, limit),
  ])

  const results: GitHubSearchResult[] = []

  if (issues.status === 'fulfilled') {
    results.push(...issues.value)
  }
  if (discussions.status === 'fulfilled') {
    results.push(...discussions.value)
  }

  // Dedupe by URL
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}
