/**
 * IndustryHubsConnector — Phase 2
 * 
 * Crawls seed domains via Firecrawl to extract outbound links.
 * Identifies frequently-linked external sites (blogs, forums, news, tools).
 * 
 * These are the "watering holes" where your ICP congregates.
 */

import type { SignalConnector, SignalConnectorInput, SignalConnectorResult, IndustryHub } from '@/types/signal-map'
import Firecrawl from '@mendable/firecrawl-js'

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY || '' })

export class IndustryHubsConnector implements SignalConnector {
  id = 'industry_hubs'
  name = 'Industry Hubs'
  section_type = 'industry_hubs' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { seed_domains, report_id, user_id } = input

    if (seed_domains.length === 0) {
      return {
        section_type: this.section_type,
        status: 'no_data',
        data: { hubs: [] },
        sources: [],
        raw_fetches: [],
        error_message: 'No seed domains provided',
      }
    }

    const hubs = [] as IndustryHub[]
    const rawFetches = []
    const sources = []
    const domainMentions = new Map<string, { count: number; sourceUrls: string[]; title: string; description: string }>()

    // Crawl each seed domain (homepage only — keep Firecrawl calls minimal)
    for (const domain of seed_domains.slice(0, 3)) {
      const url = `https://${domain}`
      const startTime = Date.now()

      try {
        console.log(`[IndustryHubs] Scraping ${domain}`)
        const result = await firecrawl.scrape(url, { 
          formats: ['markdown', 'links'],
          onlyMainContent: true,
        }) as any

        const latencyMs = Date.now() - startTime
        const markdown = result.markdown || ''
        const links = result.links || []

        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'firecrawl',
          request_url: url,
          request_params: { formats: ['markdown', 'links'] },
          response_body: { link_count: links.length, content_length: markdown.length },
          response_status: result.success ? 200 : 500,
          latency_ms: latencyMs,
        })

        sources.push({
          source: 'firecrawl',
          url,
          description: `Outbound links from ${domain}`,
          fetched_at: new Date().toISOString(),
        })

        // Extract external links (skip the domain itself)
        const domainParts = domain.split('.')
        const baseDomain = domainParts.slice(-2).join('.')

        for (const link of links) {
          try {
            const linkUrl = new URL(link)
            const linkDomain = linkUrl.hostname.replace(/^www\./, '')
            const linkBase = linkDomain.split('.').slice(-2).join('.')

            // Skip same-domain links, social media, and generic TLDs
            if (linkBase === baseDomain) continue
            if (this.isIgnoredDomain(linkDomain)) continue

            const existing = domainMentions.get(linkDomain) || { count: 0, sourceUrls: [], title: '', description: '' }
            existing.count++
            if (!existing.sourceUrls.includes(url)) existing.sourceUrls.push(url)
            domainMentions.set(linkDomain, existing)
          } catch {
            // Invalid URL, skip
          }
        }
      } catch (error) {
        console.error(`[IndustryHubs] Error scraping ${domain}:`, error)
        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'firecrawl',
          request_url: url,
          request_params: { formats: ['markdown', 'links'] },
          response_body: { error: String(error) },
          response_status: 500,
          latency_ms: Date.now() - startTime,
        })
      }
    }

    // Sort by mention count and build hub list
    const sortedDomains = Array.from(domainMentions.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)

    for (const [domain, data] of sortedDomains) {
      hubs.push({
        domain,
        title: data.title || domain,
        description: data.description || `Linked ${data.count} time(s) from seed domains`,
        mention_count: data.count,
        source_urls: data.sourceUrls,
        category: this.categorizeDomain(domain),
      })
    }

    return {
      section_type: this.section_type,
      status: hubs.length > 0 ? 'completed' : 'no_data',
      data: { hubs, total_domains_found: domainMentions.size },
      sources,
      raw_fetches: rawFetches,
    }
  }

  private isIgnoredDomain(domain: string): boolean {
    const ignored = [
      'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com',
      'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
      'google.com', 'bing.com', 'apple.com', 'microsoft.com',
      'github.com', 'stackoverflow.com',
      'wikipedia.org', 'medium.com',
      'goo.gl', 'bit.ly', 't.co', 'tinyurl.com',
    ]
    return ignored.some(d => domain.includes(d))
  }

  private categorizeDomain(domain: string): IndustryHub['category'] {
    const d = domain.toLowerCase()
    if (['forum', 'community', 'discourse', 'slack', 'discord'].some(k => d.includes(k))) return 'community'
    if (['news', 'blog', 'journal', 'magazine', 'times', 'post'].some(k => d.includes(k))) return 'news'
    if (['shop', 'store', 'buy', 'ecommerce', 'cart'].some(k => d.includes(k))) return 'vendor'
    if (['tool', 'app', 'software', 'platform', 'saas', 'crm'].some(k => d.includes(k))) return 'tool'
    if (['resource', 'library', 'wiki', 'docs', 'education', 'learn'].some(k => d.includes(k))) return 'resource'
    return 'other'
  }
}
