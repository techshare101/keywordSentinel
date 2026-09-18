import type { SignalConnector, SignalConnectorInput, SignalConnectorResult } from '@/types/signal-map'
import { extractSearchQuery, truncateForStorage } from '../utils'
import Firecrawl from '@mendable/firecrawl-js'

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! })

const UI_NOISE_PATTERNS = [
  /search below/i,
  /can't find/i,
  /can't find what/i,
  /do a search/i,
  /contact us/i,
  /sign up/i,
  /log in/i,
  /cookie/i,
  /privacy policy/i,
  /terms of service/i,
]

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, '') // headers
    .replace(/\*\*/g, '') // bold
    .replace(/\*/g, '') // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code
    .replace(/\s+/g, ' ')
    .trim()
}

function isValidQuestion(text: string): boolean {
  if (!text) return false
  if (text.length < 25) return false
  if (text.length > 200) return false
  if (!text.includes('?') && !/^\s*(what|how|why|when|where|who|which|can|should|does|do|is|are|will)\b/i.test(text)) return false
  if (UI_NOISE_PATTERNS.some(p => p.test(text))) return false
  return true
}

export class QuestionMiningConnector implements SignalConnector {
  id = 'question_mining'
  name = 'People Also Ask Mining'
  section_type = 'question_mining' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { icp_description, report_id, seed_domains } = input

    const questions: any[] = []
    const rawFetches = []
    const sources = []

    const cleanQuery = extractSearchQuery(icp_description, 100)

    // Strategy 1: Search Google for ICP + question patterns
    const searchQueries = [
      `${cleanQuery} how to`,
      `${cleanQuery} what is`,
      `${cleanQuery} why`,
    ]

    for (const query of searchQueries) {
      const startTime = Date.now()
      try {
        const searchResult = await firecrawl.search(query, { limit: 10 })
        const latencyMs = Date.now() - startTime

        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'google_paa',
          request_url: `https://api.firecrawl.dev/v1/search`,
          request_params: { query, limit: 10 },
          response_body: truncateForStorage(searchResult),
          response_status: 200,
          latency_ms: latencyMs,
        })

        if (searchResult && Array.isArray(searchResult)) {
          for (const result of searchResult.slice(0, 5)) {
            const title = stripMarkdown(result.title || '')
            if (isValidQuestion(title)) {
              questions.push({
                question: title,
                source_url: result.url,
                source: new URL(result.url).hostname,
                snippet: stripMarkdown(result.description || '').slice(0, 250),
              })
            }
          }

          sources.push({
            source: 'google_paa',
            url: `https://google.com/search?q=${encodeURIComponent(query)}`,
            description: `Google PAA for "${query}" — ${searchResult.length} results`,
            fetched_at: new Date().toISOString(),
          })
        }

        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'google_paa',
          request_url: `https://api.firecrawl.dev/v1/search`,
          request_params: { query },
          response_body: truncateForStorage({ error: String(error) }),
          response_status: 500,
          latency_ms: Date.now() - startTime,
        })
      }
    }

    // Strategy 2: Scrape seed domain FAQ pages if available
    for (const domain of seed_domains.slice(0, 3)) {
      const faqUrls = [
        `https://${domain}/faq`,
        `https://${domain}/faqs`,
        `https://${domain}/help`,
      ]

      for (const url of faqUrls) {
        const startTime = Date.now()
        try {
          const scrapeResult = await firecrawl.scrape(url, {
            formats: ['markdown'],
            onlyMainContent: true,
          })

          const latencyMs = Date.now() - startTime

          rawFetches.push({
            report_id,
            connector_id: this.id,
            source: 'domain_faq',
            request_url: url,
            request_params: { domain },
            response_body: truncateForStorage(scrapeResult),
            response_status: scrapeResult ? 200 : 404,
            latency_ms: latencyMs,
          })

          if (scrapeResult && scrapeResult.markdown) {
            const lines = scrapeResult.markdown.split('\n')
            for (const line of lines) {
              const cleaned = stripMarkdown(line)
              if (isValidQuestion(cleaned)) {
                questions.push({
                  question: cleaned,
                  source_url: url,
                  source: domain,
                  snippet: null,
                })
              }
            }

            sources.push({
              source: 'domain_faq',
              url,
              description: `FAQ page from ${domain}`,
              fetched_at: new Date().toISOString(),
            })
          }

          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (error) {
          rawFetches.push({
            report_id,
            connector_id: this.id,
            source: 'domain_faq',
            request_url: url,
            request_params: { domain },
            response_body: truncateForStorage({ error: String(error) }),
            response_status: 500,
            latency_ms: Date.now() - startTime,
          })
        }
      }
    }

    // Deduplicate and count distinct source domains
    const seen = new Set<string>()
    const uniqueQuestions = questions.filter(q => {
      const key = q.question.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const distinctSources = new Set(uniqueQuestions.map(q => {
      try {
        return new URL(q.source_url).hostname
      } catch {
        return q.source
      }
    }))

    // Require at least 3 distinct source domains for a trustworthy signal
    const hasEnoughSources = distinctSources.size >= 3

    return {
      section_type: this.section_type,
      status: uniqueQuestions.length > 0 && hasEnoughSources ? 'completed' : 'no_data',
      data: {
        questions: uniqueQuestions.slice(0, 50),
        total_found: uniqueQuestions.length,
        distinct_sources: Array.from(distinctSources).slice(0, 20),
      },
      sources,
      raw_fetches: rawFetches,
      error_message: uniqueQuestions.length > 0 && !hasEnoughSources
        ? `Found ${uniqueQuestions.length} questions but only ${distinctSources.size} source domain(s). Need 3+ distinct sources.`
        : undefined,
    }
  }
}
