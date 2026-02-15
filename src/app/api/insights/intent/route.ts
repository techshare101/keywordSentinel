import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const intent = request.nextUrl.searchParams.get('intent')
    if (!intent) {
      return NextResponse.json(
        { error: 'Missing intent parameter' },
        { status: 400 }
      )
    }

    // Fetch matches with keyword info, filtered by intent in metadata
    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, title, url, source, lead_score, lead_bucket, created_at, metadata, keywords(keyword)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Intent matches query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      )
    }

    // Filter by intent from metadata
    const filtered = (matches || []).filter(
      (m: any) => (m.metadata?.intent || 'unknown') === intent
    )

    // Group by keyword
    const keywordGroups: Record<string, { keyword: string; matches: any[] }> = {}
    for (const match of filtered) {
      const kw = (match as any).keywords?.keyword || 'Unknown'
      if (!keywordGroups[kw]) {
        keywordGroups[kw] = { keyword: kw, matches: [] }
      }
      keywordGroups[kw].matches.push({
        id: match.id,
        title: match.title,
        url: match.url,
        source: match.source,
        lead_score: match.lead_score,
        lead_bucket: match.lead_bucket,
        created_at: match.created_at,
      })
    }

    // Sort groups by match count descending
    const groups = Object.values(keywordGroups).sort(
      (a, b) => b.matches.length - a.matches.length
    )

    return NextResponse.json({
      intent,
      totalMatches: filtered.length,
      keywords: groups,
    })
  } catch (error) {
    console.error('Intent API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    )
  }
}
