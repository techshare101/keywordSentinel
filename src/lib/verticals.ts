/**
 * Vertical configuration for Clinic/Business AI Check.
 *
 * Design rule: services are DERIVED FROM THE BUSINESS'S OWN SITE first.
 * The per-vertical vocabulary below is a booster and a fallback, never the
 * source of truth. A trade we have never configured still works, because
 * extractServicesFromSite() reads the site's own navigation and headings.
 */

export type VerticalId =
  | 'medspa' | 'plumbing' | 'electrical' | 'hvac' | 'roofing'
  | 'dental' | 'legal' | 'auto' | 'landscaping' | 'generic'

export interface Vertical {
  id: VerticalId
  label: string
  /** Words that identify this vertical in site copy. */
  signals: string[]
  /** Known high-value services, best-first. Booster only. */
  services: string[]
  /**
   * A service standard for the category that a given business may or may
   * not offer. Used for the over-claim probe: if AI says they do it and
   * the site never mentions it, that is an UNSUPPORTED finding.
   */
  categoryStandard: string
  /** Extra claim types worth checking in this vertical. */
  extraChecks: UniversalCheck[]
}

/**
 * Universal claim types. Every local business has most of these, and each
 * one is verifiable against the business's own site. These are what make
 * the check work across verticals rather than only for med spas.
 */
export type UniversalCheck =
  | 'hours'
  | 'contact'          // phone + address
  | 'booking'          // how a new customer starts
  | 'services'         // what they do
  | 'named_service'    // one service pulled from their own site
  | 'category_probe'   // a category-standard service they may not offer
  | 'service_area'     // which cities/zips they cover
  | 'credentials'      // license #, certifications, insurance
  | 'emergency'        // 24/7 or after-hours availability
  | 'pricing'          // stated prices, fees, estimates

export const UNIVERSAL_CHECKS: UniversalCheck[] = [
  'hours', 'contact', 'booking', 'services', 'named_service', 'category_probe',
]

export const VERTICALS: Record<VerticalId, Vertical> = {
  medspa: {
    id: 'medspa',
    label: 'Med Spa / Aesthetics',
    signals: ['med spa', 'medspa', 'aesthetic', 'injector', 'botox', 'filler', 'skincare clinic'],
    services: [
      'morpheus8', 'ultherapy', 'emsculpt', 'sculptra', 'coolsculpting', 'cooltone',
      'thread lift', 'kybella', 'prp', 'laser hair removal', 'dermal filler',
      'microneedling', 'hydrafacial', 'chemical peel', 'botox',
    ],
    categoryStandard: 'Morpheus8',
    extraChecks: ['pricing'],
  },
  plumbing: {
    id: 'plumbing',
    label: 'Plumbing',
    signals: ['plumber', 'plumbing', 'drain', 'water heater', 'sewer'],
    services: [
      'sewer line replacement', 'trenchless sewer repair', 'water heater installation',
      'tankless water heater', 'repiping', 'sump pump', 'drain cleaning',
      'hydro jetting', 'water softener', 'gas line', 'leak detection',
      'garbage disposal', 'faucet repair', 'toilet repair',
    ],
    categoryStandard: 'trenchless sewer repair',
    extraChecks: ['service_area', 'credentials', 'emergency', 'pricing'],
  },
  electrical: {
    id: 'electrical',
    label: 'Electrical',
    signals: ['electrician', 'electrical contractor', 'wiring', 'panel upgrade'],
    services: [
      'panel upgrade', 'ev charger installation', 'generator installation',
      'whole home rewiring', 'knob and tube replacement', 'surge protection',
      'electrical inspection', 'recessed lighting', 'ceiling fan installation',
      'outlet installation', 'gfci', 'smoke detector installation',
    ],
    categoryStandard: 'EV charger installation',
    extraChecks: ['service_area', 'credentials', 'emergency', 'pricing'],
  },
  hvac: {
    id: 'hvac',
    label: 'HVAC',
    signals: ['hvac', 'heating and cooling', 'furnace', 'air conditioning', 'ductwork'],
    services: [
      'heat pump installation', 'furnace replacement', 'ac installation',
      'ductless mini split', 'duct cleaning', 'air quality', 'thermostat installation',
      'furnace repair', 'ac repair', 'maintenance plan',
    ],
    categoryStandard: 'heat pump installation',
    extraChecks: ['service_area', 'credentials', 'emergency', 'pricing'],
  },
  roofing: {
    id: 'roofing',
    label: 'Roofing',
    signals: ['roofing', 'roofer', 'shingle', 'gutter', 'storm damage'],
    services: [
      'roof replacement', 'metal roofing', 'storm damage repair', 'hail damage',
      'insurance claim', 'gutter installation', 'siding', 'skylight', 'roof inspection',
    ],
    categoryStandard: 'metal roofing',
    extraChecks: ['service_area', 'credentials', 'pricing'],
  },
  dental: {
    id: 'dental',
    label: 'Dental',
    signals: ['dentist', 'dental', 'orthodont', 'oral surgery'],
    services: [
      'dental implants', 'invisalign', 'veneers', 'root canal', 'crowns',
      'teeth whitening', 'periodontal', 'extraction', 'cleaning',
    ],
    categoryStandard: 'dental implants',
    extraChecks: ['credentials', 'pricing'],
  },
  legal: {
    id: 'legal',
    label: 'Legal',
    signals: ['law firm', 'attorney', 'lawyer', 'legal services'],
    services: [
      'personal injury', 'estate planning', 'family law', 'criminal defense',
      'business formation', 'immigration', 'real estate closing', 'probate',
    ],
    categoryStandard: 'estate planning',
    extraChecks: ['service_area', 'credentials'],
  },
  auto: {
    id: 'auto',
    label: 'Auto Service',
    signals: ['auto repair', 'mechanic', 'collision', 'tire shop', 'body shop'],
    services: [
      'transmission repair', 'engine rebuild', 'collision repair', 'adas calibration',
      'brake service', 'alignment', 'diagnostics', 'oil change', 'tire installation',
    ],
    categoryStandard: 'ADAS calibration',
    extraChecks: ['service_area', 'pricing'],
  },
  landscaping: {
    id: 'landscaping',
    label: 'Landscaping',
    signals: ['landscaping', 'lawn care', 'hardscape', 'irrigation', 'snow removal'],
    services: [
      'hardscaping', 'retaining wall', 'paver patio', 'irrigation installation',
      'landscape design', 'sod installation', 'tree removal', 'snow removal',
      'lawn treatment', 'mulching',
    ],
    categoryStandard: 'paver patio',
    extraChecks: ['service_area', 'pricing'],
  },
  generic: {
    id: 'generic',
    label: 'Local Business',
    signals: [],
    services: [],
    categoryStandard: '',
    extraChecks: ['service_area'],
  },
}

