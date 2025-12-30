import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendEmailAlert } from '@/lib/services/alerts'

// Founder emails that can use the test alert feature
const FOUNDER_EMAILS = [
  'support@metalmindtech.com',
  'valentinv2000@gmail.com',
  'valentin2v2000@gmail.com',
]

// Create admin client for server-side operations (bypasses RLS)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env vars')
  }

  return createClient(url, key)
}

// Create server client for auth (reads cookies)
async function getSupabaseServer() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

/**
 * POST /api/test-alert
 * Founder-only endpoint to send a test HOT lead email alert
 * This allows founders to verify Resend is working without waiting for real traffic
 */
export async function POST(request: Request) {
  try {
    // Get user from cookies
    const supabaseAuth = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - please log in' }, { status: 401 })
    }

    // Use admin client to query user profile (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin()

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('email, plan')
      .eq('id', user.id)
      .single()

    if (!profile?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Check if user is a founder (by email) or has admin privileges
    const isFounder = FOUNDER_EMAILS.includes(profile.email.toLowerCase())
    const isAdmin = profile.plan === 'enterprise' // Or add an is_admin field
    
    if (!isFounder && !isAdmin) {
      return NextResponse.json({ 
        error: 'This feature is only available to founders',
        hint: 'Contact support if you need access'
      }, { status: 403 })
    }

    // Create a fake HOT lead for testing
    const testMatch = {
      id: 'test-' + Date.now(),
      keyword_id: 'test-keyword',
      user_id: user.id,
      source: 'reddit',
      title: '🧪 TEST ALERT: Looking for a keyword monitoring tool',
      content: 'This is a test alert to verify your email notifications are working correctly. In production, you would see real high-intent conversations here. This test simulates a HOT lead with buying intent.',
      url: 'https://keywordsentinel.com/dashboard/matches',
      author: 'TestUser',
      sentiment: 'positive',
      ai_summary: 'Test user is actively looking for a keyword monitoring solution with clear buying intent. This is exactly the type of high-value opportunity KeywordSentinel alerts you about.',
      lead_score: 85,
      lead_bucket: 'hot',
      created_at: new Date().toISOString(),
      metadata: {
        intent: 'buying',
        why_it_matters: 'This is a test alert - in production, this would be a real opportunity worth acting on.'
      },
      keywords: { keyword: 'TEST KEYWORD' }
    }

    // Send the test email
    console.log(`[Test Alert] Sending test alert to founder: ${profile.email}`)
    const sent = await sendEmailAlert(profile.email, [testMatch as any])

    // Log the test alert to the alerts table
    const alertStatus = sent ? 'sent' : 'failed'
    await supabaseAdmin.from('alerts').insert({
      user_id: user.id,
      match_id: null, // Test alerts don't have a real match
      channel: 'email',
      status: alertStatus,
      is_test: true,
      alert_type: 'test',
      message: 'Test alert to verify email delivery',
      sent_at: new Date().toISOString(),
    })

    if (sent) {
      console.log(`[Test Alert] ✅ Test alert sent successfully to ${profile.email}`)
      return NextResponse.json({ 
        success: true, 
        message: 'Test alert sent successfully',
        email: profile.email
      })
    } else {
      console.error(`[Test Alert] ❌ Failed to send test alert to ${profile.email}`)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send test alert. Check Resend configuration.'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Test Alert] Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
