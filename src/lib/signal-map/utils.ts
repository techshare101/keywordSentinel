/**
 * Fetch with timeout to prevent serverless functions from hanging.
 * Default timeout: 25 seconds (safe for Vercel's 30s streaming limit).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 25000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Extract a clean, short search query from a structured ICP description.
 * Handles formats like:
 *   "Bio search: X. Website search: Y. Keyword search: Z"
 *   "Keyword search: medical spa marketing — surfaces the keywords..."
 *   "med spa owner or aesthetic injector"
 * Returns a query suitable for Reddit, YouTube, Spotify, AI engines.
 */
export function extractSearchQuery(icp_description: string, maxLength: number = 120): string {
  const text = icp_description
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Try to extract the "Keyword search:" portion first
  const keywordMatch = text.match(/keyword search[:\-]?\s*([^\.\n\—\–\-]+)/i)
  if (keywordMatch) {
    return keywordMatch[1].trim().slice(0, maxLength)
  }

  // Try "Bio search:" portion
  const bioMatch = text.match(/bio search[:\-]?\s*([^\.\n\—\–\-]+)/i)
  if (bioMatch) {
    return bioMatch[1].trim().slice(0, maxLength)
  }

  // Fallback: first sentence (stop at em dash, en dash, or hyphen if no period), truncated
  const firstSentence = text.split(/[\.!?]/)[0].trim()
  const cleanSentence = firstSentence.split(/[\—\–]/)[0].trim()
  if (cleanSentence.length > 10) {
    return cleanSentence.slice(0, maxLength)
  }

  return text.slice(0, maxLength)
}

/**
 * Extract seed domains from a structured ICP description if the user didn't provide them.
 * Looks for URLs or domain mentions like "americanmedspa.org".
 */
export function extractDomainsFromICP(icp_description: string): string[] {
  const domains: string[] = []
  const urlMatches = icp_description.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][\w\-]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/g) || []
  
  for (const match of urlMatches) {
    const domain = match
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase()
    
    if (domain && !domain.includes('google.com') && !domain.includes('youtube.com') && !domain.includes('spotify.com')) {
      domains.push(domain)
    }
  }

  return [...new Set(domains)]
}

/**
 * Truncate an object to a maximum size for database storage.
 * Supabase has a 1MB limit on JSONB fields.
 */
export function truncateForStorage(obj: unknown, maxChars: number = 50000): unknown {
  const json = JSON.stringify(obj)
  if (json.length <= maxChars) return obj

  // Truncate arrays first
  if (Array.isArray(obj)) {
    const truncated = obj.slice(0, Math.max(1, Math.floor(maxChars / 200)))
    return truncated
  }

  // For objects, return a summary
  if (typeof obj === 'object' && obj !== null) {
    return {
      ...obj as Record<string, unknown>,
      _truncated: true,
      _original_size: json.length,
    }
  }

  return obj
}
