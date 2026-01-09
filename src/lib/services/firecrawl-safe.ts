/**
 * SAFE FIRECRAWL WRAPPER
 * 
 * Firecrawl is a SCARCE, PROTECTED RESOURCE.
 * It should NEVER be called automatically during scans.
 * 
 * RULES:
 * 1. NEVER crawl automatically (no cron, no scan jobs)
 * 2. REQUIRE explicit user action (button click)
 * 3. FORCE minimal mode (no expensive features)
 * 4. ENFORCE global rate limits and budget caps
 */

import Firecrawl from '@mendable/firecrawl-js'
import { createClient } from '@supabase/supabase-js'

// ============================================
// HARD LIMITS - PROTECT YOUR WALLET
// ============================================
const LIMITS = {
  CALLS_PER_DAY: 10,           // Max 10 calls per day total
  CALLS_PER_USER_PER_HOUR: 2,  // Max 2 calls per user per hour
  MONTHLY_BUDGET_CALLS: 100,   // ~$5 worth at $0.05/call
} as const

// ============================================
// SAFE CONFIG - NO EXPENSIVE FEATURES
// ============================================
function getSafeConfig() {
  return {
    formats: ['markdown'],
    onlyMainContent: true,
  }
}

// ============================================
// ERROR CLASSES
// ============================================
export class FirecrawlBudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FirecrawlBudgetExceededError'
  }
}

export class FirecrawlRateLimitedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FirecrawlRateLimitedError'
  }
}

export class FirecrawlDisabledError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FirecrawlDisabledError'
  }
}

// ============================================
// USAGE TRACKING
// ============================================
interface FirecrawlUsage {
  id: string
  user_id: string
  url: string
  call_type: 'scrape' | 'enrich'
  created_at: string
  credits_used: number
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

/**
 * Check if Firecrawl is available (API key configured)
 */
export function isFirecrawlAvailable(): boolean {
  return !!process.env.FIRECRAWL_API_KEY
}

/**
 * Get current usage stats for a user
 */
export async function getFirecrawlUsage(userId: string): Promise<{
  todayCalls: number
  hourCalls: number
  monthCalls: number
  remainingToday: number
  remainingHour: number
  remainingMonth: number
}> {
  const supabase = getSupabaseAdmin()
  
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Get today's calls (all users)
  const { count: todayCalls } = await supabase
    .from('firecrawl_usage')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)

  // Get this hour's calls (this user)
  const { count: hourCalls } = await supabase
    .from('firecrawl_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo)

  // Get this month's calls (all users)
  const { count: monthCalls } = await supabase
    .from('firecrawl_usage')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth)

  const today = todayCalls || 0
  const hour = hourCalls || 0
  const month = monthCalls || 0

  return {
    todayCalls: today,
    hourCalls: hour,
    monthCalls: month,
    remainingToday: Math.max(0, LIMITS.CALLS_PER_DAY - today),
    remainingHour: Math.max(0, LIMITS.CALLS_PER_USER_PER_HOUR - hour),
    remainingMonth: Math.max(0, LIMITS.MONTHLY_BUDGET_CALLS - month),
  }
}

/**
 * Check if a user can make a Firecrawl call
 */
async function canMakeCall(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!isFirecrawlAvailable()) {
    return { allowed: false, reason: 'Firecrawl API key not configured' }
  }

  const usage = await getFirecrawlUsage(userId)

  if (usage.remainingMonth <= 0) {
    return { allowed: false, reason: 'Monthly Firecrawl budget exhausted' }
  }

  if (usage.remainingToday <= 0) {
    return { allowed: false, reason: 'Daily Firecrawl limit reached. Try again tomorrow.' }
  }

  if (usage.remainingHour <= 0) {
    return { allowed: false, reason: 'Hourly Firecrawl limit reached. Try again in an hour.' }
  }

  return { allowed: true }
}

/**
 * Record a Firecrawl call for tracking
 */
