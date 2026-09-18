'use client'

import { useState } from 'react'
import {
  Stethoscope, Search, Loader2, AlertTriangle, HelpCircle, Globe, Download,
  CheckCircle2, FileX, ShieldAlert, CircleSlash, MinusCircle, Info,
} from 'lucide-react'
import jsPDF from 'jspdf'

type ClaimStatus =
  | 'contradiction' | 'foreign_source' | 'source_conflict' | 'unsupported'
  | 'not_named' | 'partial' | 'cant_confirm' | 'confirmed'

interface EngineStatus {
  engine: string
  status: 'ok' | 'partial' | 'failed' | 'quota'
  answered: number
  of: number
  error: string | null
}

interface EngineClaim {
  engine: string
  answer: string
  citations: string[]
  status: ClaimStatus
  reason: string
}

interface Claim {
  question: string
  check: string
  evidence: 'full' | 'thin'
  engines_answered: number
  engines_attempted: number
  decisive_engine: string | null
  status: ClaimStatus
  reason: string
  engines: EngineClaim[]
  agreement?: boolean
  ai_answer: string
  site_fact: string | null
  ai_citations: string[]
  foreign_citations: string[]
  directory_citations: string[]
  official_citations: string[]
}

interface Report {
  id: string
  business_name: string
  clinic_name: string
  vertical: string
  vertical_label: string
  site_services: string[]
  location: string
  website: string | null
  target_service: string | null
  category_service: string | null
  scraped_pages: string[]
  scrape_error: string | null
  claims: Claim[]
  engine_status: EngineStatus[]
  working_engines: number
  min_engines_for_finding: number
  thin_claims: number
  report_grade: 'reportable' | 'probe_only'
  sellable_findings: number
  completed_at: string
  summary: Record<ClaimStatus, number>
}

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; icon: any }> = {
  contradiction: { label: 'CONTRADICTION', color: '#f87171', icon: AlertTriangle },
  foreign_source: { label: 'FOREIGN SOURCE', color: '#f472b6', icon: Globe },
  source_conflict: { label: 'SOURCE CONFLICT', color: '#a78bfa', icon: ShieldAlert },
  unsupported: { label: 'UNSUPPORTED', color: '#fbbf24', icon: FileX },
  not_named: { label: 'NOT NAMED', color: '#fb923c', icon: CircleSlash },
  partial: { label: 'PARTIAL', color: '#38bdf8', icon: MinusCircle },
  cant_confirm: { label: "CAN'T CONFIRM", color: '#94a3b8', icon: HelpCircle },
  confirmed: { label: 'CONFIRMED', color: '#34d399', icon: CheckCircle2 },
}

// Findings worth putting in front of a clinic owner, worst first.
const FINDING_TILES: ClaimStatus[] = [
  'contradiction', 'foreign_source', 'source_conflict', 'unsupported',
]
const CONTEXT_TILES: ClaimStatus[] = ['not_named', 'partial', 'confirmed', 'cant_confirm']

