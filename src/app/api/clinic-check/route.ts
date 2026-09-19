import { NextRequest, NextResponse } from 'next/server'
import {
  VERTICALS, detectVertical, extractServicesFromSite, pickTargetService,
  buildQuestions, extractServiceArea, extractCredentials, claimsEmergency,
  type Vertical, type UniversalCheck,
} from '@/lib/verticals'

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

/** Every configured service across all verticals — used only to spot an
 *  answer naming something the business's own site never mentions. */
const VERTICAL_ALL_SERVICES: string[] = Array.from(
  new Set(Object.values(VERTICALS).flatMap((v) => v.services))
)

/** A finding needs corroboration from at least this many engines to be
 *  presentable. Below it the claim is reported but marked thin, and it is
 *  excluded from the findings tiles so the same inputs cannot produce
 *  different headline numbers run to run. */
const MIN_ENGINES_FOR_FINDING = 2

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

/** Verdicts that are presented to a business owner as findings. */
const FINDING_STATUSES: ClaimStatus[] = [
  'contradiction', 'foreign_source', 'source_conflict', 'unsupported', 'not_named',
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

/**
 * Run tasks with bounded concurrency and a stagger between starts.
 *
 * Firing every question at one engine simultaneously is what produced
 * "Perplexity 3/7": the burst trips per-second rate limits, and retrying
 * inside the same burst trips them again. Two at a time, staggered, is
 * slower per run and dramatically more complete.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  staggerMs: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async (_, w) => {
    await sleep(w * staggerMs)
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
      await sleep(staggerMs)
    }
  })
  await Promise.all(workers)
  return results
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4, base = 2000): Promise<T> {
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
  // Responses API with web search. A plain chat-completions call has no
  // live access, so it either abstains or answers from stale training
  // data — neither reflects what a customer sees in ChatGPT.
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1',
      input: prompt,
      tools: [{ type: 'web_search' }],
    }),
  })
  if (!res.ok) throw new HttpError(res.status, `OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()

  let text: string = data.output_text ?? ''
  const citations = new Set<string>()
  for (const item of data.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === 'string' && !text) text += c.text
      for (const a of c.annotations ?? []) {
        if (a.url) citations.add(a.url)
      }
    }
  }
  return { text, citations: Array.from(citations) }
}

async function queryGemini(prompt: string): Promise<EngineAnswer> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Without this, Gemini answers from parametric memory and invents
        // addresses and prices. Consumer Gemini searches. An ungrounded
        // call does not represent what a real user is shown, so any
        // finding drawn from it is not defensible to a business owner.
        tools: [{ google_search: {} }],
      }),
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

/**
 * Entity collision — the finding hiding inside the Morpheus8 row.
 *
 * Perplexity answered about "AesthetIQ Med Spa, Oakdale MN" using
 * theaesthetiq.ai, aesthetiqph.com and njplasticsurg.com: different
 * companies that share or resemble the brand name. The old rule missed
 * it because mapquest.com was also cited, and one directory citation
 * was enough to suppress FOREIGN_SOURCE.
 *
 * A specific factual assertion about a business with ZERO citations from
 * that business's own domain is not supportable, whatever else is cited.
 */
function brandTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !GENERIC_NAME_TOKENS.includes(t))
}