async function recordCall(userId: string, url: string, callType: 'scrape' | 'enrich'): Promise<void> {
  const supabase = getSupabaseAdmin()
  
  await supabase.from('firecrawl_usage').insert({
    user_id: userId,
    url,
    call_type: callType,
    credits_used: 1,
  })
}

/**
 * SAFE Firecrawl scrape - MANUAL USE ONLY
 * 
 * This function:
 * 1. Checks rate limits before calling
 * 2. Uses minimal safe config
 * 3. Records usage for tracking
 * 4. Returns enriched content
 */
export async function safeFirecrawlScrape(
  userId: string,
  url: string
): Promise<{
  success: boolean
  title?: string
  content?: string
  metadata?: Record<string, any>
  error?: string
}> {
  // Check if call is allowed
  const { allowed, reason } = await canMakeCall(userId)
  if (!allowed) {
    return { success: false, error: reason }
  }

  try {
    const firecrawl = new Firecrawl({
      apiKey: process.env.FIRECRAWL_API_KEY || '',
    })

    console.log(`[Firecrawl SAFE] Scraping URL for user ${userId}: ${url}`)

    const result = await firecrawl.scrape(url, { formats: ['markdown'] }) as any

    // Record the call
    await recordCall(userId, url, 'scrape')

    if (!result.success || !result.markdown) {
      return { success: false, error: 'Failed to scrape URL' }
    }

    return {
      success: true,
      title: result.metadata?.title || 'Untitled',
      content: result.markdown,
      metadata: {
        description: result.metadata?.description,
        ogImage: result.metadata?.ogImage,
        sourceURL: result.metadata?.sourceURL,
        language: result.metadata?.language,
      },
    }
  } catch (error: any) {
    console.error('[Firecrawl SAFE] Error:', error)

    // Handle specific errors
    if (error?.status === 402) {
      return { success: false, error: 'Firecrawl credits exhausted' }
    }
    if (error?.status === 429) {
      return { success: false, error: 'Firecrawl rate limited. Try again later.' }
    }

    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * SAFE Lead Enrichment - MANUAL USE ONLY
 * 
 * Enriches a lead/match with deep content from Firecrawl
 */
export async function safeEnrichLead(
  userId: string,
  matchId: string,
  url: string
): Promise<{
  success: boolean
  enrichedContent?: string
  metadata?: Record<string, any>
  error?: string
}> {
  // Check if call is allowed
  const { allowed, reason } = await canMakeCall(userId)
  if (!allowed) {
    return { success: false, error: reason }
  }

  try {
    const apiKey = process.env.FIRECRAWL_API_KEY
    if (!apiKey) {
      console.error('[Firecrawl SAFE] API key not configured')
      return { success: false, error: 'Firecrawl API key not configured' }
    }

    const firecrawl = new Firecrawl({ apiKey })

    console.log(`[Firecrawl SAFE] Enriching lead ${matchId} for user ${userId}, URL: ${url}`)

    const result = await firecrawl.scrape(url, { formats: ['markdown'] }) as any

    // Record the call
    await recordCall(userId, url, 'enrich')

    if (!result.success || !result.markdown) {
      console.error('[Firecrawl SAFE] Scrape failed:', result)
      return { success: false, error: result.error || 'Failed to enrich lead - no content returned' }
    }

    // Update the match with enriched content
    const supabase = getSupabaseAdmin()
    await supabase
      .from('matches')
      .update({
        enriched_content: result.markdown.slice(0, 10000), // Limit size
        enriched_at: new Date().toISOString(),
        metadata: {
          enriched: true,
          enrichedTitle: result.metadata?.title,
          enrichedDescription: result.metadata?.description,
        },
      })
      .eq('id', matchId)
      .eq('user_id', userId)

    return {
      success: true,
      enrichedContent: result.markdown,
      metadata: result.metadata,
    }
  } catch (error: any) {
    console.error('[Firecrawl SAFE] Enrich error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

// ============================================
// EXPORTS FOR ADMIN/DEBUGGING
// ============================================
export const FIRECRAWL_LIMITS = LIMITS
