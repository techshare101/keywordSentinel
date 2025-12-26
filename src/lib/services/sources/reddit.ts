interface RedditPost {
  title: string
  selftext: string
  url: string
  author: string
  subreddit: string
  created_utc: number
  permalink: string
  score: number
  num_comments: number
}

interface RedditSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'reddit'
  createdAt: Date
  metadata: {
    subreddit: string
    score: number
    comments: number
  }
}

export async function searchReddit(keyword: string, limit: number = 25): Promise<RedditSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const response = await fetch(
      `https://www.reddit.com/search.json?q=${encodedKeyword}&sort=new&limit=${limit}&t=day`,
      {
        headers: {
          'User-Agent': 'KeywordSentinel/1.0',
        },
      }
    )

    if (!response.ok) {
      console.error('Reddit API error:', response.status)
      return []
    }

    const data = await response.json()
    const posts: RedditPost[] = data.data?.children?.map((child: any) => child.data) || []

    return posts.map((post) => ({
      title: post.title,
      content: post.selftext || post.title,
      url: `https://reddit.com${post.permalink}`,
      author: post.author,
      source: 'reddit' as const,
      createdAt: new Date(post.created_utc * 1000),
      metadata: {
        subreddit: post.subreddit,
        score: post.score,
        comments: post.num_comments,
      },
    }))
  } catch (error) {
    console.error('Error searching Reddit:', error)
    return []
  }
}

export async function searchSubreddit(
  subreddit: string,
  keyword: string,
  limit: number = 25
): Promise<RedditSearchResult[]> {
  try {
    const encodedKeyword = encodeURIComponent(keyword)
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/search.json?q=${encodedKeyword}&restrict_sr=1&sort=new&limit=${limit}&t=day`,
      {
        headers: {
          'User-Agent': 'KeywordSentinel/1.0',
        },
      }
    )

    if (!response.ok) {
      console.error('Reddit API error:', response.status)
      return []
    }

    const data = await response.json()
    const posts: RedditPost[] = data.data?.children?.map((child: any) => child.data) || []

    return posts.map((post) => ({
      title: post.title,
      content: post.selftext || post.title,
      url: `https://reddit.com${post.permalink}`,
      author: post.author,
      source: 'reddit' as const,
      createdAt: new Date(post.created_utc * 1000),
      metadata: {
        subreddit: post.subreddit,
        score: post.score,
        comments: post.num_comments,
      },
    }))
  } catch (error) {
    console.error('Error searching subreddit:', error)
    return []
  }
}
