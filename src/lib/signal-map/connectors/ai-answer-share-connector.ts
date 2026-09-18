import type { SignalConnector, SignalConnectorInput, SignalConnectorResult } from '@/types/signal-map'
import { extractSearchQuery } from '../utils'
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

    const queries = this.generateQueries(icp_description, seed_domains)

    for (const query of queries.slice(0, 10)) {
      const openaiResult = await this.queryOpenAI(query, report_id)
      if (openaiResult) {
        answers.push(openaiResult.answer)
        rawFetches.push(openaiResult.rawFetch)
        sources.push(openaiResult.source)
      }

      const perplexityResult = await this.queryPerplexity(query, report_id)
      if (perplexityResult) {
        answers.push(perplexityResult.answer)
        rawFetches.push(perplexityResult.rawFetch)
        sources.push(perplexityResult.source)
      }

      const geminiResult = await this.queryGemini(query, report_id)
      if (geminiResult) {
        answers.push(geminiResult.answer)
        rawFetches.push(geminiResult.rawFetch)
        sources.push(geminiResult.source)
      }
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
          response_body: response,
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
    } catch (error) {
      return null
    }
  }

  private async queryPerplexity(query: string, reportId: string) {
    const client = getPerplexity()
    if (!client) return null

    const startTime = Date.now()
    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant providing business recommendations with citations. Be specific and mention company names.',
          },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
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
          request_params: { model: 'llama-3.1-sonar-small-128k-online', query },
          response_body: response,
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
    } catch (error) {
      return null
    }
  }

  private async queryGemini(query: string, reportId: string) {
    const client = getGemini()
    if (!client) return null

    const startTime = Date.now()
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' })
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
          request_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash',
          request_params: { model: 'gemini-1.5-flash', query },
          response_body: { text: answer },
          response_status: 200,
          latency_ms: latencyMs,
        },
        source: {
          source: 'gemini',
          url: 'https://gemini.google.com',
          description: `Gemini 1.5 Flash response to "${query}"`,
          fetched_at: new Date().toISOString(),
        },
      }
    } catch (error) {
      return null
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
