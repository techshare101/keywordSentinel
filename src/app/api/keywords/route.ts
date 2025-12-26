import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { keyword } = body

  if (!keyword || typeof keyword !== 'string') {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })
  }

  // Check user's keyword limit
  const { data: profile } = await supabase
    .from('users')
    .select('keywords_limit')
    .eq('id', user.id)
    .single()

  const { count } = await supabase
    .from('keywords')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count && profile && count >= profile.keywords_limit) {
    return NextResponse.json(
      { error: 'Keyword limit reached. Upgrade to add more.' },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from('keywords')
    .insert({
      user_id: user.id,
      keyword: keyword.trim().toLowerCase(),
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Keyword already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
