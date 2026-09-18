import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

const DIRECTORY_DOMAINS = [
  'yelp.com', 'google.com', 'healthgrades.com', 'realself.com', 'glowupfinder.com',
  'webmd.com', 'zocdoc.com', 'vitals.com', 'wellness.com', 'mapquest.com',
  'yellowpages.com', 'bbb.org', 'facebook.com', 'instagram.com', 'tiktok.com',
  'birdeye.com', 'tripadvisor.com', 'nextdoor.com', 'groupon.com', 'booksy.com',
]

const CATEGORY_STANDARD_SERVICES: Record<string, string> = {
  default: 'Morpheus8',
}

const HIGH_TICKET_SERVICES = [
  'morpheus8', 'morpheus 8', 'ultherapy', 'emsculpt', 'sculptra', 'coolsculpting',
  'cooltone', 'thread lift', 'kybella', 'prp', 'laser hair removal', 'dermal fillers',
  'microneedling', 'hydrafacial', 'chemical peel', 'botox',
]

/* ------------------------------------------------------------------ *
 * Verdict model
 *
 * Ordered worst -> best. Aggregation across engines takes the worst
 * verdict any engine produced for that question, so one engine
 * confirming does not mask another contradicting.
 * ------------------------------------------------------------------ */

export type ClaimStatus =
  | 'contradiction'
  | 'foreign_source'
  | 'source_conflict'
  | 'unsupported'
  | 'not_named'
  | 'partial'
  | 'cant_confirm'
  | 'confirmed'

const SEVERITY: ClaimStatus[] = [
  'contradiction',
  'foreign_source',
  'source_conflict',
  'unsupported',
  'not_named',
  'partial',
  'cant_confirm',
  'confirmed',
]

function worst(statuses: ClaimStatus[]): ClaimStatus {
  for (const s of SEVERITY) if (statuses.includes(s)) return s
  return 'cant_confirm'
}

/* ------------------------------------------------------------------ *
 * Engine calls — retry with exponential backoff, per question
 * ------------------------------------------------------------------ */

type EngineAnswer = { text: string; citations: string[] }
type EngineName = 'Perplexity' | 'OpenAI' | 'Gemini'

const RETRYABLE = [408, 409, 429, 500, 502, 503, 504]

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, base = 1000): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const retryable = err instanceof HttpError && RETRYABLE.includes(err.status)
      if (!retryable || i === attempts - 1) throw err
      await sleep(base * Math.pow(2, i) + Math.random() * 250)
    }
  }
  throw lastErr
}

async function queryPerplexity(prompt: string): Promise<EngineAnswer> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    }),
  })
  if (!res.ok) throw new HttpError(res.status, `Perplexity ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const cites =
    data.citations ||
    data.search_results?.map((r: any) => r.url) ||
    []
  return { text: data.choices?.[0]?.message?.content ?? '', citations: cites }
}

async function queryOpenAI(prompt: string): Promise<EngineAnswer> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    }),
  })
  if (!res.ok) throw new HttpError(res.status, `OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { text: data.choices?.[0]?.message?.content ?? '', citations: [] }
}

async function queryGemini(prompt: string): Promise<EngineAnswer> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) throw new HttpError(res.status, `Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? ''
  const citations: string[] =
    data.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((c: any) => c.web?.uri)
      .filter(Boolean) ?? []
  return { text, citations }
}

const ENGINES: { name: EngineName; enabled: boolean; run: (p: string) => Promise<EngineAnswer> }[] = [
  { name: 'Perplexity', enabled: !!process.env.PERPLEXITY_API_KEY, run: queryPerplexity },
  { name: 'OpenAI', enabled: !!process.env.OPENAI_API_KEY, run: queryOpenAI },
  { name: 'Gemini', enabled: !!process.env.GEMINI_API_KEY, run: queryGemini },
]

/* ------------------------------------------------------------------ *
 * Site scraping — homepage plus likely service/pricing pages
 * ------------------------------------------------------------------ */

async function scrapePage(url: string): Promise<string> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })
  if (!res.ok) throw new HttpError(res.status, `Firecrawl ${res.status}`)
  const data = await res.json()
  return data.data?.markdown || data.data?.content || ''
}

async function scrapeSite(website: string): Promise<{ content: string; pages: string[] }> {
  const base = website.startsWith('http') ? website : `https://${website}`
  const root = base.replace(/\/+$/, '')
  const candidates = [root, `${root}/services`, `${root}/pricing`, `${root}/menu`]
  const results = await Promise.allSettled(candidates.map((u) => withRetry(() => scrapePage(u), 2, 800)))
  const pages: string[] = []
  const chunks: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.trim().length > 0) {
      pages.push(candidates[i])
      chunks.push(r.value)
    }
  })
  return { content: chunks.join('\n\n'), pages }
}

