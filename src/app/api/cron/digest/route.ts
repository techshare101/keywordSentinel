export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { sendAllWeeklyDigests } from '@/lib/services/digest'

/**
 * CRON endpoint for sending email digests
 * 
 * PRODUCTION ONLY - This endpoint should only run on production Vercel deployment
 * 
 * Schedule: Weekly on Mondays at 9am (configured in vercel.json)
 * Can also be triggered manually for testing
 */
export async function GET(req: Request) {
  // Environment check - only run in production
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  
  if (!isProduction && !process.env.ALLOW_DEV_CRON) {
    console.log('[DIGEST CRON] Skipping - not in production environment')
    return NextResponse.json({ 
      ok: false, 
      skipped: true,
      reason: 'CRON jobs only run in production',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV
    })
  }

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  const cronSecretHeader = req.headers.get('x-cron-secret')
  
  const expectedSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
  
  if (!expectedSecret) {
    console.error('[DIGEST CRON] No CRON secret configured')
    return NextResponse.json({ error: 'CRON secret not configured' }, { status: 500 })
  }

  const token = authHeader?.replace('Bearer ', '').trim()
  const isAuthorized = token === expectedSecret || cronSecretHeader === expectedSecret

  if (!isAuthorized) {
    console.warn('[DIGEST CRON] Unauthorized attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[DIGEST CRON] Starting weekly digest send...')
  const startTime = Date.now()

  try {
    const result = await sendAllWeeklyDigests()
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[DIGEST CRON] Complete: ${result.sent} sent, ${result.failed} failed in ${duration}s`)
    
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      sent: result.sent,
      failed: result.failed,
      duration: `${duration}s`,
    })
  } catch (error) {
    console.error('[DIGEST CRON] Error:', error)
    return NextResponse.json({
      ok: false,
      error: (error as Error).message,
    }, { status: 500 })
  }
}
