import type { SignalConnector, SignalConnectorInput, SignalConnectorResult } from '@/types/signal-map'
import { extractSearchQuery, fetchWithTimeout, truncateForStorage } from '../utils'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy-initialize clients to avoid build-time crashes
let openaiClient: OpenAI | null = null
let perplexityClient: OpenAI | null = null
let geminiClient: GoogleGenerativeAI | null = null

function getOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

function getPerplexity() {
  if (!perplexityClient && process.env.PERPLEXITY_API_KEY) {
    perplexityClient = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
  }
  return perplexityClient
}

function getGemini() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return geminiClient
}

export class AIAnswerShareConnector implements SignalConnector {
  id = 'ai_answer_share'
  name = 'AI Answer Share'
  section_type = 'ai_answer_share' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { icp_description, report_id, seed_domains } = input

    const answers = []
    const rawFetches = []
    const sources = []
    const errors = []

    const queries = this.generateQueries(icp_description, seed_domains)

    for (const query of queries.slice(0, 4)) {
      // Run all three AI engines in parallel for speed
      const [openaiResult, perplexityResult, geminiResult] = await Promise.all([
        this.queryOpenAI(query, report_id),
        this.queryPerplexity(query, report_id),
        this.queryGemini(query, report_id),
      ])

      if (openaiResult?.answer) {
        answers.push(openaiResult.answer)
      }
      if (openaiResult?.rawFetch) rawFetches.push(openaiResult.rawFetch)
      if (openaiResult?.source) sources.push(openaiResult.source)
      if (openaiResult?.error) errors.push(openaiResult.error)

      if (perplexityResult?.answer) {
        answers.push(perplexityResult.answer)
      }
      if (perplexityResult?.rawFetch) rawFetches.push(perplexityResult.rawFetch)
      if (perplexityResult?.source) sources.push(perplexityResult.source)
      if (perplexityResult?.error) errors.push(perplexityResult.error)

      if (geminiResult?.answer) {
        answers.push(geminiResult.answer)
      }
      if (geminiResult?.rawFetch) rawFetches.push(geminiResult.rawFetch)
      if (geminiResult?.source) sources.push(geminiResult.source)
      if (geminiResult?.error) errors.push(geminiResult.error)
    }

    const businessMentions = this.extractBusinessMentions(answers, seed_domains)

