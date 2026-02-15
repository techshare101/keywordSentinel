interface PHSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'producthunt'
  createdAt: Date
  metadata: {
    tagline: string
    votesCount: number
  }
}

export async function searchProductHunt(keyword: string): Promise<PHSearchResult[]> {
  try {
    // Use Product Hunt's RSS feed — no API key required
    const encodedKeyword = encodeURIComponent(keyword)
    const response = await fetch(
      `https://www.producthunt.com/feed?category=${encodedKeyword}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, text/html',
        },
      }
    )

    if (!response.ok) {
      // Fallback: try the main feed and filter by keyword
      console.log('[ProductHunt] Category feed failed, trying main feed filter')
      return await searchProductHuntMainFeed(keyword)
    }

    const xml = await response.text()
    return parsePHRss(xml, keyword)
  } catch (error) {
    console.error('[ProductHunt] Error searching:', error)
    // Fallback to main feed
    return await searchProductHuntMainFeed(keyword)
  }
}

async function searchProductHuntMainFeed(keyword: string): Promise<PHSearchResult[]> {
  try {
    const response = await fetch('https://www.producthunt.com/feed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html',
      },
    })

    if (!response.ok) {
      console.error('[ProductHunt] Main feed error:', response.status)
      return []
    }

    const xml = await response.text()
    return parsePHRss(xml, keyword)
  } catch (error) {
    console.error('[ProductHunt] Main feed error:', error)
    return []
  }
}

function parsePHRss(xml: string, keyword: string): PHSearchResult[] {
  const results: PHSearchResult[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const keywordLower = keyword.toLowerCase()
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractPHTag(item, 'title') || ''
    const link = extractPHTag(item, 'link') || ''
    const description = extractPHTag(item, 'description') || ''
    const pubDate = extractPHTag(item, 'pubDate') || new Date().toISOString()

    // Filter by keyword match in title or description
    const matchesKeyword =
      title.toLowerCase().includes(keywordLower) ||
      description.toLowerCase().includes(keywordLower)

    if (link && matchesKeyword) {
      results.push({
        title: decodePHEntities(title),
        content: decodePHEntities(description).replace(/<[^>]+>/g, '').slice(0, 2000),
        url: link,
        author: 'Product Hunt',
        source: 'producthunt' as const,
        createdAt: new Date(pubDate),
        metadata: {
          tagline: decodePHEntities(description).replace(/<[^>]+>/g, '').slice(0, 200),
          votesCount: 0,
        },
      })
    }
  }

  console.log(`[ProductHunt] Found ${results.length} matching items for "${keyword}"`)
  return results.slice(0, 25)
}

function extractPHTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const m = regex.exec(xml)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function decodePHEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  }
  return text.replace(/&[^;]+;/g, (e) => entities[e] || e)
}

// Placeholder for when PH API is configured
export async function searchProductHuntAPI(
  keyword: string,
  apiKey: string
): Promise<PHSearchResult[]> {
  // GraphQL query for Product Hunt API
  const query = `
    query SearchPosts($query: String!) {
      posts(first: 20, query: $query) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            votesCount
            createdAt
            user {
              name
            }
          }
        }
      }
    }
  `

  try {
    const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { query: keyword },
      }),
    })

    if (!response.ok) {
      console.error('Product Hunt API error:', response.status)
      return []
    }

    const data = await response.json()
    const posts = data.data?.posts?.edges || []

    return posts.map((edge: any) => ({
      title: edge.node.name,
      content: edge.node.description || edge.node.tagline,
      url: edge.node.url,
      author: edge.node.user?.name || 'Unknown',
      source: 'producthunt' as const,
      createdAt: new Date(edge.node.createdAt),
      metadata: {
        tagline: edge.node.tagline,
        votesCount: edge.node.votesCount,
      },
    }))
  } catch (error) {
    console.error('Error with Product Hunt API:', error)
    return []
  }
}
