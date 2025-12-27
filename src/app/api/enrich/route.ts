import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { 
  safeEnrichLead, 
  getFirecrawlUsage, 
  isFirecrawlAvailable 
} from '@/lib/services/firecrawl-safe'

/**
 * POST /api/enrich
 * 
 * Manual lead enrichment using Firecrawl (SAFE mode)
 * - Requires user authentication
 * - Rate limited per user
 * - Budget capped globally
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Firecrawl is available
    if (!isFirecrawlAvailable()) {
      return NextResponse.json({ 
        error: 'Firecrawl not configured',
        message: 'Deep enrichment is not available. Contact support.'
      }, { status: 503 })
    }

    const body = await request.json()
    const { matchId, url } = body

    if (!matchId || !url) {
      return NextResponse.json({ 
        error: 'Missing required fields: matchId, url' 
      }, { status: 400 })
    }

    // Verify the match belongs to this user
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, url, enriched_at')
      .eq('id', matchId)
      .eq('user_id', user.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Check if already enriched recently (within 24 hours)
    if (match.enriched_at) {
      const enrichedAt = new Date(match.enriched_at)
      const hoursSinceEnrich = (Date.now() - enrichedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceEnrich < 24) {
        return NextResponse.json({ 
          error: 'Already enriched',
          message: 'This lead was enriched recently. Try again later.',
          enrichedAt: match.enriched_at
        }, { status: 429 })
      }
    }

    // Perform safe enrichment
    const result = await safeEnrichLead(user.id, matchId, url)

    if (!result.success) {
      return NextResponse.json({ 
        error: 'Enrichment failed',
        message: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      matchId,
      enrichedContent: result.enrichedContent?.slice(0, 500) + '...', // Preview only
      metadata: result.metadata,
    })

  } catch (error) {
    console.error('Enrich API error:', error)
    return NextResponse.json(
      { error: 'Enrichment failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/enrich
 * 
 * Get Firecrawl usage stats for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const available = isFirecrawlAvailable()
    
    if (!available) {
      return NextResponse.json({
        available: false,
        message: 'Firecrawl not configured'
      })
    }

    const usage = await getFirecrawlUsage(user.id)

    return NextResponse.json({
      available: true,
      usage: {
        todayCalls: usage.todayCalls,
        hourCalls: usage.hourCalls,
        monthCalls: usage.monthCalls,
        remainingToday: usage.remainingToday,
        remainingHour: usage.remainingHour,
        remainingMonth: usage.remainingMonth,
      }
    })

  } catch (error) {
    console.error('Enrich usage API error:', error)
    return NextResponse.json(
      { error: 'Failed to get usage', message: (error as Error).message },
      { status: 500 }
    )
  }
}
