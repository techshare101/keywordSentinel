export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runFullScan } from '@/lib/scanner'

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

  try {
    const result = await runFullScan()
    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    console.error('Cron scan error:', error)
    return NextResponse.json({
      ok: false,
      error: (error as Error).message,
    }, { status: 500 })
  }
}
