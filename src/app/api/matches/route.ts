import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const sentiment = searchParams.get('sentiment')
    const bucket = searchParams.get('bucket') // hot, warm, or all
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Cap at 100
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('matches')
      .select('*, keywords(keyword)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (source && source !== 'all') {
      query = query.eq('source', source)
    }

    if (sentiment && sentiment !== 'all') {
      query = query.eq('sentiment', sentiment)
    }

    if (bucket && bucket !== 'all') {
      query = query.eq('lead_bucket', bucket)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Matches API] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch matches', code: 'QUERY_ERROR' }, 
        { status: 500 }
      )
    }

    // Add cache headers for better performance
    const response = NextResponse.json({ 
      data, 
      count, 
      limit, 
      offset,
      hasMore: count ? offset + limit < count : false
    })
    
    // Cache for 30 seconds on client, revalidate in background
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    
    return response
  } catch (error) {
    console.error('[Matches API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ids, is_read } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array required', code: 'INVALID_INPUT' }, 
        { status: 400 }
      )
    }

    // Cap batch size to prevent abuse
    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 IDs per request', code: 'BATCH_TOO_LARGE' }, 
        { status: 400 }
      )
    }

    const { error, count } = await supabase
      .from('matches')
      .update({ is_read, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Matches API] Update error:', error)
      return NextResponse.json(
        { error: 'Failed to update matches', code: 'UPDATE_ERROR' }, 
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, updated: ids.length })
  } catch (error) {
    console.error('[Matches API] PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
