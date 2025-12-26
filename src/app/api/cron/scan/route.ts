import { NextResponse } from 'next/server'
import { runFullScan } from '@/lib/services/scanner'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  
  if (!authHeader) {
    return new NextResponse('Missing auth header', { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  
  if (token !== process.env.CRON_SECRET) {
    return new NextResponse('Invalid cron secret', { status: 401 })
  }

  try {
    console.log('Starting scheduled scan...')
    const startTime = Date.now()
    
    const results = await runFullScan()
    
    const duration = Date.now() - startTime
    
    console.log(`Scan completed in ${duration}ms:`, results)
    
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      duration: `${duration}ms`,
      usersScanned: results.usersScanned,
      totalMatches: results.totalMatches,
    })
  } catch (error) {
    console.error('Cron scan error:', error)
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Scan failed', 
        message: (error as Error).message 
      },
      { status: 500 }
    )
  }
}
