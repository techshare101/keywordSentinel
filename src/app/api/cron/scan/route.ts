export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  
  if (!authHeader) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '').trim()
  
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET env var missing' }, { status: 500 })
  }

  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Invalid cron secret' }, { status: 401 })
  }

  // Debug: Check env vars
  const debugInfo: Record<string, any> = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
  }

  try {
    // Create Supabase client directly here for debugging
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Test query: count users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
    
    debugInfo.usersCount = users?.length || 0
    debugInfo.usersError = usersError?.message || null

    // Test query: count active keywords
    const { data: keywords, error: keywordsError } = await supabase
      .from('keywords')
      .select('id, keyword, is_active')
      .eq('is_active', true)
    
    debugInfo.keywordsCount = keywords?.length || 0
    debugInfo.keywordsError = keywordsError?.message || null
    debugInfo.keywordsSample = keywords?.slice(0, 3).map(k => k.keyword) || []

    return NextResponse.json({
      ok: true,
      debug: debugInfo,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      debug: debugInfo,
      error: (error as Error).message,
    }, { status: 500 })
  }
}