/* ------------------------------------------------------------------ *
 * Typed extraction — the core fix.
 *
 * The old classifier compared an AI sentence against a scraped keyword
 * blob, so almost everything fell through to cant_confirm. We now pull
 * typed values from both sides and compare like with like.
 * ------------------------------------------------------------------ */

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isOfficialCitation(citation: string, clinicDomain: string): boolean {
  if (!clinicDomain) return false // guard: empty domain used to match everything
  const domain = getDomain(citation)
  return domain === clinicDomain || domain.endsWith(`.${clinicDomain}`)
}

function isDirectoryCitation(citation: string): boolean {
  const domain = getDomain(citation)
  return DIRECTORY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

function extractPhones(text: string): string[] {
  const raw = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []
  return Array.from(new Set(raw.map(normalizePhone).filter((d) => d.length === 10)))
}

/** "9:00 AM" / "9am" / "17:00" -> minutes since midnight */
function toMinutes(raw: string): number | null {
  const m = raw.toLowerCase().match(/(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const mer = m[3]
  if (mer === 'pm' && h < 12) h += 12
  if (mer === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function extractTimes(text: string): number[] {
  const raw = text.match(/\d{1,2}(?::|\.)\d{2}\s*(?:am|pm)?|\b\d{1,2}\s*(?:am|pm)\b/gi) || []
  return Array.from(new Set(raw.map(toMinutes).filter((n): n is number => n !== null)))
}

function extractPrices(text: string): number[] {
  const raw = text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g) || []
  return Array.from(new Set(raw.map((p) => parseFloat(p.replace(/[$,\s]/g, '')))))
}

function extractServices(text: string): string[] {
  const lower = text.toLowerCase()
  return HIGH_TICKET_SERVICES.filter((s) => lower.includes(s))
}

function extractAddress(text: string): string | null {
  const m = text.match(
    /\d+\s+[A-Za-z0-9\s.,#-]{3,60}?(?:Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Circle|Cir|Parkway|Pkwy)\b[^\n]{0,60}?\b[A-Z]{2}\s*\d{5}/i
  )
  return m ? m[0].replace(/\s+/g, ' ').trim() : null
}

function normalizeAddress(a: string): string {
  return a
    .toLowerCase()
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bsuite\b|\bste\b|\bunit\b|#/g, '')
    .replace(/[^a-z0-9]/g, '')
}

type QuestionKind = 'hours' | 'contact' | 'service' | 'services' | 'booking'

function questionKind(q: string, targetService: string | null, categoryService: string | null): QuestionKind {
  const l = q.toLowerCase()
  if (l.includes('hour')) return 'hours'
  if (l.includes('phone') || l.includes('address')) return 'contact'
  if (l.includes('book') || l.includes('appointment')) return 'booking'
  if (targetService && l.includes(targetService.toLowerCase())) return 'service'
  if (categoryService && l.includes(categoryService.toLowerCase())) return 'service'
  return 'services'
}

function namedService(q: string, targetService: string | null, categoryService: string | null): string | null {
  const l = q.toLowerCase()
  if (targetService && l.includes(targetService.toLowerCase())) return targetService
  if (categoryService && l.includes(categoryService.toLowerCase())) return categoryService
  return null
}

const HEDGES = [
  "i don't have", "i do not have", "i don't see", "i couldn't find", "cannot find",
  "unable to find", "no information", "not publicly", "i'm not able to",
  "i don't know", "no specific information",
]

function isHedged(answer: string): boolean {
  const l = answer.toLowerCase()
  return HEDGES.some((h) => l.includes(h))
}

function mentionsClinic(answer: string, clinicName: string): boolean {
  const tokens = clinicName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3 && !['medical', 'spa', 'clinic', 'aesthetics', 'center'].includes(t))
  if (tokens.length === 0) return answer.toLowerCase().includes(clinicName.toLowerCase())
  return tokens.some((t) => answer.toLowerCase().includes(t))
}

/* ------------------------------------------------------------------ *
 * Classifier — ordered rules, first match wins.
 *
 * A verdict covers EVERY claim in the answer, not just the first one.
 * An answer that names a real service but attaches four prices the
 * site never states is UNSUPPORTED, not CONFIRMED.
 * ------------------------------------------------------------------ */

export function classifyClaim(opts: {
  answer: string
  citations: string[]
  question: string
  clinicName: string
  clinicDomain: string
  siteContent: string
  targetService: string | null
  categoryService: string | null
}): { status: ClaimStatus; reason: string } {
  const {
    answer, citations, question, clinicName, clinicDomain,
    siteContent, targetService, categoryService,
  } = opts

  const official = citations.filter((c) => isOfficialCitation(c, clinicDomain))
  const directory = citations.filter(isDirectoryCitation)
  const foreign = citations.filter(
    (c) => !isOfficialCitation(c, clinicDomain) && !isDirectoryCitation(c)
  )
  const foreignOnly = citations.length > 0 && official.length === 0 && directory.length === 0

  // 1. AI never names the clinic
  if (!mentionsClinic(answer, clinicName)) {
    return { status: 'not_named', reason: 'Answer does not name the clinic.' }
  }

  // 2. Answered entirely from someone else's pages
  if (foreignOnly && foreign.length > 0) {
    return {
      status: 'foreign_source',
      reason: `Answered using unrelated sources: ${foreign.map(getDomain).join(', ')}.`,
    }
  }

  const kind = questionKind(question, targetService, categoryService)
  const hasSite = siteContent.trim().length > 0

  if (!hasSite) return { status: 'cant_confirm', reason: 'No site content to compare against.' }

  /* ---- hours ---- */
  if (kind === 'hours') {
    const aiTimes = extractTimes(answer)
    const siteTimes = extractTimes(siteContent)
    if (aiTimes.length === 0 || siteTimes.length === 0) {
      return { status: 'cant_confirm', reason: 'No comparable hours on one side.' }
    }
    const extra = aiTimes.filter((t) => !siteTimes.includes(t))
    if (extra.length === 0) return { status: 'confirmed', reason: 'All stated hours appear on the site.' }
    // AI itself attributes the divergent hours to third parties
    const attributesThirdParty =
      directory.length > 0 ||
      /third[- ]party|listing|directory|other sources|some sources/i.test(answer)
    if (attributesThirdParty) {
      return {
        status: 'source_conflict',
        reason: 'Third-party listings show hours that differ from the official site.',
      }
    }
    return { status: 'contradiction', reason: 'Stated hours differ from the official site.' }
  }

  /* ---- phone / address / booking ---- */
  if (kind === 'contact' || kind === 'booking') {
    const aiPhones = extractPhones(answer)
    const sitePhones = extractPhones(siteContent)
    const aiAddr = extractAddress(answer)
    const siteAddr = extractAddress(siteContent)

    const checks: boolean[] = []
    if (aiPhones.length && sitePhones.length) {
      checks.push(aiPhones.every((p) => sitePhones.includes(p)))
    }
    if (aiAddr && siteAddr) {
      checks.push(normalizeAddress(aiAddr) === normalizeAddress(siteAddr))
    }
    if (checks.length === 0) {
      return { status: 'cant_confirm', reason: 'No comparable contact details on one side.' }
    }
    if (checks.every(Boolean)) return { status: 'confirmed', reason: 'Contact details match the site.' }
    if (checks.some(Boolean)) return { status: 'partial', reason: 'Some contact details match, others do not.' }
    if (directory.length > 0) {
      return { status: 'source_conflict', reason: 'Directory listings carry different contact details.' }
    }
    return { status: 'contradiction', reason: 'Contact details differ from the official site.' }
  }

  /* ---- one named service ---- */
  if (kind === 'service') {
    const service = (namedService(question, targetService, categoryService) || '').toLowerCase()
    const aiSaysYes = answer.toLowerCase().includes(service) && !/does not (?:appear to )?offer|no (?:public )?(?:evidence|indication)/i.test(answer)
    const siteHasIt = siteContent.toLowerCase().includes(service)
    const aiPrices = extractPrices(answer)
    const sitePrices = extractPrices(siteContent)

    // AI asserts the service the site never mentions
    if (aiSaysYes && !siteHasIt) {
      return {
        status: 'unsupported',
        reason: `AI states the clinic offers ${service}${aiPrices.length ? ` at ${aiPrices.map((p) => `$${p}`).join(', ')}` : ''}, but the site does not list it.`,
      }
    }
    // Service matches, but prices are asserted with no basis on the site
    if (aiSaysYes && siteHasIt && aiPrices.length > 0) {
      const unbacked = aiPrices.filter((p) => !sitePrices.includes(p))
      if (unbacked.length > 0) {
        return {
          status: 'unsupported',
          reason: `Prices stated with no basis on the site: ${unbacked.map((p) => `$${p}`).join(', ')}.`,
        }
      }
    }
    if (aiSaysYes && siteHasIt) return { status: 'confirmed', reason: 'Service and any prices match the site.' }
    if (!aiSaysYes && siteHasIt) {
      return { status: 'cant_confirm', reason: `AI could not confirm ${service}, though the site lists it.` }
    }
    return { status: 'cant_confirm', reason: 'Neither side asserts the service.' }
  }

  /* ---- general services ---- */
  const aiServices = extractServices(answer)
  const siteServices = extractServices(siteContent)
  if (siteServices.length === 0) {
    return { status: 'cant_confirm', reason: 'No recognisable services on the site.' }
  }
  const invented = aiServices.filter((s) => !siteServices.includes(s))
  const missed = siteServices.filter((s) => !aiServices.includes(s))
  if (invented.length > 0) {
    return { status: 'unsupported', reason: `AI lists services the site does not: ${invented.join(', ')}.` }
  }
  if (aiServices.length === 0) {
    return isHedged(answer)
      ? { status: 'cant_confirm', reason: 'AI has no service information.' }
      : { status: 'cant_confirm', reason: 'AI named no recognisable services.' }
  }
  if (missed.length > 0) {
    return { status: 'partial', reason: `AI omits services the site lists: ${missed.join(', ')}.` }
  }
  return { status: 'confirmed', reason: 'Service list matches the site.' }
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

function extractTargetService(siteContent: string): string | null {
  const lower = siteContent.toLowerCase()
  for (const s of HIGH_TICKET_SERVICES) if (lower.includes(s)) return s
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clinic_name, location, website, category = 'default' } = body

    if (!clinic_name || !location) {
      return NextResponse.json({ error: 'clinic_name and location are required' }, { status: 400 })
    }

    const clinicDomain = website ? getDomain(website) : ''

    let siteContent = ''
    let scrapedPages: string[] = []
    let scrapeError: string | null = null
    if (website) {
      try {
        const scraped = await scrapeSite(website)
        siteContent = scraped.content
        scrapedPages = scraped.pages
        if (!siteContent) scrapeError = 'Scrape returned no content.'
      } catch (err: any) {
        scrapeError = err.message
      }
    }

    const targetService = extractTargetService(siteContent)
    const categoryService = CATEGORY_STANDARD_SERVICES[category] || CATEGORY_STANDARD_SERVICES.default

    const questions = [
      `What are ${clinic_name} hours in ${location}?`,
      targetService
        ? `Does ${clinic_name} offer ${targetService}, and what does it cost?`
        : `What treatments does ${clinic_name} offer in ${location}?`,
      `Does ${clinic_name} offer ${categoryService}, and what does it cost?`,
      `How do I book a first appointment at ${clinic_name} in ${location}?`,
      `What is ${clinic_name} phone number and address in ${location}?`,
      `What treatments or services does ${clinic_name} offer in ${location}?`,
    ]

    const active = ENGINES.filter((e) => e.enabled)

    // Per engine, per question, independently retried. One failed question
    // no longer discards the other five.
    const runs = await Promise.all(
      active.map(async (engine) => {
        const answers = await Promise.all(
          questions.map(async (q) => {
            try {
              return { ok: true as const, value: await withRetry(() => engine.run(q)) }
            } catch (err: any) {
              return { ok: false as const, error: err.message as string, status: err?.status }
            }
          })
        )
        const okCount = answers.filter((a) => a.ok).length
        const firstErr = answers.find((a) => !a.ok) as any
        return {
          engine: engine.name,
          answers,
          status:
            okCount === questions.length
              ? ('ok' as const)
              : okCount > 0
              ? ('partial' as const)
              : firstErr?.status === 429
              ? ('quota' as const)
              : ('failed' as const),
          answered: okCount,
          error: okCount === questions.length ? null : firstErr?.error ?? null,
        }
      })
    )

    const engineStatus = runs.map((r) => ({
      engine: r.engine,
      status: r.status,
      answered: r.answered,
      of: questions.length,
      error: r.error,
    }))

    const workingEngines = runs.filter((r) => r.answered > 0).length

    const summary: Record<ClaimStatus, number> = {
      contradiction: 0, foreign_source: 0, source_conflict: 0, unsupported: 0,
      not_named: 0, partial: 0, cant_confirm: 0, confirmed: 0,
    }

    const claims = questions.map((question, i) => {
      const perEngine = runs
        .map((r) => {
          const a = r.answers[i]
          if (!a.ok) return null
          const { status, reason } = classifyClaim({
            answer: a.value.text,
            citations: a.value.citations,
            question,
            clinicName: clinic_name,
            clinicDomain,
            siteContent,
            targetService,
            categoryService,
          })
          return {
            engine: r.engine,
            answer: a.value.text,
            citations: a.value.citations,
            status,
            reason,
          }
        })
        .filter(Boolean) as {
          engine: string; answer: string; citations: string[]; status: ClaimStatus; reason: string
        }[]

      if (perEngine.length === 0) {
        summary.cant_confirm++
        return {
          question,
          status: 'cant_confirm' as ClaimStatus,
          reason: 'No engine answered this question.',
          engines: [],
          ai_answer: 'No engine answered this question.',
          site_fact: null,
          ai_citations: [], foreign_citations: [], directory_citations: [], official_citations: [],
        }
      }

      const status = worst(perEngine.map((e) => e.status))
      const decisive = perEngine.find((e) => e.status === status)!
      summary[status]++

      return {
        question,
        status,
        reason: decisive.reason,
        engines: perEngine,
        agreement: new Set(perEngine.map((e) => e.status)).size === 1,
        // back-compat fields for the existing UI
        ai_answer: decisive.answer,
        site_fact: null,
        ai_citations: decisive.citations,
        official_citations: decisive.citations.filter((c) => isOfficialCitation(c, clinicDomain)),
        directory_citations: decisive.citations.filter(isDirectoryCitation),
        foreign_citations: decisive.citations.filter(
          (c) => !isOfficialCitation(c, clinicDomain) && !isDirectoryCitation(c)
        ),
      }
    })

    const sellable =
      summary.contradiction + summary.unsupported + summary.source_conflict +
      summary.foreign_source + summary.not_named

    return NextResponse.json({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      clinic_name,
      location,
      website: website || null,
      clinic_domain: clinicDomain || null,
      target_service: targetService,
      category_service: categoryService,
      scraped_pages: scrapedPages,
      scrape_error: scrapeError,
      claims,
      engine_status: engineStatus,
      working_engines: workingEngines,
      // A single engine is a probe, not a report. The UI must not present
      // absence or contradiction findings to a clinic on one engine alone.
      report_grade: workingEngines >= 2 ? 'reportable' : 'probe_only',
      sellable_findings: sellable,
      summary,
      completed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Clinic check error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
