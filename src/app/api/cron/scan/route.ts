export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runFullScan } from '@/lib/services/scanner'

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  
  if (!authHeader) {
    console.error('❌ Missing Authorization header')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '').trim()
  
  if (!process.env.CRON_SECRET) {
    console.error('❌ CRON_SECRET env var missing')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  if (token !== process.env.CRON_SECRET) {
    console.error('❌ Invalid cron secret')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  console.log('✅ Cron authorized successfully')

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
      keywordsScanned: results.keywordsScanned,
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
