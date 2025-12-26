interface NewsSearchResult {
  title: string
  content: string
  url: string
  author: string
  source: 'google_news'
  createdAt: Date
  metadata: {
    publisher: string
  }
}

export async function searchGoogleNews(keyword: string): Promise<NewsSearchResult[]> {
  try {
    // Using Google News RSS feed (no API key required)
    const encodedKeyword = encodeURIComponent(keyword)
    const rssUrl = `https://news.google.com/rss/search?q=${encodedKeyword}&hl=en-US&gl=US&ceid=US:en`
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'KeywordSentinel/1.0',
      },
    })

    if (!response.ok) {
      console.error('Google News RSS error:', response.status)
      return []
    }

    const xml = await response.text()
    
    // Parse RSS XML
    const items = parseRSSItems(xml)
    
    return items.map((item) => ({
      title: item.title,
      content: item.description || item.title,
      url: item.link,
      author: item.source || 'Unknown',
      source: 'google_news' as const,
      createdAt: new Date(item.pubDate),
      metadata: {
        publisher: item.source || 'Unknown',
      },
    }))
  } catch (error) {
    console.error('Error searching Google News:', error)
    return []
  }
}

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  
  // Simple regex-based XML parsing for RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    
    const title = extractTag(itemXml, 'title')
    const link = extractTag(itemXml, 'link')
    const description = extractTag(itemXml, 'description')
    const pubDate = extractTag(itemXml, 'pubDate')
    const source = extractTag(itemXml, 'source')

    if (title && link) {
      items.push({
        title: decodeHTMLEntities(title),
        link,
        description: decodeHTMLEntities(description || ''),
        pubDate: pubDate || new Date().toISOString(),
        source: decodeHTMLEntities(source || ''),
      })
    }
  }

  return items.slice(0, 25) // Limit results
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = regex.exec(xml)
  return match ? (match[1] || match[2] || '').trim() : ''
}

function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  }
  
  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity)
}
