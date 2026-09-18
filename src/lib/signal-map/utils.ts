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
