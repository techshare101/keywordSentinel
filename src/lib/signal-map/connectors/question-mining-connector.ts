import type { SignalConnector, SignalConnectorInput, SignalConnectorResult } from '@/types/signal-map'
import { extractSearchQuery } from '../utils'
import Firecrawl from '@mendable/firecrawl-js'

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! })

export class QuestionMiningConnector implements SignalConnector {
  id = 'question_mining'
  name = 'People Also Ask Mining'
  section_type = 'question_mining' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { icp_description, report_id, seed_domains } = input
    
    const questions = []
    const rawFetches = []
    const sources = []

    // Use a clean, short query extracted from the ICP description
    const cleanQuery = extractSearchQuery(icp_description, 100)

    // Strategy 1: Search Google for ICP + "how to" / "what is" patterns
    const searchQueries = [
      `${cleanQuery} how to`,
      `${cleanQuery} what is`,
      `${cleanQuery} why`,
      `${cleanQuery} best practices`,
    ]

    for (const query of searchQueries.slice(0, 3)) {
      const startTime = Date.now()
      try {
        const searchResult = await firecrawl.search(query, {
          limit: 10,
        })

        const latencyMs = Date.now() - startTime

        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'google_paa',
          request_url: `https://api.firecrawl.dev/v1/search`,
          request_params: { query, limit: 10 },
          response_body: searchResult,
          response_status: 200,
          latency_ms: latencyMs,
        })

        if (searchResult && Array.isArray(searchResult)) {
          for (const result of searchResult.slice(0, 5)) {
            // Extract question-like patterns from titles
            const title = result.title || ''
            if (title.includes('?') || title.toLowerCase().includes('how') || title.toLowerCase().includes('what')) {
              questions.push({
                question: title,
                source_url: result.url,
                source: 'paa',
                snippet: result.description,
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

        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'google_paa',
          request_url: `https://api.firecrawl.dev/v1/search`,
          request_params: { query },
          response_body: { error: String(error) },
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
            response_body: scrapeResult,
            response_status: scrapeResult ? 200 : 404,
            latency_ms: latencyMs,
          })

          if (scrapeResult && scrapeResult.markdown) {
            // Extract question patterns from markdown
            const lines = scrapeResult.markdown.split('\n')
            for (const line of lines) {
              if (line.includes('?') && line.length > 10 && line.length < 200) {
                questions.push({
                  question: line.trim(),
                  source_url: url,
                  source: 'domain_faq',
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

          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          // Silently continue
        }
      }
    }

    return {
      section_type: this.section_type,
      status: questions.length > 0 ? 'completed' : 'no_data',
      data: { questions: questions.slice(0, 50) },
      sources,
      raw_fetches: rawFetches,
    }
  }
}
