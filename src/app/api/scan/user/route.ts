import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scanKeywordsForUser } from '@/lib/services/scanner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for scans with crawler fallback

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await scanKeywordsForUser(user.id)

    return NextResponse.json({
      success: true,
      keywordsScanned: results.length,
      matchesFound: results.reduce((sum, r) => sum + r.matchesFound, 0),
      alertsSent: results.reduce((sum, r) => sum + r.alertsSent, 0),
    })
  } catch (error) {
    console.error('User scan error:', error)
    return NextResponse.json(
      { error: 'Scan failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}