function looksLikeBrandCollision(citations: string[], businessName: string, businessDomain: string): string[] {
  const tokens = brandTokens(businessName)
  if (tokens.length === 0) return []
  return citations.filter((c) => {
    const d = getDomain(c)
    if (!d || d === businessDomain) return false
    if (isDirectoryCitation(c)) return false
    const host = d.replace(/\./g, '')
    return tokens.some((t) => host.includes(t))
  })
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

function extractServices(text: string, vocabulary: string[]): string[] {
  const lower = text.toLowerCase()
  return vocabulary.filter((s) => lower.includes(s.toLowerCase()))
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

function namedService(q: string, targetService: string | null, categoryService: string | null): string | null {
  const l = q.toLowerCase()
  if (targetService && l.includes(targetService.toLowerCase())) return targetService
  if (categoryService && l.includes(categoryService.toLowerCase())) return categoryService
  return null
}

/** Business-name tokens that carry no identifying signal in any vertical. */
const GENERIC_NAME_TOKENS = [
  'medical', 'spa', 'clinic', 'aesthetics', 'center', 'centre', 'plumbing',
  'electric', 'electrical', 'heating', 'cooling', 'hvac', 'roofing', 'dental',
  'services', 'service', 'company', 'group', 'llc', 'inc', 'corp', 'associates',
  'solutions', 'contractors', 'construction', 'brothers', 'sons', 'the', 'and',
]

/**
 * An engine declining to answer is an abstention, not a finding.
 *
 * OpenAI without browsing answers most current-fact questions with
 * "I don't have real-time access... check their website." Treating that
 * as CAN'T CONFIRM let one engine's own limitation override another
 * engine's verified CONFIRMED, which is why phone, booking and pricing
 * came back CAN'T CONFIRM while Perplexity had matched every field.
 */
const ABSTENTIONS = [
  "real-time", "real time", "don't have access", "do not have access",
  "no access to", "cannot browse", "can't browse", "unable to browse",
  "recommend checking", "recommend visiting", "recommend contacting",
  "best to visit", "best to contact", "i'm not able to access",
  "i don't have current", "i do not have current", "as of my last update",
  "my training data", "knowledge cutoff",
]

export function isAbstention(answer: string): boolean {
  const l = answer.toLowerCase()
  return ABSTENTIONS.some((a) => l.includes(a))
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
    .filter((t) => t.length > 3 && !GENERIC_NAME_TOKENS.includes(t))
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
  check: UniversalCheck
  businessName: string
  businessDomain: string
  siteContent: string
  siteServices: string[]
  targetService: string | null
  categoryService: string | null
}): { status: ClaimStatus; reason: string } {
  const {
    answer, citations, question, check, businessName, businessDomain,
    siteContent, siteServices, targetService, categoryService,
  } = opts
  const clinicName = businessName
  const clinicDomain = businessDomain

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

  const hasSite = siteContent.trim().length > 0

  if (!hasSite) return { status: 'cant_confirm', reason: 'No site content to compare against.' }

  /* ---- hours ---- */
  if (check === 'hours') {
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
  if (check === 'contact' || check === 'booking') {
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
  if (check === 'named_service' || check === 'category_probe') {
    const collisions = looksLikeBrandCollision(citations, clinicName, clinicDomain)
    if (collisions.length > 0 && official.length === 0) {
      return {
        status: 'foreign_source',
        reason: `Answered using look-alike brands, not this business: ${collisions.map(getDomain).join(', ')}.`,
      }
    }
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

  /* ---- service area (trades) ---- */
  if (check === 'service_area') {
    const aiAreas = extractServiceArea(answer).map((a) => a.toLowerCase())
    const siteAreas = extractServiceArea(siteContent).map((a) => a.toLowerCase())
    if (siteAreas.length === 0 || aiAreas.length === 0) {
      return { status: 'cant_confirm', reason: 'No stated service area on one side.' }
    }
    const invented = aiAreas.filter((a) => !siteAreas.some((s) => s.includes(a) || a.includes(s)))
    if (invented.length > 0) {
      return {
        status: 'unsupported',
        reason: `AI claims coverage the site does not state: ${invented.slice(0, 6).join(', ')}.`,
      }
    }
    const missed = siteAreas.filter((a) => !aiAreas.some((s) => s.includes(a) || a.includes(s)))
    if (missed.length > 0) {
      return { status: 'partial', reason: `AI omits areas the site lists: ${missed.slice(0, 6).join(', ')}.` }
    }
    return { status: 'confirmed', reason: 'Service area matches the site.' }
  }

  /* ---- credentials / license numbers ---- */
  if (check === 'credentials') {
    const aiLic = extractCredentials(answer)
    const siteLic = extractCredentials(siteContent)
    if (aiLic.length === 0) {
      return { status: 'cant_confirm', reason: 'AI states no license number.' }
    }
    if (siteLic.length === 0) {
      // A fabricated licence number is the most damaging thing AI can say
      // about a trade. Never let this pass as confirmed.
      return {
        status: 'unsupported',
        reason: `AI states license ${aiLic.join(', ')} with no basis on the site.`,
      }
    }
    const wrong = aiLic.filter((l) => !siteLic.includes(l))
    if (wrong.length > 0) {
      return { status: 'contradiction', reason: `AI states license ${wrong.join(', ')}; the site states ${siteLic.join(', ')}.` }
    }
    return { status: 'confirmed', reason: 'License number matches the site.' }
  }

  /* ---- emergency / after-hours availability ---- */
  if (check === 'emergency') {
    const aiYes = /\b(?:yes|24[\/\s-]?7|24 hours|emergency service|after[- ]hours)\b/i.test(answer)
      && !/\b(?:no|does not|doesn't|not offer)\b/i.test(answer.slice(0, 120))
    const siteYes = claimsEmergency(siteContent)
    if (aiYes && siteYes) return { status: 'confirmed', reason: 'Emergency availability matches the site.' }
    if (aiYes && !siteYes) {
      return { status: 'unsupported', reason: 'AI claims emergency availability the site never states.' }
    }
    if (!aiYes && siteYes) {
      return { status: 'cant_confirm', reason: 'AI could not confirm emergency service the site advertises.' }
    }
    return { status: 'cant_confirm', reason: 'Neither side claims emergency service.' }
  }

  /* ---- pricing ---- */
  if (check === 'pricing') {
    const aiPrices = extractPrices(answer)
    const sitePrices = extractPrices(siteContent)
    if (aiPrices.length === 0) return { status: 'cant_confirm', reason: 'AI states no prices.' }
    if (sitePrices.length === 0) {
      return {
        status: 'unsupported',
        reason: `AI states prices with no basis on the site: ${aiPrices.slice(0, 6).map((p) => `$${p}`).join(', ')}.`,
      }
    }
    const unbacked = aiPrices.filter((p) => !sitePrices.includes(p))
    if (unbacked.length > 0) {
      return { status: 'unsupported', reason: `Prices not on the site: ${unbacked.slice(0, 6).map((p) => `$${p}`).join(', ')}.` }
    }
    return { status: 'confirmed', reason: 'Stated prices match the site.' }
  }

  /* ---- general services ---- */
  if (
    citations.length > 0 &&
    official.length === 0 &&
    /their (?:official )?site|their website|on their page/i.test(answer)
  ) {
    return {
      status: 'foreign_source',
      reason: `Describes "their site" while citing none of it: ${citations.slice(0, 5).map(getDomain).join(', ')}.`,
    }
  }
  const aiServices = extractServices(answer, siteServices)
  if (siteServices.length === 0) {
    return { status: 'cant_confirm', reason: 'No services could be read from the site.' }
  }
  const missed = siteServices.filter((s) => !aiServices.includes(s))
  // Anything the AI names that is not on the site, checked against the
  // site's own vocabulary rather than a fixed industry list.
  const invented = extractServices(answer, VERTICAL_ALL_SERVICES).filter(
    (s) => !siteServices.map((x) => x.toLowerCase()).includes(s.toLowerCase())
  )
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // clinic_name kept for back-compat; business_name is the new name.
    const business_name = body.business_name || body.clinic_name
    const { location, website } = body
    const verticalHint: string | undefined = body.vertical || body.category

    if (!business_name || !location) {
      return NextResponse.json({ error: 'business_name and location are required' }, { status: 400 })
    }
    const clinic_name = business_name

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

    // Vertical is detected from the business's own site, not assumed.
    const vertical: Vertical = detectVertical(siteContent, verticalHint)
    const siteServices = extractServicesFromSite(siteContent, vertical)
    const targetService = pickTargetService(siteServices, vertical)
    const categoryService = vertical.categoryStandard || null

    const questionSpecs = buildQuestions({
      business: clinic_name,
      location,
      vertical,
      targetService,
    })
    const questions = questionSpecs.map((q) => q.text)

    const active = ENGINES.filter((e) => e.enabled)

    // Per engine, per question, independently retried. One failed question
    // no longer discards the other five.
    const runs = await Promise.all(
      active.map(async (engine) => {
        const answers = await mapLimit(questions, 2, 600, async (q) => {
          try {
            return { ok: true as const, value: await withRetry(() => engine.run(q)) }
          } catch (err: any) {
            return { ok: false as const, error: err.message as string, status: err?.status }
          }
        })
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

    const claims = questionSpecs.map(({ text: question, check }, i) => {
      let abstained = 0
      const perEngine = runs
        .map((r) => {
          const a = r.answers[i]
          if (!a.ok) return null
          // An engine that declines is excluded from the verdict entirely.
          if (isAbstention(a.value.text)) {
            abstained++
            return null
          }
          const { status, reason } = classifyClaim({
            answer: a.value.text,
            citations: a.value.citations,
            question,
            check,
            businessName: clinic_name,
            businessDomain: clinicDomain,
            siteContent,
            siteServices,
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
          check,
          status: 'cant_confirm' as ClaimStatus,
          evidence: 'thin' as const,
          engines_abstained: abstained,
          engines_answered: 0,
          engines_attempted: runs.length,
          decisive_engine: null,
          reason:
            abstained > 0
              ? `${abstained} engine(s) declined to answer (no live access).`
              : 'No engine answered this question.',
          engines: [],
          ai_answer: 'No engine answered this question.',
          site_fact: null,
          ai_citations: [], foreign_citations: [], directory_citations: [], official_citations: [],
        }
      }

      const status = worst(perEngine.map((e) => e.status))
      const decisive = perEngine.find((e) => e.status === status)!

      // Evidence gate: a finding drawn from one engine is a probe, not a
      // finding. It is still shown, with the engine named, but it does not
      // move the headline counts.
      const isFinding = FINDING_STATUSES.includes(status)
      const evidence: 'full' | 'thin' =
        perEngine.length >= MIN_ENGINES_FOR_FINDING ? 'full' : 'thin'

      if (!isFinding || evidence === 'full') {
        summary[status]++
      } else {
        summary.cant_confirm++
      }

      return {
        question,
        check,
        status,
        evidence,
        engines_abstained: abstained,
        engines_answered: perEngine.length,
        engines_attempted: runs.length,
        // Named so a thin finding can be read honestly: "OpenAI said X,
        // the other engines did not answer."
        decisive_engine: decisive.engine,
        reason:
          evidence === 'thin' && isFinding
            ? `${decisive.reason} (only ${decisive.engine} answered — not corroborated)`
            : decisive.reason,
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
      business_name: clinic_name,
      clinic_name, // back-compat
      vertical: vertical.id,
      vertical_label: vertical.label,
      site_services: siteServices,
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
      report_grade:
        claims.filter((c: any) => c.engines_answered >= MIN_ENGINES_FOR_FINDING).length >=
        Math.ceil(claims.length / 2)
          ? 'reportable'
          : 'probe_only',
      min_engines_for_finding: MIN_ENGINES_FOR_FINDING,
      thin_claims: claims.filter((c: any) => c.evidence === 'thin').length,
      sellable_findings: sellable,
      summary,
      completed_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Clinic check error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
