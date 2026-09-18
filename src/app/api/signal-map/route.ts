import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllConnectors } from '@/lib/signal-map/connectors'
import type { SignalSection, SignalRawFetch } from '@/types/signal-map'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for full report

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { icp_description, seed_domains = [] } = body

  if (!icp_description || icp_description.trim().length < 10) {
    return NextResponse.json({ error: 'ICP description must be at least 10 characters' }, { status: 400 })
  }

  // Create the report
  const { data: report, error: reportError } = await supabase
    .from('signal_reports')
    .insert({
      user_id: user.id,
      icp_description: icp_description.trim(),
      seed_domains: seed_domains.map((d: string) => d.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')),
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  // Run all connectors in parallel
  const connectors = getAllConnectors()
  const input = {
    icp_description: icp_description.trim(),
    seed_domains: report.seed_domains,
    report_id: report.id,
    user_id: user.id,
  }

  const results = await Promise.allSettled(
    connectors.map(connector => connector.fetch(input))
  )

  // Store raw fetches and sections
  let completedCount = 0
  let noDataCount = 0
  let errorCount = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const connector = connectors[i]

    if (result.status === 'fulfilled') {
      const sectionResult = result.value

      // Store raw fetches
      if (sectionResult.raw_fetches.length > 0) {
        await supabase
          .from('signal_raw_fetches')
          .insert(sectionResult.raw_fetches.map((rf) => ({
            report_id: report.id,
            connector_id: connector.id,
            source: rf.source,
            request_url: rf.request_url,
            request_params: rf.request_params,
            response_body: rf.response_body,
            response_status: rf.response_status,
            latency_ms: rf.latency_ms,
          })))
      }

      // Store section
      await supabase
        .from('signal_sections')
        .insert({
          report_id: report.id,
          section_type: sectionResult.section_type,
          status: sectionResult.status,
          data: sectionResult.data,
          sources: sectionResult.sources,
          error_message: sectionResult.error_message || null,
        })

      if (sectionResult.status === 'completed') completedCount++
      else if (sectionResult.status === 'no_data') noDataCount++
    } else {
      // Connector threw an unhandled error
      await supabase
        .from('signal_sections')
        .insert({
          report_id: report.id,
          section_type: connector.section_type,
          status: 'error',
          data: {},
          sources: [],
          error_message: result.reason?.message || 'Unknown error',
        })
      errorCount++
    }
  }

  // Determine final status
  let finalStatus: string
  if (errorCount === connectors.length) {
    finalStatus = 'failed'
  } else if (errorCount > 0 || noDataCount > 0) {
    finalStatus = completedCount > 0 ? 'partial' : 'failed'
  } else {
    finalStatus = 'completed'
  }

  // Update report status
  await supabase
    .from('signal_reports')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', report.id)

  // Fetch the full report with sections
  const { data: fullReport } = await supabase
    .from('signal_reports')
    .select('*, sections:signal_sections(*)')
    .eq('id', report.id)
    .single()

  return NextResponse.json({ report: fullReport })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reportId = req.nextUrl.searchParams.get('id')

  if (reportId) {
    const { data: report, error } = await supabase
      .from('signal_reports')
      .select('*, sections:signal_sections(*)')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ report })
  }

  // List all reports
  const { data: reports } = await supabase
    .from('signal_reports')
    .select('*, sections:signal_sections(section_type, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ reports: reports || [] })
}
