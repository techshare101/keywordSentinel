import { NextResponse } from 'next/server'
import { runFullScan, scanKeywordsForUser } from '@/lib/services/scanner'

// API route for triggering scans
// Can be called by Supabase cron jobs or external schedulers

export async function POST(request: Request) {
  try {
    // Verify the request is authorized (use a secret key in production)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.CRON_SECRET_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { userId } = body

    let result

    if (userId) {
      // Scan specific user
      const results = await scanKeywordsForUser(userId)
      result = {
        userId,
        keywordsScanned: results.length,
        matchesFound: results.reduce((sum, r) => sum + r.matchesFound, 0),
        alertsSent: results.reduce((sum, r) => sum + r.alertsSent, 0),
      }
    } else {
      // Full scan for all users
      result = await runFullScan()
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Scan failed', message: (error as Error).message },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'KeywordSentinel Scanner',
    timestamp: new Date().toISOString(),
  })
}