    return {
      section_type: this.section_type,
      status: answers.length > 0 ? 'completed' : 'no_data',
      data: {
        queries: answers,
        business_mentions: businessMentions,
        total_queries: queries.length,
        engines_queried: ['openai', 'perplexity', 'gemini'],
      },
      sources,
      raw_fetches: rawFetches,
      error_message: errors.length > 0 ? errors.join('; ').slice(0, 500) : undefined,
    }
  }

  private generateQueries(icp: string, domains: string[]): string[] {
    const cleanQuery = extractSearchQuery(icp, 80)
    const queries = []
    queries.push(`What are the best ${cleanQuery} services?`)
    queries.push(`Who are the top ${cleanQuery} companies?`)
    queries.push(`Recommend me good ${cleanQuery} providers`)
    queries.push(`What ${cleanQuery} should I use?`)
    queries.push(`Best ${cleanQuery} for small business`)
    queries.push(`Most recommended ${cleanQuery}`)

    if (domains.length > 0) {
      queries.push(`What do you think about ${domains[0]}?`)
      if (domains.length > 1) {
        queries.push(`Compare ${domains[0]} and ${domains[1]}`)
      }
    }

    return queries
  }

  private async queryOpenAI(query: string, reportId: string) {
    const client = getOpenAI()
    if (!client) return null

    const startTime = Date.now()
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant providing business recommendations. Be specific and mention company names when possible.',
          },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
        max_tokens: 400,
      })

      const latencyMs = Date.now() - startTime
      const answer = response.choices[0]?.message?.content || ''

      return {
        answer: {
          engine: 'openai',
          query,
          response: answer,
          businesses_mentioned: this.extractNamesFromText(answer),
          fetched_at: new Date().toISOString(),
        },
        rawFetch: {
          report_id: reportId,
          connector_id: this.id,
          source: 'openai',
          request_url: 'https://api.openai.com/v1/chat/completions',
          request_params: { model: 'gpt-4o-mini', query },
          response_body: truncateForStorage({ text: answer.slice(0, 2000) }),
          response_status: 200,
          latency_ms: latencyMs,
        },
        source: {
          source: 'openai',
          url: 'https://openai.com',
          description: `OpenAI GPT-4o-mini response to "${query}"`,
          fetched_at: new Date().toISOString(),
        },
      }
    } catch (error: any) {
      console.error(`[AIAnswerShare] OpenAI error for "${query}":`, error.message || error)
      return {
        rawFetch: {
          report_id: reportId,
          connector_id: this.id,
          source: 'openai',
          request_url: 'https://api.openai.com/v1/chat/completions',
          request_params: { model: 'gpt-4o-mini', query },
          response_body: truncateForStorage({ error: error.message || String(error) }),
          response_status: error.status || 500,
          latency_ms: Date.now() - startTime,
        },
        error: `OpenAI: ${error.message || 'Unknown error'}`,
      }
    }
  }

  private async queryPerplexity(query: string, reportId: string) {
    const client = getPerplexity()
    if (!client) return null

    const startTime = Date.now()
    try {
      const response = await client.chat.completions.create({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant providing business recommendations with citations. Be specific and mention company names.',
          },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
        max_tokens: 400,
      })

      const latencyMs = Date.now() - startTime
      const answer = response.choices[0]?.message?.content || ''

      return {
        answer: {
          engine: 'perplexity',
          query,
          response: answer,
          businesses_mentioned: this.extractNamesFromText(answer),
          fetched_at: new Date().toISOString(),
        },
        rawFetch: {
          report_id: reportId,
          connector_id: this.id,
          source: 'perplexity',
          request_url: 'https://api.perplexity.ai/chat/completions',
          request_params: { model: 'sonar', query },
          response_body: truncateForStorage({ text: answer.slice(0, 2000) }),
          response_status: 200,
          latency_ms: latencyMs,
        },
        source: {
          source: 'perplexity',
          url: 'https://perplexity.ai',
          description: `Perplexity Sonar response to "${query}"`,
          fetched_at: new Date().toISOString(),
        },
      }
    } catch (error: any) {
      console.error(`[AIAnswerShare] Perplexity error for "${query}":`, error.message || error)
      return {
        rawFetch: {
          report_id: reportId,
          connector_id: this.id,
          source: 'perplexity',
          request_url: 'https://api.perplexity.ai/chat/completions',
          request_params: { model: 'sonar', query },
          response_body: truncateForStorage({ error: error.message || String(error) }),
          response_status: error.status || 500,
          latency_ms: Date.now() - startTime,
        },
        error: `Perplexity: ${error.message || 'Unknown error'}`,
      }
    }
  }

  private async queryGemini(query: string, reportId: string) {
    const client = getGemini()
    if (!client) return null

    const startTime = Date.now()
    try {
      const model = client.getGenerativeModel({ model: 'gemini-3.6-flash' })
      const result = await model.generateContent(query)
      const answer = result.response.text()

      const latencyMs = Date.now() - startTime

      return {
        answer: {
          engine: 'gemini',
          query,
          response: answer,
          businesses_mentioned: this.extractNamesFromText(answer),
          fetched_at: new Date().toISOString(),
        },
        rawFetch: {
          report_id: reportId,
          connector_id: this.id,
          source: 'gemini',
          request_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash',
          request_params: { model: 'gemini-3.6-flash', query },
          response_body: truncateForStorage({ text: answer.slice(0, 2000) }),
          response_status: 200,
          latency_ms: latencyMs,
        },
        source: {
          source: 'gemini',
          url: 'https://gemini.google.com',
          description: `Gemini 3.6 Flash response to "${query}"`,
          fetched_at: new Date().toISOString(),
        },
      }
    } catch (error: any) {
      console.error(`[AIAnswerShare] Gemini error for "${query}":`, error.message || error)
      return {
        rawFetch: {
          report_id: reportId,
          connector_id: this.id,
          source: 'gemini',
          request_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash',
          request_params: { model: 'gemini-3.6-flash', query },
          response_body: truncateForStorage({ error: error.message || String(error) }),
          response_status: error.status || 500,
          latency_ms: Date.now() - startTime,
        },
        error: `Gemini: ${error.message || 'Unknown error'}`,
      }
    }
  }

  private extractNamesFromText(text: string): string[] {
    const words = text.split(/\s+/)
    const names = new Set<string>()

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (word && /^[A-Z][a-z]+/.test(word) && word.length > 2) {
        if (i + 1 < words.length && /^[A-Z]/.test(words[i + 1])) {
          names.add(`${word} ${words[i + 1]}`)
        } else {
          names.add(word)
        }
      }
    }

    return Array.from(names).slice(0, 20)
  }

  private extractBusinessMentions(
    answers: Array<{ businesses_mentioned: string[]; engine: string }>,
    seedDomains: string[]
  ) {
    const mentionCount = new Map<string, { count: number; engines: Set<string> }>()

    for (const answer of answers) {
      for (const business of answer.businesses_mentioned) {
        const existing = mentionCount.get(business) || { count: 0, engines: new Set() }
        existing.count++
        existing.engines.add(answer.engine)
        mentionCount.set(business, existing)
      }
    }

    const seedDomainMentions = seedDomains.map(domain => {
      const mentioned = Array.from(mentionCount.keys()).some(name =>
        name.toLowerCase().includes(domain.split('.')[0].toLowerCase())
      )
      return { domain, mentioned }
    })

    return {
      top_mentioned: Array.from(mentionCount.entries())
        .map(([name, data]) => ({
          name,
          count: data.count,
          engines: Array.from(data.engines),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      seed_domain_visibility: seedDomainMentions,
    }
  }
}
