import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPlanById, PLANS } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's plan info
  const { data: profile } = await supabase
    .from('users')
    .select('plan, keywords_limit')
    .eq('id', user.id)
    .single()

  const userPlan = profile?.plan || 'free'
  const planData = getPlanById(userPlan)
  const keywordLimit = profile?.keywords_limit || planData?.keywords || 3

  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return keywords with usage info
  return NextResponse.json({
    keywords: data,
    usage: {
      current: data?.length || 0,
      limit: keywordLimit,
      plan: userPlan,
    }
  })
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

  // Get user's plan and keyword limit
  const { data: profile } = await supabase
    .from('users')
    .select('plan, keywords_limit')
    .eq('id', user.id)
    .single()

  const userPlan = profile?.plan || 'free'
  const planData = getPlanById(userPlan)
  const keywordLimit = profile?.keywords_limit || planData?.keywords || 3

  const { count } = await supabase
    .from('keywords')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count !== null && count >= keywordLimit) {
    // Determine upgrade suggestion
    let suggestedPlan = 'starter'
    if (userPlan === 'starter') suggestedPlan = 'pro'
    else if (userPlan === 'pro') suggestedPlan = 'business'
    else if (userPlan === 'business') suggestedPlan = 'enterprise'

    const nextPlanData = getPlanById(suggestedPlan)
    
    return NextResponse.json(
      { 
        error: 'Keyword limit reached',
        code: 'KEYWORD_LIMIT_REACHED',
        current: count,
        limit: keywordLimit,
        plan: userPlan,
        upgrade: {
          plan: suggestedPlan,
          limit: nextPlanData?.keywords || 'unlimited',
          price: nextPlanData?.price || 'custom',
        }
      },
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