/** Pick a vertical from the business's own site copy. */
export function detectVertical(siteContent: string, hint?: string): Vertical {
  if (hint && hint in VERTICALS) return VERTICALS[hint as VerticalId]
  const lower = siteContent.toLowerCase()
  let best: { v: Vertical; score: number } = { v: VERTICALS.generic, score: 0 }
  for (const v of Object.values(VERTICALS)) {
    if (v.id === 'generic') continue
    let score = 0
    for (const s of v.signals) {
      const hits = lower.split(s).length - 1
      score += hits * 3
    }
    for (const s of v.services) if (lower.includes(s)) score += 1
    if (score > best.score) best = { v, score }
  }
  return best.score >= 3 ? best.v : VERTICALS.generic
}

/**
 * Derive the business's actual service list from its own site.
 *
 * This is what makes the tool universal. Markdown headings and nav links
 * on a services page name what the business sells, in the business's own
 * words, with no vocabulary needed in advance.
 */
export function extractServicesFromSite(siteContent: string, vertical: Vertical): string[] {
  const found = new Set<string>()

  // 1. Known vocabulary for the detected vertical (high precision).
  const lower = siteContent.toLowerCase()
  for (const s of vertical.services) if (lower.includes(s)) found.add(s)

  // 2. Markdown headings — "## Water Heater Installation"
  const headings = siteContent.match(/^#{2,4}\s+(.{3,60})$/gm) || []
  for (const h of headings) {
    const text = h.replace(/^#{2,4}\s+/, '').trim().toLowerCase()
    if (isLikelyService(text)) found.add(text)
  }

  // 3. Link labels — "[Drain Cleaning](/services/drain-cleaning)"
  const links = siteContent.match(/\[([^\]]{3,50})\]\(([^)]*\/(?:services?|solutions?)\/[^)]*)\)/gi) || []
  for (const l of links) {
    const m = l.match(/\[([^\]]+)\]/)
    if (m && isLikelyService(m[1].toLowerCase())) found.add(m[1].trim().toLowerCase())
  }

  return Array.from(found).slice(0, 40)
}

