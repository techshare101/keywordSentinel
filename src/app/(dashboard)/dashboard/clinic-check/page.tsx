'use client'

import { useState } from 'react'
import { Stethoscope, Search, Loader2, AlertTriangle, HelpCircle, Globe, Download, CheckCircle2, FileX, ShieldAlert, RefreshCw } from 'lucide-react'
import jsPDF from 'jspdf'

interface EngineStatus {
  engine: string
  status: 'ok' | 'failed' | 'quota'
}

interface Claim {
  question: string
  ai_answer: string
  site_fact: string | null
  status: 'confirmed' | 'contradiction' | 'unsupported' | 'cant_confirm' | 'source_conflict' | 'foreign_source'
  ai_citations: string[]
  foreign_citations: string[]
  directory_citations: string[]
  official_citations: string[]
  raw_response: string
}

interface Report {
  id: string
  clinic_name: string
  location: string
  website: string | null
  target_service: string | null
  category_service: string | null
  claims: Claim[]
  engine_status: EngineStatus[]
  completed_at: string
  summary: {
    confirmed: number
    contradiction: number
    unsupported: number
    cant_confirm: number
    source_conflict: number
    foreign_source: number
  }
}

const STATUS_CONFIG: Record<Claim['status'], { label: string; color: string; icon: any }> = {
  confirmed: { label: 'CONFIRMED', color: '#34d399', icon: CheckCircle2 },
  contradiction: { label: 'CONTRADICTION', color: '#f87171', icon: AlertTriangle },
  unsupported: { label: 'UNSUPPORTED', color: '#fbbf24', icon: FileX },
  cant_confirm: { label: "CAN'T CONFIRM", color: '#94a3b8', icon: HelpCircle },
  source_conflict: { label: 'SOURCE CONFLICT', color: '#a78bfa', icon: ShieldAlert },
  foreign_source: { label: 'FOREIGN SOURCE', color: '#f472b6', icon: Globe },
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
        body: JSON.stringify({ clinic_name: clinicName, location, website }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to run clinic check')
      }
      const data = await res.json()
      setReport(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = () => {
    if (!report) return
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const m = 36
    let y = m

    doc.setFillColor(10, 10, 15)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F')

    doc.setTextColor(244, 114, 182)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Clinic AI Check', m, y)
    y += 32

    doc.setTextColor(226, 232, 240)
    doc.setFontSize(14)
    doc.text(report.clinic_name, m, y)
    y += 18
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text(`${report.location} — ${report.website || 'no website'}`, m, y)
    y += 24

    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text(`Engines: ${report.engine_status.map(e => `${e.engine} ${e.status === 'ok' ? '✓' : '✗'}`).join(' | ')}`, m, y)
    y += 14
    doc.text(`Generated: ${new Date(report.completed_at).toLocaleString()}`, m, y)
    y += 28

    if (report.target_service) {
      doc.setTextColor(244, 114, 182)
      doc.setFontSize(10)
      doc.text(`Target service from site: ${report.target_service}`, m, y)
      y += 18
    }
    if (report.category_service) {
      doc.setTextColor(251, 191, 36)
      doc.setFontSize(10)
      doc.text(`Category-standard check: ${report.category_service}`, m, y)
      y += 18
    }
    y += 10

    const sellableFindings = report.summary.contradiction + report.summary.unsupported + report.summary.source_conflict + report.summary.foreign_source
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.text(`Sellable findings: ${sellableFindings} — Confirmed: ${report.summary.confirmed} — Can't confirm: ${report.summary.cant_confirm}`, m, y)
    y += 24

    for (const claim of report.claims) {
      if (y > 680) {
        doc.addPage()
        doc.setFillColor(10, 10, 15)
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F')
        y = m
      }

      const cfg = STATUS_CONFIG[claim.status]
      const Icon = cfg.icon

      doc.setDrawColor(30, 41, 59)
      doc.setLineWidth(1)
      doc.roundedRect(m, y, doc.internal.pageSize.getWidth() - m * 2, 110, 6, 6, 'S')

      const r = parseInt(cfg.color.slice(1, 3), 16)
      const g = parseInt(cfg.color.slice(3, 5), 16)
      const b = parseInt(cfg.color.slice(5, 7), 16)
      doc.setTextColor(r, g, b)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(cfg.label, m + 8, y + 16)

      doc.setTextColor(226, 232, 240)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const questionLines = doc.splitTextToSize(claim.question, doc.internal.pageSize.getWidth() - m * 2 - 16)
      doc.text(questionLines, m + 8, y + 34)

      doc.setTextColor(148, 163, 184)
      doc.setFontSize(8)
      const aiLines = doc.splitTextToSize(`AI: ${claim.ai_answer}`, doc.internal.pageSize.getWidth() - m * 2 - 16)
      doc.text(aiLines, m + 8, y + 54)

      const siteText = claim.site_fact ? `Site: ${claim.site_fact}` : 'Site: no extractable fact'
      const siteLines = doc.splitTextToSize(siteText, doc.internal.pageSize.getWidth() - m * 2 - 16)
      doc.text(siteLines, m + 8, y + 74)

      if (claim.directory_citations.length > 0) {
        const dirDomains = claim.directory_citations.map(c => new URL(c.startsWith('http') ? c : `https://${c}`).hostname.replace(/^www\./, ''))
        doc.setTextColor(167, 139, 250)
        doc.text(`Directory sources: ${dirDomains.join(', ')}`, m + 8, y + 96)
      }

      y += 124
    }

    doc.save(`clinic-check-${report.clinic_name.toLowerCase().replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Clinic AI Check</h1>
            <p className="text-slate-400">One clinic. Five questions. What AI gets wrong.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <input
            type="text"
            placeholder="Clinic name"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            placeholder="Location (e.g., Oakdale MN)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            placeholder="Website (optional)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <button
          onClick={runCheck}
          disabled={loading}
          className="mb-8 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold text-white flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          {loading ? 'Running...' : 'Run Clinic Check'}
        </button>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
            {error}
          </div>
        )}

        {report && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{report.clinic_name}</h2>
                <p className="text-slate-400">{report.location} — {report.website || 'no website'}</p>
                {report.target_service && (
                  <p className="text-pink-400 text-sm mt-1">Target service from site: {report.target_service}</p>
                )}
                {report.category_service && (
                  <p className="text-amber-400 text-sm mt-1">Category-standard check: {report.category_service}</p>
                )}
              </div>
              <button
                onClick={downloadPDF}
                className="px-4 py-2 border border-cyan-500/30 text-cyan-400 rounded-xl flex items-center gap-2 hover:bg-cyan-500/10"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {report.engine_status.map((e) => (
                <span
                  key={e.engine}
                  className={`px-3 py-1 rounded-lg text-xs border ${
                    e.status === 'ok'
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : e.status === 'quota'
                      ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      : 'border-red-500/30 text-red-400 bg-red-500/10'
                  }`}
                >
                  {e.engine} {e.status === 'ok' ? '✓' : e.status === 'quota' ? 'quota' : '✗'}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'contradiction', label: 'Contradictions' },
                { key: 'unsupported', label: 'Unsupported' },
                { key: 'source_conflict', label: 'Source Conflicts' },
                { key: 'foreign_source', label: 'Foreign Sources' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'cant_confirm', label: "Can't Confirm" },
              ].map(({ key, label }) => {
                const statusKey = key as Claim['status']
                const cfg = STATUS_CONFIG[statusKey]
                return (
                  <div key={key} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: cfg.color }}>{report.summary[key as keyof Report['summary']]}</div>
                    <div className="text-xs text-slate-400 mt-1">{label}</div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-4">
              {report.claims.map((claim, i) => {
                const cfg = STATUS_CONFIG[claim.status]
                const Icon = cfg.icon
                return (
                  <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-900/50 overflow-hidden">
                    <div className="p-5 flex gap-4">
                      <div className="mt-1">
                        <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className="px-2.5 py-0.5 rounded-md text-xs font-bold"
                            style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-white font-medium mb-3">{claim.question}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-cyan-400 text-xs font-bold uppercase mb-1">AI Says</div>
                            <p className="text-slate-300">{claim.ai_answer}</p>
                          </div>
                          <div>
                            <div className="text-purple-400 text-xs font-bold uppercase mb-1">Site Says</div>
                            <p className="text-slate-300">{claim.site_fact || 'No extractable fact'}</p>
                          </div>
                        </div>
                        {claim.directory_citations.length > 0 && (
                          <div className="mt-3 p-3 rounded-lg border border-purple-500/20 bg-purple-500/10">
                            <div className="text-purple-400 text-xs font-bold uppercase mb-1">Directory Sources</div>
                            <div className="flex flex-wrap gap-2">
                              {claim.directory_citations.map((c, j) => (
                                <a key={j} href={c} target="_blank" rel="noreferrer" className="text-xs text-purple-300 hover:text-purple-200 underline">
                                  {getDomain(c)}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {claim.foreign_citations.length > 0 && claim.official_citations.length === 0 && claim.directory_citations.length === 0 && (
                          <div className="mt-3 p-3 rounded-lg border border-pink-500/20 bg-pink-500/10">
                            <div className="text-pink-400 text-xs font-bold uppercase mb-1">Foreign Sources</div>
                            <div className="flex flex-wrap gap-2">
                              {claim.foreign_citations.map((c, j) => (
                                <a key={j} href={c} target="_blank" rel="noreferrer" className="text-xs text-pink-300 hover:text-pink-200 underline">
                                  {getDomain(c)}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
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

function getDomain(url: string): string {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
