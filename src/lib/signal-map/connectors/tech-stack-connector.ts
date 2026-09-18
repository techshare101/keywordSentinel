/**
 * TechStackConnector — Phase 2
 * 
 * Detects technology stack from seed domains via Firecrawl metadata.
 * Extracts: CMS, analytics, CRMs, e-commerce platforms, ad tech, CDNs.
 * 
 * Shows what tools your ICP uses — valuable for targeting with relevant solutions.
 */

import type { SignalConnector, SignalConnectorInput, SignalConnectorResult, TechStackItem } from '@/types/signal-map'
import Firecrawl from '@mendable/firecrawl-js'

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY || '' })

// Tech signatures — detect technologies from HTML/metadata patterns
const TECH_SIGNATURES: Record<string, { name: string; category: TechStackItem['category']; patterns: string[] }> = {
  // CMS
  wordpress: { name: 'WordPress', category: 'cms', patterns: ['wp-content', 'wp-includes', 'wordpress'] },
  shopify: { name: 'Shopify', category: 'ecommerce', patterns: ['shopify', 'cdn.shopify.com', 'shopify.com'] },
  squarespace: { name: 'Squarespace', category: 'cms', patterns: ['squarespace', 'static1.squarespace'] },
  wix: { name: 'Wix', category: 'cms', patterns: ['wix.com', 'wixstatic'] },
  webflow: { name: 'Webflow', category: 'cms', patterns: ['webflow', 'assets-global'] },
  
  // Analytics
  ga: { name: 'Google Analytics', category: 'analytics', patterns: ['google-analytics.com', 'gtag', 'UA-', 'G-'] },
  hotjar: { name: 'Hotjar', category: 'analytics', patterns: ['hotjar', 'hj.tldr'] },
  segment: { name: 'Segment', category: 'analytics', patterns: ['segment', 'cdn.segment.com'] },
  mixpanel: { name: 'Mixpanel', category: 'analytics', patterns: ['mixpanel', 'cdn.mxpnl.com'] },
  
  // CRM / Marketing
  hubspot: { name: 'HubSpot', category: 'crm', patterns: ['hubspot', 'hs-scripts', 'hubspot-form'] },
  salesforce: { name: 'Salesforce', category: 'crm', patterns: ['salesforce', 'force.com'] },
  mailchimp: { name: 'Mailchimp', category: 'crm', patterns: ['mailchimp', 'mc_embed_signup'] },
  
  // E-commerce
  bigcommerce: { name: 'BigCommerce', category: 'ecommerce', patterns: ['bigcommerce', 'mybigcommerce.com'] },
  magento: { name: 'Magento', category: 'ecommerce', patterns: ['magento', 'mage-cache'] },
  
  // Ad Tech
  gtm: { name: 'Google Tag Manager', category: 'advertising', patterns: ['googletagmanager', 'GTM-'] },
  fb_pixel: { name: 'Facebook Pixel', category: 'advertising', patterns: ['fbevents.js', 'facebook.com/tr', 'fbq('] },
  google_ads: { name: 'Google Ads', category: 'advertising', patterns: ['googleadservices', 'adsbygoogle'] },
  
  // CDN / Infrastructure
  cloudflare: { name: 'Cloudflare', category: 'cdn', patterns: ['cloudflare', 'cf-'] },
  aws: { name: 'AWS', category: 'cdn', patterns: ['amazonaws', 's3.amazonaws'] },
  vercel: { name: 'Vercel', category: 'cdn', patterns: ['vercel', '_vercel'] },
  
  // Frameworks
  nextjs: { name: 'Next.js', category: 'framework', patterns: ['_next', '__next', 'nextjs'] },
  react: { name: 'React', category: 'framework', patterns: ['react', 'react-dom'] },
  vue: { name: 'Vue.js', category: 'framework', patterns: ['vue', 'vuejs'] },
  angular: { name: 'Angular', category: 'framework', patterns: ['angular', 'ng-app'] },
}

export class TechStackConnector implements SignalConnector {
  id = 'tech_stack'
  name = 'Tech Stack'
  section_type = 'tech_stack' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { seed_domains, report_id } = input

    if (seed_domains.length === 0) {
      return {
        section_type: this.section_type,
        status: 'no_data',
        data: { stack: [] },
        sources: [],
        raw_fetches: [],
        error_message: 'No seed domains provided',
      }
    }

    const detectedTech = new Map<string, TechStackItem>()
    const rawFetches = []
    const sources = []

    // Scrape each seed domain (homepage)
    for (const domain of seed_domains.slice(0, 3)) {
      const url = `https://${domain}`
      const startTime = Date.now()

      try {
        console.log(`[TechStack] Scraping ${domain}`)
        const result = await firecrawl.scrape(url, { 
          formats: ['html'],
          onlyMainContent: false, // Need full HTML for tech detection
        }) as any

        const latencyMs = Date.now() - startTime
        const html = result.html || ''
        const markdown = result.markdown || ''
        const combined = html + ' ' + markdown

        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'firecrawl',
          request_url: url,
          request_params: { formats: ['html'] },
          response_body: { html_length: html.length },
          response_status: result.success ? 200 : 500,
          latency_ms: latencyMs,
        })

        sources.push({
          source: 'firecrawl',
          url,
          description: `Tech stack analysis for ${domain}`,
          fetched_at: new Date().toISOString(),
        })

        // Detect technologies
        for (const [key, sig] of Object.entries(TECH_SIGNATURES)) {
          for (const pattern of sig.patterns) {
            if (combined.toLowerCase().includes(pattern.toLowerCase())) {
              const existing = detectedTech.get(key)
              if (existing) {
                existing.confidence = 'high'
                if (!existing.detected_on.includes(domain)) {
                  existing.detected_on.push(domain)
                }
                existing.evidence = `Found "${pattern}" in ${existing.detected_on.length} domain(s)`
              } else {
                detectedTech.set(key, {
                  name: sig.name,
                  category: sig.category,
                  confidence: seed_domains.length > 1 ? 'medium' : 'high',
                  detected_on: [domain],
                  evidence: `Found "${pattern}" in page source`,
                })
              }
              break // One match per tech per domain is enough
            }
          }
        }
      } catch (error) {
        console.error(`[TechStack] Error scraping ${domain}:`, error)
        rawFetches.push({
          report_id,
          connector_id: this.id,
          source: 'firecrawl',
          request_url: url,
          request_params: { formats: ['html'] },
          response_body: { error: String(error) },
          response_status: 500,
          latency_ms: Date.now() - startTime,
        })
      }
    }

    const stack = Array.from(detectedTech.values())
      .sort((a, b) => {
        // High confidence first, then by category
        const confidenceOrder = { high: 0, medium: 1, low: 2 }
        const conf = confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
        if (conf !== 0) return conf
        return a.category.localeCompare(b.category)
      })

    return {
      section_type: this.section_type,
      status: stack.length > 0 ? 'completed' : 'no_data',
      data: { 
        stack, 
        total_detected: detectedTech.size,
        categories: [...new Set(stack.map(t => t.category))],
      },
      sources,
      raw_fetches: rawFetches,
    }
  }
}
