import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Get all matches for this user
    const { data: allMatches } = await supabase
      .from('matches')
      .select('id, lead_score, lead_bucket, sentiment, source, is_read, created_at, metadata')
      .eq('user_id', user.id)

    const matches = allMatches || []

    // Filter matches by time periods
    const matchesLast7Days = matches.filter(m => new Date(m.created_at) >= sevenDaysAgo)
    const matchesPrevious7Days = matches.filter(m => {
      const date = new Date(m.created_at)
      return date >= fourteenDaysAgo && date < sevenDaysAgo
    })

    // Calculate stats
    const hotLeads = matches.filter(m => m.lead_bucket === 'hot' || m.lead_score >= 70)
    const warmLeads = matches.filter(m => m.lead_bucket === 'warm' || (m.lead_score >= 30 && m.lead_score < 70))
    const unseenCount = matches.filter(m => !m.is_read).length

    // Sentiment breakdown
    const sentimentBreakdown = {
      positive: matches.filter(m => m.sentiment === 'positive').length,
      negative: matches.filter(m => m.sentiment === 'negative').length,
      neutral: matches.filter(m => m.sentiment === 'neutral').length,
    }

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {}
    matches.forEach(m => {
      sourceBreakdown[m.source] = (sourceBreakdown[m.source] || 0) + 1
    })

    // Top sources sorted by count
    const topSources = Object.entries(sourceBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }))

    // Calculate growth percentage
    const currentCount = matchesLast7Days.length
    const previousCount = matchesPrevious7Days.length
    const growthPercentage = previousCount > 0 
      ? Math.round(((currentCount - previousCount) / previousCount) * 100)
      : currentCount > 0 ? 100 : 0

    // Estimated value calculation (simple formula: hot leads * $500 + warm leads * $100)
    const estimatedValue = (hotLeads.length * 500) + (warmLeads.length * 100)

    // Daily match trend for last 7 days
    const dailyTrend: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const count = matches.filter(m => m.created_at.startsWith(dateStr)).length
      dailyTrend.push({ date: dateStr, count })
    }

    // Intent breakdown from metadata
    const intentBreakdown: Record<string, number> = {}
    matches.forEach(m => {
      const intent = m.metadata?.intent || 'unknown'
      intentBreakdown[intent] = (intentBreakdown[intent] || 0) + 1
    })

    // Get recent scan info
    const { data: recentScans } = await supabase
      .from('scan_runs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const lastScan = recentScans?.[0]
    const avgScanDuration = recentScans?.length 
      ? Math.round(recentScans.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / recentScans.length / 1000)
      : 0

    return NextResponse.json({
      success: true,
      overview: {
        totalMatches: matches.length,
        matchesLast7Days: currentCount,
        hotLeads: hotLeads.length,
        warmLeads: warmLeads.length,
        unseenCount,
        estimatedValue,
        growthPercentage,
      },
      breakdown: {
        sentiment: sentimentBreakdown,
        sources: topSources,
        intent: intentBreakdown,
      },
      trends: {
        daily: dailyTrend,
      },
      scanning: {
        lastScanAt: lastScan?.finished_at || lastScan?.created_at,
        lastScanMatches: lastScan?.matches_found || 0,
        avgScanDurationSeconds: avgScanDuration,
        recentScans: recentScans?.slice(0, 3).map(s => ({
          id: s.id,
          keywordsScanned: s.keywords_scanned,
          matchesFound: s.matches_found,
          durationMs: s.duration_ms,
          createdAt: s.created_at,
        })) || [],
      },
    })
  } catch (error) {
    console.error('Insights error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights', message: (error as Error).message },
      { status: 500 }
    )
  }
}
