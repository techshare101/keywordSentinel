import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 120

const DIRECTORY_DOMAINS = [
  'yelp.com', 'google.com', 'healthgrades.com', 'realself.com', 'glowupfinder.com',
  'webmd.com', 'zocdoc.com', 'vitals.com', 'wellness.com', 'mapquest.com',
  'yellowpages.com', 'bbb.org', 'facebook.com', 'instagram.com', 'tiktok.com'
]

const CATEGORY_STANDARD_SERVICES: { [category: string]: string } = {
  default: 'Morpheus8',
}

const BASE_QUESTIONS = [
  'What are {clinic} hours in {location}?',
  'How do I book a first appointment at {clinic} in {location}?',
  'What is {clinic} phone number and address in {location}?',
  'What treatments or services does {clinic} offer in {location}?',
]

const HIGH_TICKET_SERVICES = [
  'morpheus8', 'morpheus 8', 'laser hair removal', 'coolsculpting', 'cooltone',
  'botox', 'dermal fillers', 'kybella', 'thread lift', 'prp', 'microneedling',
  'chemical peel', 'hydrafacial', 'ultherapy', 'emsculpt', 'sculptra'
]

type ClaimStatus = 'confirmed' | 'contradiction' | 'unsupported' | 'cant_confirm' | 'source_conflict' | 'foreign_source'

async function queryPerplexity(prompt: string): Promise<{ text: string; citations: string[] }> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Perplexity ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    text: data.choices[0].message.content,
    citations: data.citations || [],
  }
}

async function queryOpenAI(prompt: string): Promise<{ text: string; citations: string[] }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    text: data.choices[0].message.content,
    citations: [],
  }
}

async function scrapeWebsite(url: string): Promise<{ markdown: string; title?: string }> {
  const res = await fetch(`https://api.firecrawl.dev/v1/scrape`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Firecrawl ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    markdown: data.data?.markdown || data.data?.content || '',
    title: data.data?.metadata?.title,
  }
}

function getDomain(url: string): string {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isOfficialCitation(citation: string, clinicDomain: string): boolean {
  const domain = getDomain(citation)
  return domain === clinicDomain || domain.includes(clinicDomain)
}

function isDirectoryCitation(citation: string): boolean {
  const domain = getDomain(citation)
  return DIRECTORY_DOMAINS.some(d => domain.includes(d))
}

function extractTargetService(siteContent: string): string | null {
  const lower = siteContent.toLowerCase()
  let foundService: string | null = null
  let priority = -1
  for (const service of HIGH_TICKET_SERVICES) {
    if (lower.includes(service)) {
      const idx = HIGH_TICKET_SERVICES.indexOf(service)
      if (idx > priority) {
        priority = idx
        foundService = service
      }
    }
  }
  return foundService
}

function extractSiteFact(siteContent: string, question: string): string | null {
  const q = question.toLowerCase()
  const lower = siteContent.toLowerCase()

  if (q.includes('hour')) {
    const patterns = [
      /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)[\s:\-]*((?:\d{1,2}[:.]\d{2}|\d{1,2})\s*(?:am|pm)?(?:\s*[\-–]\s*(?:\d{1,2}[:.]\d{2}|\d{1,2})\s*(?:am|pm)?)?)/gi,
      /(monday[\s\w\-,:]+friday)[^\n]*/gi,
    ]
    for (const pattern of patterns) {
      const matches = siteContent.match(pattern)
      if (matches && matches.length > 0) return matches.slice(0, 5).join('; ')
    }
  }

  if (q.includes('service') || q.includes('treatment') || q.includes('offer')) {
    const found: string[] = []
    for (const service of HIGH_TICKET_SERVICES) {
      if (lower.includes(service)) found.push(service)
    }
    if (found.length > 0) return found.slice(0, 10).join(', ')
  }

  if (q.includes('phone') || q.includes('book') || q.includes('appointment')) {
    const patterns = [/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g]
    for (const pattern of patterns) {
      const matches = siteContent.match(pattern)
      if (matches && matches.length > 0) return matches.slice(0, 2).join(', ')
    }
  }

  if (q.includes('address') || q.includes('location')) {
    const patterns = [
      /\d+\s+[A-Za-z0-9\s.,-]+(?:Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way)[,\s]+[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}/g,
      /\d+\s+[A-Za-z0-9\s.,-]+[,\s]+(?:oakdale|woodbury|st\.?\s*paul|minneapolis)[,\s]+mn\s*\d{5}/gi,
    ]
    for (const pattern of patterns) {
      const matches = siteContent.match(pattern)
      if (matches && matches.length > 0) return matches.slice(0, 2).join('; ')
    }
  }

  return null
}

