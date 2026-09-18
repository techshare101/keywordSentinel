import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllConnectors } from '@/lib/signal-map/connectors'
import { extractDomainsFromICP } from '@/lib/signal-map/utils'
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
  const { icp_description, seed_domains: rawSeedDomains = [] } = body

  if (!icp_description || icp_description.trim().length < 10) {
    return NextResponse.json({ error: 'ICP description must be at least 10 characters' }, { status: 400 })
  }

  // Clean provided seed domains and auto-extract from ICP if none provided
  const cleanedSeedDomains = rawSeedDomains.map((d: string) => 
    d.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  ).filter(Boolean)

  const effectiveSeedDomains = cleanedSeedDomains.length > 0 
    ? cleanedSeedDomains 
    : extractDomainsFromICP(icp_description)

  // Create the report
  const { data: report, error: reportError } = await supabase
    .from('signal_reports')
    .insert({
      user_id: user.id,
      icp_description: icp_description.trim(),
      seed_domains: effectiveSeedDomains,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  let finalStatus = 'failed'
  let functionError: string | null = null

  // Run all connectors in parallel with global error handling
  try {
    // Run all connectors in parallel
    const connectors = getAllConnectors()
    const input = {
      icp_description: icp_description.trim(),
      seed_domains: report.seed_domains,
      report_id: report.id,
      user_id: user.id,
    }

    console.log(`[Signal Map] Starting report ${report.id} with ${connectors.length} connectors`)

    const results = await Promise.allSettled(
      connectors.map(async (connector) => {
        try {
          console.log(`[Signal Map] Running connector: ${connector.id}`)
          const result = await connector.fetch(input)
          console.log(`[Signal Map] Connector ${connector.id} completed:`, {
            status: result.status,
            sections: result.section_type,
            sources_count: result.sources.length,
            raw_fetches_count: result.raw_fetches.length,
          })
          return result
        } catch (error) {
          console.error(`[Signal Map] Connector ${connector.id} failed:`, error)
          throw error
        }
      })
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
          const { error: rawFetchError } = await supabase
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

          if (rawFetchError) {
            console.error(`[Signal Map] Failed to store raw fetches for ${connector.id}:`, rawFetchError)
          }
        }

        // Store section
        const { error: sectionError } = await supabase
          .from('signal_sections')
          .insert({
            report_id: report.id,
            section_type: sectionResult.section_type,
            status: sectionResult.status,
            data: sectionResult.data,
            sources: sectionResult.sources,
            error_message: sectionResult.error_message || null,
          })

        if (sectionError) {
          console.error(`[Signal Map] Failed to store section for ${connector.id}:`, sectionError)
          errorCount++
        } else {
          if (sectionResult.status === 'completed') completedCount++
          else if (sectionResult.status === 'no_data') noDataCount++
        }
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
    if (errorCount === connectors.length) {
      finalStatus = 'failed'
    } else if (errorCount > 0 || noDataCount > 0) {
      finalStatus = completedCount > 0 ? 'partial' : 'failed'
    } else {
      finalStatus = 'completed'
    }

    console.log(`[Signal Map] Report ${report.id} determined final status: ${finalStatus}`)
  } catch (error) {
    console.error('[Signal Map] Fatal error during report generation:', error)
    finalStatus = 'failed'
    functionError = error instanceof Error ? error.message : 'Unknown error'
  }

  // Always update report status (outside try/catch so it always runs)
  console.log(`[Signal Map] Updating report ${report.id} status to ${finalStatus}`)
  const { error: statusUpdateError } = await supabase
    .from('signal_reports')
    .update({
      status: finalStatus,
      error_message: functionError,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', report.id)

  if (statusUpdateError) {
    console.error(`[Signal Map] CRITICAL: Failed to update report ${report.id} status:`, statusUpdateError)
  }

  if (finalStatus === 'failed') {
    return NextResponse.json({ 
      error: 'Failed to generate report',
      details: functionError || 'Unknown error'
    }, { status: 500 })
  }

  // Fetch the full report with sections
  const { data: fullReport, error: fetchError } = await supabase
    .from('signal_reports')
    .select('*, sections:signal_sections(*)')
    .eq('id', report.id)
    .single()

  if (fetchError) {
    console.error(`[Signal Map] Failed to fetch full report ${report.id}:`, fetchError)
    return NextResponse.json({ 
      error: 'Report generated but failed to fetch results',
      report_id: report.id
    }, { status: 500 })
  }

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
