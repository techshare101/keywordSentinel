'use client'

import { useState } from 'react'
import { Stethoscope, Search, Loader2, AlertTriangle, HelpCircle, Globe, Download, ChevronDown, ChevronUp } from 'lucide-react'
import jsPDF from 'jspdf'

interface ClaimResult {
  question: string
  ai_answer: string
  site_fact: string | null
  status: 'contradiction' | 'unsupported' | 'cant_confirm' | 'foreign_source'
  ai_citations: string[]
  foreign_citations: string[]
  raw_response: string
}

interface ClinicCheckResult {
  id: string
  clinic_name: string
  location: string
  website: string
  target_service: string | null
  claims: ClaimResult[]
  engine_status: { engine: string; status: 'ok' | 'failed' | 'quota' }[]
  completed_at: string
  summary: { contradictions: number; unsupported: number; cant_confirm: number; foreign_source: number }
}

export default function ClinicCheckPage() {
  const [clinicName, setClinicName] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ClinicCheckResult | null>(null)
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null)

  const runCheck = async () => {
    if (!clinicName || !location) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/clinic-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_name: clinicName,
          location: location,
          website: website || undefined,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      alert(err.message || 'Failed to run check')
    } finally {
      setLoading(false)
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'contradiction': return <AlertTriangle className="h-5 w-5 text-red-400" />
      case 'unsupported': return <AlertTriangle className="h-5 w-5 text-amber-400" />
      case 'foreign_source': return <Globe className="h-5 w-5 text-pink-400" />
      case 'cant_confirm': return <HelpCircle className="h-5 w-5 text-slate-400" />
      default: return <HelpCircle className="h-5 w-5 text-slate-400" />
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'contradiction': return { text: 'CONTRADICTION', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
      case 'unsupported': return { text: 'UNSUPPORTED', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
      case 'foreign_source': return { text: 'FOREIGN SOURCE', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' }
      case 'cant_confirm': return { text: "CAN'T CONFIRM", color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
      default: return { text: 'UNKNOWN', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
    }
  }

  const downloadPDF = () => {
    if (!result) return
    const doc = new jsPDF()
    const pw = doc.internal.pageSize.getWidth()
    const m = 20
    let y = m

    // Header
    doc.setFillColor(10, 10, 15)
    doc.rect(0, 0, pw, 55, 'F')
    doc.setTextColor(0, 212, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Clinic AI Check', m, y + 12)
    doc.setTextColor(200, 200, 200)
    doc.setFontSize(11)
    doc.text(result.clinic_name + ' \u2014 ' + result.location, m, y + 22)
    if (result.website) doc.text(result.website, m, y + 29)
    if (result.target_service) {
      doc.setTextColor(236, 72, 153)
      doc.setFontSize(10)
      doc.text('Target service: ' + result.target_service, m, y + 36)
      y += 7
    }
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(9)
    doc.text('Generated: ' + new Date(result.completed_at).toLocaleString(), m, y + 36)

    y = 65

    // Engine status
    doc.setTextColor(0, 212, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Engines Used:', m, y)
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    result.engine_status.forEach(e => {
      const statusText = e.status === 'ok' ? '(answered)' : e.status === 'quota' ? '(quota exceeded)' : '(failed)'
      doc.setTextColor(180, 180, 180)
      doc.text(`${e.engine} ${statusText}`, m + 3, y)
      y += 5
    })
    y += 8

    // Summary
    doc.setTextColor(236, 72, 153)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', m, y)
    y += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 100, 100)
    doc.text(`Contradictions: ${result.summary.contradictions}`, m + 3, y)
    y += 6
    doc.setTextColor(255, 160, 0)
    doc.text(`Unsupported claims: ${result.summary.unsupported}`, m + 3, y)
    y += 6
    doc.setTextColor(255, 105, 180)
    doc.text(`Foreign source: ${result.summary.foreign_source}`, m + 3, y)
    y += 6
    doc.setTextColor(180, 180, 180)
    doc.text(`Can't confirm: ${result.summary.cant_confirm}`, m + 3, y)
    y += 12

    // Claims
    result.claims.forEach((claim, i) => {
      if (y > 245) { doc.addPage(); y = m }

      const sl = statusLabel(claim.status)
      doc.setFillColor(15, 15, 20)
      doc.rect(m - 3, y - 4, pw - 2 * m + 6, 8, 'F')
      doc.setTextColor(0, 212, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Q${i + 1}: ${claim.question}`, m, y + 1)
      y += 10

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 200, 200)
      const aiLines = doc.splitTextToSize('AI says: ' + claim.ai_answer.slice(0, 300), pw - 2 * m - 6)
      doc.text(aiLines, m + 3, y)
      y += aiLines.length * 4 + 2

      if (claim.site_fact) {
        doc.setTextColor(168, 85, 247)
        const siteLines = doc.splitTextToSize('Site says: ' + claim.site_fact.slice(0, 200), pw - 2 * m - 6)
        doc.text(siteLines, m + 3, y)
        y += siteLines.length * 4 + 2
      }

      if (claim.foreign_citations.length > 0) {
        doc.setTextColor(255, 105, 180)
        const foreignDomains = claim.foreign_citations.slice(0, 3).map(getDomain).join(', ')
        doc.text(`Cited: ${foreignDomains}`, m + 3, y)
        y += 5
      }

      if (sl.text === 'CONTRADICTION') { doc.setTextColor(255, 100, 100) }
      else if (sl.text === 'UNSUPPORTED') { doc.setTextColor(255, 160, 0) }
      else if (sl.text === 'FOREIGN SOURCE') { doc.setTextColor(255, 105, 180) }
      else { doc.setTextColor(180, 180, 180) }
      doc.setFont('helvetica', 'bold')
      doc.text(sl.text, m + 3, y)
      y += 12
    })

    // Footer
    if (y > 270) { doc.addPage(); y = m }
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Generated by KeywordSentinel Clinic AI Check \u2014 ' + result.id, m, 288)

    doc.save(`clinic-check-${result.clinic_name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          Clinic AI Check
        </h1>
        <p className="text-slate-400 mt-2">
          Check what AI says about one clinic. Find contradictions, unsupported claims, and citations from the wrong site.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Clinic Name *</label>
            <input
              type="text"
              placeholder="e.g., AesthetIQ Med Spa"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Location *</label>
            <input
              type="text"
              placeholder="e.g., Oakdale MN"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Website * (enables comparison and dynamic service selection)</label>
          <input
            type="text"
            placeholder="e.g., aesthetiqmedspa.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <button
          onClick={runCheck}
          disabled={loading || !clinicName || !location || !website}
          className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 font-semibold text-white hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Checking AI responses...</>
          ) : (
            <><Search className="h-4 w-4" /> Run Clinic Check</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white">{result.clinic_name}</h2>
              <span className="text-sm text-slate-400">{result.location}</span>
            </div>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>

          {result.target_service && (
            <div className="text-sm text-pink-400">
              Target service pulled from site: <span className="font-semibold">{result.target_service}</span>
            </div>
          )}

          {/* Engine status */}
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="text-slate-500">Engines:</span>
            {result.engine_status.map(e => (
              <span key={e.engine} className={`px-2 py-0.5 rounded text-xs border ${
                e.status === 'ok' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                e.status === 'quota' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                'text-red-400 bg-red-500/10 border-red-500/20'
              }`}>
                {e.engine} {e.status === 'ok' ? '\u2713' : e.status === 'quota' ? '\u26a0 quota' : '\u2717'}
              </span>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{result.summary.contradictions}</div>
              <div className="text-xs text-slate-400 mt-1">Contradictions</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{result.summary.unsupported}</div>
              <div className="text-xs text-slate-400 mt-1">Unsupported</div>
            </div>
            <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-pink-400">{result.summary.foreign_source}</div>
              <div className="text-xs text-slate-400 mt-1">Foreign Source</div>
            </div>
            <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-slate-400">{result.summary.cant_confirm}</div>
              <div className="text-xs text-slate-400 mt-1">Can't Confirm</div>
            </div>
          </div>

          {/* Claims */}
          <div className="space-y-3">
            {result.claims.map((claim, i) => {
              const sl = statusLabel(claim.status)
              const isExpanded = expandedClaim === i
              return (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <button
                    onClick={() => setExpandedClaim(isExpanded ? null : i)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(claim.status)}
                      <div>
                        <div className="text-sm text-slate-300 font-medium">{claim.question}</div>
                        <div className={`inline-block mt-1 text-xs px-2 py-0.5 rounded border ${sl.color}`}>
                          {sl.text}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
                      <div className="pt-3">
                        <div className="text-xs font-semibold text-cyan-400 mb-1">AI SAYS:</div>
                        <p className="text-sm text-slate-200 leading-relaxed">{claim.ai_answer}</p>
                      </div>
                      {claim.site_fact && (
                        <div>
                          <div className="text-xs font-semibold text-purple-400 mb-1">SITE SAYS:</div>
                          <p className="text-sm text-slate-200 leading-relaxed">{claim.site_fact}</p>
                        </div>
                      )}
                      {claim.foreign_citations.length > 0 && (
                        <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-3">
                          <div className="text-xs font-semibold text-pink-400 mb-1">FOREIGN SOURCES:</div>
                          <p className="text-xs text-slate-300 mb-2">
                            AI answered about this clinic using pages from other websites:
                          </p>
                          <div className="space-y-1">
                            {claim.foreign_citations.slice(0, 5).map((c, j) => (
                              <a key={j} href={c} target="_blank" rel="noopener noreferrer" className="block text-xs text-pink-400/80 hover:text-pink-400 truncate">
                                {getDomain(c)}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {claim.ai_citations.length > 0 && claim.foreign_citations.length === 0 && (
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">SOURCES:</div>
                          <div className="space-y-1">
                            {claim.ai_citations.slice(0, 5).map((c, j) => (
                              <a key={j} href={c} target="_blank" rel="noopener noreferrer" className="block text-xs text-cyan-400/70 hover:text-cyan-400 truncate">
                                {getDomain(c)}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <details className="text-xs">
                        <summary className="text-slate-500 cursor-pointer hover:text-slate-400">Raw response</summary>
                        <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-slate-400 whitespace-pre-wrap text-xs max-h-40 overflow-auto border border-slate-800">
                          {claim.raw_response}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Timestamp */}
          <div className="text-xs text-slate-600 text-center pt-2">
            Report ID: {result.id} \u2014 {new Date(result.completed_at).toLocaleString()}
          </div>
        </div>
      )}
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