function isHedged(answer: string): boolean {
  const lower = answer.toLowerCase()
  const hedgePhrases = [
    "i don't have", "i don't see", "not available", "cannot find",
    "i'm not sure", "it appears", "may be", "might be", "could be",
    "limited information", "no specific", "unclear", "i don't know"
  ]
  return hedgePhrases.some(p => lower.includes(p))
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function extractPhones(text: string): string[] {
  return (text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []).map(normalizePhone)
}

function extractHours(text: string): string[] {
  return (text.toLowerCase().match(/\d{1,2}[:.]\d{2}\s*[ap]m?/g) || [])
    .map(h => h.replace(/\s+/g, ''))
}

function classifyClaim(
  aiAnswer: string,
  siteFact: string | null,
  question: string,
  citations: string[],
  clinicDomain: string,
  targetService: string | null,
  categoryService: string | null
): ClaimStatus {
  const qLower = question.toLowerCase()
  const aiLower = aiAnswer.toLowerCase()

  const officialCitations = citations.filter(c => isOfficialCitation(c, clinicDomain))
  const directoryCitations = citations.filter(c => isDirectoryCitation(c))
  const foreignCitations = citations.filter(c => {
    const domain = getDomain(c)
    return domain && !isOfficialCitation(c, clinicDomain) && !isDirectoryCitation(c)
  })

  const hasOfficialCitation = officialCitations.length > 0
  const hasDirectoryCitation = directoryCitations.length > 0
  const hasForeignCitation = foreignCitations.length > 0 && citations.length > 0
  const foreignSourceOnly = hasForeignCitation && !hasOfficialCitation && !hasDirectoryCitation

  // Hedge or no info = can't confirm
  if (isHedged(aiAnswer)) {
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm'
  }

  // If site has no extractable fact, we can't confirm or deny
  if (!siteFact) {
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm'
  }

  const siteLower = siteFact.toLowerCase()

  // Hours
  if (qLower.includes('hour')) {
    const aiHours = extractHours(aiAnswer)
    const siteHours = extractHours(siteFact)
    if (aiHours.length > 0 && siteHours.length > 0) {
      const aiSet = new Set(aiHours)
      const siteSet = new Set(siteHours)
      const hasMismatch = Array.from(aiSet).some(h => !siteSet.has(h))
      if (hasMismatch) {
        if (hasDirectoryCitation) return 'source_conflict'
        return 'contradiction'
      }
      return 'confirmed'
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm'
  }

  // Phone / address / booking
  if (qLower.includes('phone') || qLower.includes('address') || qLower.includes('book')) {
    const aiPhones = extractPhones(aiAnswer)
    const sitePhones = extractPhones(siteFact)
    if (aiPhones.length > 0 && sitePhones.length > 0) {
      const hasMatch = aiPhones.some(p => sitePhones.includes(p))
      if (!hasMatch) {
        if (hasDirectoryCitation) return 'source_conflict'
        return 'contradiction'
      }
      return 'confirmed'
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm'
  }

  // Services
  if (qLower.includes('service') || qLower.includes('treatment') || qLower.includes('offer') ||
      (targetService && qLower.includes(targetService)) ||
      (categoryService && qLower.includes(categoryService))) {
    const serviceToCheck = targetService && qLower.includes(targetService) ? targetService :
                           categoryService && qLower.includes(categoryService) ? categoryService : null

    if (serviceToCheck) {
      const aiMentions = aiLower.includes(serviceToCheck.toLowerCase())
      const siteMentions = siteLower.includes(serviceToCheck.toLowerCase())

      if (aiMentions && siteMentions) return 'confirmed'
      if (aiMentions && !siteMentions) {
        return foreignSourceOnly ? 'foreign_source' : 'unsupported'
      }
      if (!aiMentions && siteMentions) return 'cant_confirm' // AI can't confirm a service they have
      return 'cant_confirm'
    }

    // General services question: check if AI mentions services found on site
    const siteServices = HIGH_TICKET_SERVICES.filter(s => siteLower.includes(s))
    const aiMentionsAny = siteServices.some(s => aiLower.includes(s))
    if (siteServices.length > 0 && aiMentionsAny) return 'confirmed'
    return 'cant_confirm'
  }

  if (foreignSourceOnly) return 'foreign_source'
  return 'cant_confirm'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await req.json()
    const { clinic_name, location, website, category = 'default' } = body

    if (!clinic_name || !location) {
      return NextResponse.json(
        { error: 'clinic_name and location are required' },
        { status: 400 }
      )
    }

    const clinicDomain = website ? getDomain(website) : ''

    let siteContent = ''
    let siteTitle = ''
    if (website) {
      try {
        const url = website.startsWith('http') ? website : `https://${website}`
        const scraped = await scrapeWebsite(url)
        siteContent = scraped.markdown
        siteTitle = scraped.title || ''
      } catch (err) {
        console.error('Website scrape failed:', err)
      }
    }

    const targetService = extractTargetService(siteContent)
    const categoryService = CATEGORY_STANDARD_SERVICES[category] || CATEGORY_STANDARD_SERVICES.default

    const dynamicServiceQuestion = targetService
      ? `Does ${clinic_name} offer ${targetService}, and what does it cost?`
      : `What treatments or services does ${clinic_name} offer in ${location}?`

    const categoryServiceQuestion = `Does ${clinic_name} offer ${categoryService}, and what does it cost?`

    const questions = [
      BASE_QUESTIONS[0].replace('{clinic}', clinic_name).replace('{location}', location),
      dynamicServiceQuestion,
      categoryServiceQuestion,
      BASE_QUESTIONS[1].replace('{clinic}', clinic_name).replace('{location}', location),
      BASE_QUESTIONS[2].replace('{clinic}', clinic_name).replace('{location}', location),
      BASE_QUESTIONS[3].replace('{clinic}', clinic_name).replace('{location}', location),
    ]

    const engineStatus: { engine: string; status: 'ok' | 'failed' | 'quota' }[] = []
    const engineResults: { [key: string]: { text: string; citations: string[] }[] } = {}

    try {
      engineResults.perplexity = await Promise.all(questions.map(q => queryPerplexity(q)))
      engineStatus.push({ engine: 'Perplexity', status: 'ok' })
    } catch (err: any) {
      console.error('Perplexity failed:', err.message)
      engineStatus.push({ engine: 'Perplexity', status: err.message.includes('429') ? 'quota' : 'failed' })
    }

    try {
      engineResults.openai = await Promise.all(questions.map(q => queryOpenAI(q)))
      engineStatus.push({ engine: 'OpenAI', status: 'ok' })
    } catch (err: any) {
      console.error('OpenAI failed:', err.message)
      engineStatus.push({ engine: 'OpenAI', status: err.message.includes('429') ? 'quota' : 'failed' })
    }

    const claims: any[] = []
    const summary: Record<ClaimStatus, number> = {
      confirmed: 0,
      contradiction: 0,
      unsupported: 0,
      cant_confirm: 0,
      source_conflict: 0,
      foreign_source: 0,
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const aiResponses = []

      if (engineResults.perplexity?.[i]) {
        aiResponses.push({ engine: 'Perplexity', ...engineResults.perplexity[i] })
      }
      if (engineResults.openai?.[i]) {
        aiResponses.push({ engine: 'OpenAI', ...engineResults.openai[i] })
      }

      if (aiResponses.length === 0) {
        claims.push({
          question,
          ai_answer: 'No AI engines available.',
          site_fact: null,
          status: 'cant_confirm',
          ai_citations: [],
          foreign_citations: [],
          directory_citations: [],
          official_citations: [],
          raw_response: '',
        })
        summary.cant_confirm++
        continue
      }

      const primary = aiResponses[0]
      const siteFact = siteContent ? extractSiteFact(siteContent, question) : null
      const status = classifyClaim(primary.text, siteFact, question, primary.citations, clinicDomain, targetService, categoryService)

      const foreignCitations = primary.citations.filter(c => {
        const domain = getDomain(c)
        return domain && !isOfficialCitation(c, clinicDomain) && !isDirectoryCitation(c)
      })
      const directoryCitations = primary.citations.filter(isDirectoryCitation)
      const officialCitations = primary.citations.filter(c => isOfficialCitation(c, clinicDomain))

      summary[status]++

      claims.push({
        question,
        ai_answer: primary.text,
        site_fact: siteFact,
        status,
        ai_citations: primary.citations,
        foreign_citations: foreignCitations,
        directory_citations: directoryCitations,
        official_citations: officialCitations,
        raw_response: primary.text,
      })
    }

    const reportId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const result = {
      id: reportId,
      clinic_name,
      location,
      website: website || null,
      target_service: targetService,
      category_service: categoryService,
      claims,
      engine_status: engineStatus,
      completed_at: new Date().toISOString(),
      summary,
    }

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Clinic check error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