const NON_SERVICE_WORDS = [
  'about', 'contact', 'home', 'blog', 'review', 'testimonial', 'career', 'faq',
  'privacy', 'terms', 'financing', 'our team', 'why choose', 'gallery', 'hours',
  'location', 'menu', 'book', 'schedule', 'call', 'get started', 'learn more',
]

function isLikelyService(text: string): boolean {
  if (text.length < 4 || text.length > 60) return false
  if (NON_SERVICE_WORDS.some((w) => text.includes(w))) return false
  if (/^\d/.test(text)) return false
  return /^[a-z0-9&'\-\s/]+$/i.test(text)
}

/**
 * Pick the service to probe from the business's own site — the first
 * vertical-vocabulary hit (ranked high-value first), else the first
 * site-derived service.
 */
export function pickTargetService(siteServices: string[], vertical: Vertical): string | null {
  for (const s of vertical.services) if (siteServices.includes(s)) return s
  return siteServices[0] ?? null
}

/* ------------------------------------------------------------------ *
 * Universal extractors — these work for any local business
 * ------------------------------------------------------------------ */

/** Cities / towns a business claims to serve. */
export function extractServiceArea(text: string): string[] {
  const out = new Set<string>()
  const blocks = text.match(
    /(?:serving|service area|areas? we serve|proudly serve[sd]?)[^.\n]{0,200}/gi
  ) || []
  for (const b of blocks) {
    const cities = b.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?\b/g) || []
    for (const c of cities) {
      const clean = c.trim()
      if (clean.length > 3 && !/^(Serving|Service|Area|Areas|We|Proudly)$/i.test(clean)) {
        out.add(clean)
      }
    }
  }
  return Array.from(out).slice(0, 25)
}

/** License / certification numbers — trades state these, and AI often invents them. */
export function extractCredentials(text: string): string[] {
  const out = new Set<string>()
  const patterns = [
    /\b(?:license|lic\.?|licence|reg(?:istration)?\.?|cert(?:ificate)?\.?)\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z]{0,3}[-\s]?\d{4,10})/gi,
    /\b(?:MN|WI|CA|TX|FL|NY)\s*(?:license|lic)\.?\s*#?\s*([A-Z]{0,3}\d{4,10})/gi,
  ]
  for (const p of patterns) {
    let m
    while ((m = p.exec(text)) !== null) out.add(m[1].replace(/\s+/g, '').toUpperCase())
  }
  return Array.from(out).slice(0, 10)
}

/** Does the business claim 24/7 or emergency availability? */
export function claimsEmergency(text: string): boolean {
  return /24[\/\s-]?7|24 hours|emergency service|after[- ]hours|same[- ]day service/i.test(text)
}

/** Build the question set for a business, using its own vocabulary. */
export function buildQuestions(opts: {
  business: string
  location: string
  vertical: Vertical
  targetService: string | null
}): { text: string; check: UniversalCheck }[] {
  const { business, location, vertical, targetService } = opts
  const checks = [...UNIVERSAL_CHECKS, ...vertical.extraChecks]
  const seen = new Set<UniversalCheck>()
  const questions: { text: string; check: UniversalCheck }[] = []

  for (const check of checks) {
    if (seen.has(check)) continue
    seen.add(check)
    switch (check) {
      case 'hours':
        questions.push({ text: `What are ${business} hours in ${location}?`, check })
        break
      case 'contact':
        questions.push({ text: `What is ${business} phone number and address in ${location}?`, check })
        break
      case 'booking':
        questions.push({ text: `How do I book or schedule service with ${business} in ${location}?`, check })
        break
      case 'services':
        questions.push({ text: `What services does ${business} offer in ${location}?`, check })
        break
      case 'named_service':
        if (targetService) {
          questions.push({ text: `Does ${business} offer ${targetService}, and what does it cost?`, check })
        }
        break
      case 'category_probe':
        if (vertical.categoryStandard) {
          questions.push({
            text: `Does ${business} offer ${vertical.categoryStandard}, and what does it cost?`,
            check,
          })
        }
        break
      case 'service_area':
        questions.push({ text: `What areas does ${business} serve near ${location}?`, check })
        break
      case 'credentials':
        questions.push({ text: `Is ${business} licensed and insured in ${location}, and what is the license number?`, check })
        break
      case 'emergency':
        questions.push({ text: `Does ${business} offer 24/7 emergency service in ${location}?`, check })
        break
      case 'pricing':
        questions.push({ text: `What does ${business} charge in ${location}?`, check })
        break
    }
  }
  return questions
}