const TILE_LABELS: Record<ClaimStatus, string> = {
  contradiction: 'Contradictions',
  foreign_source: 'Foreign Sources',
  source_conflict: 'Source Conflicts',
  unsupported: 'Unsupported',
  not_named: 'Not Named',
  partial: 'Partial',
  confirmed: 'Confirmed',
  cant_confirm: "Can't Confirm",
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function ClinicCheckPage() {
  const [clinicName, setClinicName] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runCheck = async () => {
    if (!clinicName || !location) {
      setError('Clinic name and location are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/clinic-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: clinicName, location, website }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to run clinic check')
      }
      setReport(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = () => {
    if (!report) return
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const W = doc.internal.pageSize.getWidth()
    const m = 40
    let y = m

    const paintPage = () => {
      doc.setFillColor(10, 10, 15)
      doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F')
    }
    paintPage()

    doc.setTextColor(244, 114, 182)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Business AI Check', m, y)
    y += 28

    doc.setTextColor(226, 232, 240)
    doc.setFontSize(14)
    doc.text(report.business_name || report.clinic_name, m, y)
    y += 16
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text(`${report.location} \u2014 ${report.website || 'no website'}`, m, y)
    y += 20

    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Engines: ${report.engine_status.map((e) => `${e.engine} ${e.answered}/${e.of}`).join('  |  ')}`,
      m, y
    )
    y += 13
    doc.text(`Checked: ${new Date(report.completed_at).toLocaleString()}`, m, y)
    y += 22

    if (report.report_grade === 'probe_only') {
      doc.setTextColor(251, 191, 36)
      doc.setFontSize(9)
      doc.text(
        'PROBE ONLY \u2014 fewer than two engines answered. Not a finished report.',
        m, y
      )
      y += 20
    }

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.text(
      `Findings: ${report.sellable_findings}   \u00b7   Confirmed: ${report.summary.confirmed}   \u00b7   Can't confirm: ${report.summary.cant_confirm}`,
      m, y
    )
    y += 22

    for (const claim of report.claims) {
      if (y > 660) { doc.addPage(); paintPage(); y = m }

      const cfg = STATUS_CONFIG[claim.status]
      const r = parseInt(cfg.color.slice(1, 3), 16)
      const g = parseInt(cfg.color.slice(3, 5), 16)
      const b = parseInt(cfg.color.slice(5, 7), 16)

      doc.setDrawColor(30, 41, 59)
      doc.roundedRect(m, y, W - m * 2, 118, 6, 6, 'S')

      doc.setTextColor(r, g, b)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(cfg.label, m + 10, y + 16)

      doc.setTextColor(226, 232, 240)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(doc.splitTextToSize(claim.question, W - m * 2 - 20), m + 10, y + 34)

      doc.setTextColor(203, 213, 225)
      doc.setFontSize(8)
      doc.text(doc.splitTextToSize(`Why: ${claim.reason}`, W - m * 2 - 20), m + 10, y + 52)

      doc.setTextColor(148, 163, 184)
      doc.text(
        doc.splitTextToSize(`AI: ${claim.ai_answer.slice(0, 400)}`, W - m * 2 - 20),
        m + 10, y + 72
      )

      if (claim.directory_citations.length || claim.foreign_citations.length) {
        doc.setTextColor(167, 139, 250)
        const cites = [...claim.directory_citations, ...claim.foreign_citations]
          .map(getDomain).slice(0, 6).join(', ')
        doc.text(`Sources: ${cites}`, m + 10, y + 108)
      }

      y += 132
    }

    doc.save(`ai-check-${(report.business_name || report.clinic_name).toLowerCase().replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Business AI Check</h1>
            <p className="text-slate-400">One business. What AI can and cannot verify about it.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { v: clinicName, set: setClinicName, ph: 'Business name' },
            { v: location, set: setLocation, ph: 'Location (e.g. Oakdale MN)' },
            { v: website, set: setWebsite, ph: 'Website (recommended)' },
          ].map((f, i) => (
            <input
              key={i}
              type="text"
              placeholder={f.ph}
              value={f.v}
              onChange={(e) => f.set(e.target.value)}
              className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
            />
          ))}
        </div>

        <button
          onClick={runCheck}
          disabled={loading}
          className="mb-8 px-6 py-3 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-xl font-semibold text-white flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          {loading ? 'Running\u2026' : 'Run Clinic Check'}
        </button>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div>
        )}

        {report && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">{report.business_name || report.clinic_name}</h2>
                  {report.vertical_label && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs border border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                      {report.vertical_label}
                    </span>
                  )}
                </div>
                <p className="text-slate-400">{report.location} \u2014 {report.website || 'no website'}</p>
                {report.site_services?.length > 0 && (
                  <p className="text-slate-500 text-xs mt-1">
                    Services read from site ({report.site_services.length}): {report.site_services.slice(0, 8).join(', ')}
                    {report.site_services.length > 8 ? '\u2026' : ''}
                  </p>
                )}
                {report.target_service && (
                  <p className="text-pink-400 text-sm mt-1">Probed service from site: {report.target_service}</p>
                )}
                {report.category_service && (
                  <p className="text-amber-400 text-sm">Category-standard check: {report.category_service}</p>
                )}
                {report.scraped_pages?.length > 0 && (
                  <p className="text-slate-500 text-xs mt-1">
                    Scraped: {report.scraped_pages.map(getDomain).length} page(s) \u2014 {report.scraped_pages.join(', ')}
                  </p>
                )}
                {report.scrape_error && (
                  <p className="text-amber-400/80 text-xs mt-1">Site scrape: {report.scrape_error}</p>
                )}
              </div>
              <button
                onClick={downloadPDF}
                className="shrink-0 px-4 py-2 border border-cyan-500/30 text-cyan-400 rounded-xl flex items-center gap-2 hover:bg-cyan-500/10"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>

            {report.report_grade === 'probe_only' && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex gap-3">
                <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200">
                  <strong>Probe only.</strong> Fewer than two engines answered, so this is not a
                  finished report. Do not send absence or contradiction findings to a clinic on one
                  engine alone.
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {report.engine_status.map((e) => (
                <span
                  key={e.engine}
                  title={e.error || ''}
                  className={`px-3 py-1 rounded-lg text-xs border ${
                    e.status === 'ok'
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : e.status === 'partial'
                      ? 'border-sky-500/30 text-sky-400 bg-sky-500/10'
                      : e.status === 'quota'
                      ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      : 'border-red-500/30 text-red-400 bg-red-500/10'
                  }`}
                >
                  {e.engine} {e.answered}/{e.of}
                </span>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Findings <span className="text-slate-600">\u00b7 corroborated by {report.min_engines_for_finding}+ engines</span>
                </div>
                {report.thin_claims > 0 && (
                  <div className="text-xs text-amber-400/80">
                    {report.thin_claims} claim(s) too thin to count
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {FINDING_TILES.map((k) => {
                  const cfg = STATUS_CONFIG[k]
                  return (
                    <div key={k} className="rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: cfg.color }}>{report.summary[k]}</div>
                      <div className="text-xs text-slate-400 mt-1">{TILE_LABELS[k]}</div>
                    </div>
                  )
                })}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mt-6 mb-2">Context</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {CONTEXT_TILES.map((k) => {
                  const cfg = STATUS_CONFIG[k]
                  return (
                    <div key={k} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: cfg.color }}>{report.summary[k]}</div>
                      <div className="text-xs text-slate-500 mt-1">{TILE_LABELS[k]}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              {report.claims.map((claim, i) => {
                const cfg = STATUS_CONFIG[claim.status]
                const Icon = cfg.icon
                return (
                  <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
                    <div className="p-5 flex gap-4">
                      <Icon className="h-5 w-5 mt-1 shrink-0" style={{ color: cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className="px-2.5 py-0.5 rounded-md text-xs font-bold"
                            style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
                          >
                            {cfg.label}
                          </span>
                          {claim.check && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] border border-slate-700 text-slate-500 uppercase tracking-wide">
                              {claim.check.replace(/_/g, ' ')}
                            </span>
                          )}
                          {claim.evidence === 'thin' && claim.engines_answered > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] border border-amber-500/30 text-amber-400">
                              thin \u2014 {claim.engines_answered}/{claim.engines_attempted} engines
                            </span>
                          )}
                          {claim.engines.length > 1 && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] border ${
                              claim.agreement
                                ? 'border-emerald-500/30 text-emerald-400'
                                : 'border-amber-500/30 text-amber-400'
                            }`}>
                              {claim.agreement ? 'engines agree' : 'engines disagree'}
                            </span>
                          )}
                        </div>

                        <p className="text-white font-medium mb-1">{claim.question}</p>
                        <p className="text-slate-400 text-sm mb-4">{claim.reason}</p>

                        <div className="space-y-3">
                          {claim.engines.map((e, j) => {
                            const ecfg = STATUS_CONFIG[e.status]
                            return (
                              <div key={j} className="rounded-lg border border-slate-800 bg-black/20 p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-cyan-400">{e.engine}</span>
                                  <span className="text-[10px] font-semibold" style={{ color: ecfg.color }}>
                                    {ecfg.label}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-sm">{e.answer}</p>
                                {e.citations.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {e.citations.slice(0, 8).map((c, k) => (
                                      <a
                                        key={k}
                                        href={c}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[11px] text-purple-300 hover:text-purple-200 underline"
                                      >
                                        {getDomain(c)}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
