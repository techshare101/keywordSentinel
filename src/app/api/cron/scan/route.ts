export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for full scans

import { NextResponse } from 'next/server'
import { runFullScan } from '@/lib/services/scanner'

/**
 * Vercel CRON endpoint for automated scans
 * Runs every 30 minutes (configured in vercel.json)
 * 
 * PRODUCTION ONLY - This endpoint should only run on production Vercel deployment
 * 
 * Authentication: Vercel automatically adds Authorization header
 * Fallback: Also accepts CRON_SECRET_KEY for manual testing
 */
export async function GET(req: Request) {
  // Environment check - only run in production
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  
  if (!isProduction && !process.env.ALLOW_DEV_CRON) {
    console.log('[CRON] Skipping scan - not in production environment')
    return NextResponse.json({ 
      ok: false, 
      skipped: true,
      reason: 'CRON jobs only run in production',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV
    })
  }

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  const cronSecretHeader = req.headers.get('x-cron-secret')
  
  // Check for Vercel CRON_SECRET or our CRON_SECRET_KEY
  const expectedSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
  
  if (!expectedSecret) {
    console.error('[CRON] No CRON_SECRET or CRON_SECRET_KEY configured')
    return NextResponse.json({ error: 'CRON secret not configured' }, { status: 500 })
  }

  // Validate authorization
  const token = authHeader?.replace('Bearer ', '').trim()
  const isAuthorized = token === expectedSecret || cronSecretHeader === expectedSecret

  if (!isAuthorized) {
    console.warn('[CRON] Unauthorized scan attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[CRON] Starting scheduled full scan...')
  const startTime = Date.now()

  try {
    const result = await runFullScan()
    
    console.log(`[CRON] Scan complete: ${result.keywordsScanned} keywords, ${result.totalMatches} matches, ${result.duration}`)
    
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('[CRON] Scan error:', error)
    return NextResponse.json({
      ok: false,
      error: (error as Error).message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    }, { status: 500 })
  }
}
