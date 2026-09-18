import type { SignalConnector, SignalConnectorInput, SignalConnectorResult } from '@/types/signal-map'
import { extractSearchQuery, truncateForStorage } from '../utils'
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

const STOPWORDS = new Set([
  'here', 'they', 'when', 'this', 'the', 'that', 'if', 'you', 'a', 'an', 'and', 'or', 'but', 'for', 'with',
  'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'there', 'their', 'them', 'these', 'those',
  'we', 'us', 'our', 'ours', 'i', 'me', 'my', 'mine', 'he', 'she', 'it', 'his', 'her', 'its', 'what', 'which',
  'who', 'whom', 'whose', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now', 'then',
  'also', 'one', 'two', 'first', 'second', 'new', 'old', 'good', 'best', 'top', 'many', 'much', 'any', 'every',
  'marketing', 'business', 'profile', 'internet', 'company', 'companies', 'agency', 'agencies', 'service', 'services',
  'provider', 'providers', 'solution', 'solutions', 'platform', 'platforms', 'tool', 'tools', 'software', 'product',
  'products', 'brand', 'brands', 'firm', 'firms', 'consultant', 'consultants', 'expert', 'experts', 'specialist',
  'specialists', 'such as', 'including', 'especially', 'particularly', 'notably', 'like', 'called', 'named',
])

interface AIQueryResult {
  answer?: {
    engine: string
    query: string
    response: string
    businesses_mentioned: string[]
    fetched_at: string
  }
  rawFetch?: any
  source?: any
  error?: string
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

    for (const query of queries.slice(0, 6)) {
      const [openaiResult, perplexityResult, geminiResult] = await Promise.all([
        this.queryOpenAI(query, report_id),
        this.queryPerplexity(query, report_id),
        this.queryGeminiWithRetry(query, report_id),
      ])

      for (const result of [openaiResult, perplexityResult, geminiResult]) {
        if (result?.answer) {
          // Extract clean organization names using a second LLM call
          const extractedNames = await this.extractOrganizations(result.answer.response, result.answer.engine, report_id, rawFetches)
          result.answer.businesses_mentioned = extractedNames
          answers.push(result.answer)
        }
        if (result?.rawFetch) rawFetches.push(result.rawFetch)
        if (result?.source) sources.push(result.source)
        if (result?.error) errors.push(result.error)
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
      error_message: errors.length > 0 ? errors.join('; ').slice(0, 500) : undefined,
    }
  }

  private generateQueries(icp: string, domains: string[]): string[] {
    const cleanQuery = extractSearchQuery(icp, 80)
    const queries = []

    // Category/competitive queries
    queries.push(`What are the best ${cleanQuery} services?`)
    queries.push(`Who are the top ${cleanQuery} companies?`)
    queries.push(`Recommend me good ${cleanQuery} providers`)
    queries.push(`Most recommended ${cleanQuery}`)

    // Local buyer-intent queries (if location is provided in ICP or seed domains)
    const location = this.extractLocation(icp, domains)
    if (location) {
      queries.push(`best med spa in ${location}`)
      queries.push(`where should I get Botox in ${location}`)
      queries.push(`who does Morpheus8 near ${location}`)
    }

    if (domains.length > 0) {
      queries.push(`What do you think about ${domains[0]}?`)
      if (domains.length > 1) {
        queries.push(`Compare ${domains[0]} and ${domains[1]}`)
      }
    }

    return queries
  }

