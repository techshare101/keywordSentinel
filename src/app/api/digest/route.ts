import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDigestForUser, sendWeeklyDigest, sendAllWeeklyDigests } from '@/lib/services/digest'

export const dynamic = 'force-dynamic'

// Send digest to a specific user (for testing or manual trigger)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user info
    const { data: profile } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Generate digest
    const digest = await generateDigestForUser(user.id)

    if (!digest) {
      return NextResponse.json({ 
        success: false, 
        message: 'No matches found for digest' 
      })
    }

    // Send email
    const sent = await sendWeeklyDigest(profile.email, profile.full_name || '', digest)

    return NextResponse.json({
      success: sent,
      digest: {
        totalMatches: digest.totalMatches,
        newMatches: digest.newMatches,
        topOpportunities: digest.topOpportunities.length,
        sentiment: digest.sentimentBreakdown,
      },
    })
  } catch (error) {
    console.error('Digest error:', error)
    return NextResponse.json(
      { error: 'Failed to generate digest' },
      { status: 500 }
    )
  }
}

// Cron endpoint to send all weekly digests
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.CRON_SECRET_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await sendAllWeeklyDigests()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Digest cron error:', error)
    return NextResponse.json(
      { error: 'Failed to send digests' },
      { status: 500 }
    )
  }
}