  private extractLocation(icp: string, domains: string[]): string | null {
    // Try to extract "in [City, ST]" or "near [City]" patterns
    const locationMatch = icp.match(/(?:in|near|around)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,?\s*(?:[A-Z]{2})?)/i)
    if (locationMatch) {
      return locationMatch[1].trim()
    }
    return null
  }

  private async extractOrganizations(text: string, engine: string, reportId: string, rawFetches: any[]): Promise<string[]> {
    const prompt = `Extract only real organization/business names from the following text. Return a JSON object with a single key "organizations" containing an array of strings. Do not include generic words like "marketing", "agency", "company", or sentence words like "here", "they", "this". Only include proper business names.

Text:
"""
${text.slice(0, 2000)}
"""

Return JSON only.`

    // Try Perplexity first
    const perplexity = getPerplexity()
    if (perplexity) {
      try {
        const startTime = Date.now()
        const response = await perplexity.chat.completions.create({
          model: 'sonar',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 300,
        })
        const latencyMs = Date.now() - startTime
        const content = response.choices[0]?.message?.content || ''
        rawFetches.push({
          report_id: reportId,
          connector_id: this.id,
          source: 'perplexity-extraction',
          request_url: 'https://api.perplexity.ai/chat/completions',
          request_params: { model: 'sonar', engine },
          response_body: truncateForStorage({ text: content.slice(0, 1000) }),
          response_status: 200,
          latency_ms: latencyMs,
        })
        const names = this.parseOrganizationJson(content)
        if (names.length > 0) return names
      } catch (error: any) {
        console.error(`[AIAnswerShare] Perplexity extraction error:`, error.message || error)
      }
    }

    // Fallback to Gemini
    const gemini = getGemini()
    if (gemini) {
      try {
        const startTime = Date.now()
        const model = gemini.getGenerativeModel({ model: 'gemini-3.6-flash' })
        const result = await model.generateContent(prompt)
        const latencyMs = Date.now() - startTime
        const content = result.response.text()
        rawFetches.push({
          report_id: reportId,
          connector_id: this.id,
          source: 'gemini-extraction',
          request_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash',
          request_params: { model: 'gemini-3.6-flash', engine },
          response_body: truncateForStorage({ text: content.slice(0, 1000) }),
          response_status: 200,
          latency_ms: latencyMs,
        })
        const names = this.parseOrganizationJson(content)
        if (names.length > 0) return names
      } catch (error: any) {
        console.error(`[AIAnswerShare] Gemini extraction error:`, error.message || error)
      }
    }

    // Final fallback: rule-based filter
    return this.extractNamesFromText(text)
  }

  private parseOrganizationJson(content: string): string[] {
    try {
      // Extract JSON from possible markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
      const parsed = JSON.parse(jsonStr)
      const orgs = Array.isArray(parsed.organizations) ? parsed.organizations : Array.isArray(parsed) ? parsed : []
      return orgs
        .map((o: any) => typeof o === 'string' ? o.trim() : String(o).trim())
        .filter((name: string) => this.isValidBusinessName(name))
    } catch {
      return []
    }
  }

  private isValidBusinessName(name: string): boolean {
    if (!name || name.length < 3 || name.length > 60) return false
    const lower = name.toLowerCase()
    if (STOPWORDS.has(lower)) return false
    // Reject single-word common terms
    if (name.split(/\s+/).length === 1 && STOPWORDS.has(lower)) return false
    // Must contain at least one capitalized word or be multi-word proper noun
    const words = name.split(/\s+/)
    const hasCapitalized = words.some(w => /^[A-Z]/.test(w))
    if (!hasCapitalized && words.length < 2) return false
    return true
  }

  private async queryOpenAI(query: string, reportId: string): Promise<AIQueryResult | null> {
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
          businesses_mentioned: [],
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

  private async queryPerplexity(query: string, reportId: string): Promise<AIQueryResult | null> {
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
          businesses_mentioned: [],
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

  private async queryGeminiWithRetry(query: string, reportId: string, retries = 3): Promise<AIQueryResult | null> {
    const client = getGemini()
    if (!client) return null

    let lastError: any
    for (let attempt = 0; attempt < retries; attempt++) {
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
            businesses_mentioned: [],
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
        lastError = error
        console.warn(`[AIAnswerShare] Gemini attempt ${attempt + 1} failed for "${query}":`, error.message || error)
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
        }
      }
    }

    return {
      rawFetch: {
        report_id: reportId,
        connector_id: this.id,
        source: 'gemini',
        request_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash',
        request_params: { model: 'gemini-3.6-flash', query },
        response_body: truncateForStorage({ error: lastError.message || String(lastError) }),
        response_status: lastError.status || 503,
        latency_ms: 0,
      },
      error: `Gemini: ${lastError.message || 'Unknown error after retries'}`,
    }
  }

  private extractNamesFromText(text: string): string[] {
    const words = text.split(/\s+/)
    const names = new Set<string>()

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (word && /^[A-Z][a-z]+/.test(word) && word.length > 2) {
        if (i + 1 < words.length && /^[A-Z]/.test(words[i + 1])) {
          const name = `${word} ${words[i + 1]}`
          if (this.isValidBusinessName(name)) names.add(name)
        } else {
          if (this.isValidBusinessName(word)) names.add(word)
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
