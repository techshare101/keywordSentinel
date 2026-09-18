// Signal Map types — ICP Signal Map feature

export type SignalReportStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial'
export type SignalSectionType =
  | 'discussion_venues'
  | 'question_mining'
  | 'industry_hubs'
  | 'podcasts'
  | 'youtube_channels'
  | 'tech_stack'
  | 'ai_answer_share'
export type SignalSectionStatus = 'pending' | 'completed' | 'no_data' | 'error'

export interface SignalReport {
  id: string
  user_id: string
  icp_description: string
  seed_domains: string[]
  status: SignalReportStatus
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  sections?: SignalSection[]
}

export interface SignalRawFetch {
  id: string
  report_id: string
  connector_id: string
  source: string
  request_url: string | null
  request_params: Record<string, unknown>
  response_body: unknown
  response_status: number | null
  latency_ms: number | null
  fetched_at: string
}

export interface SignalSection {
  id: string
  report_id: string
  section_type: SignalSectionType
  status: SignalSectionStatus
  data: Record<string, unknown>
  sources: SignalSource[]
  error_message: string | null
  created_at: string
}

export interface SignalSource {
  url?: string
  source: string
  fetched_at: string
  description?: string
}

// ---- Section data shapes ----

export interface DiscussionVenue {
  subreddit: string
  post_count: number
  avg_score?: number
  avg_comments?: number
  top_posts: { title: string; url: string; score: number; created_utc: string }[]
  description?: string
  date_range: { from: string; to: string }
}

export interface MinedQuestion {
  question: string
  source_url: string
  source: 'reddit' | 'paa' | 'forum'
  frequency?: number
  related_terms?: string[]
}

export interface AIAnswerEntry {
  engine: 'chatgpt' | 'perplexity' | 'gemini'
  query: string
  raw_response: string
  businesses_mentioned: string[]
  sources_cited: string[]
  fetched_at: string
}

export interface IndustryHub {
  domain: string
  title: string
  description: string
  mention_count: number
  source_urls: string[]
  category: 'resource' | 'community' | 'news' | 'tool' | 'vendor' | 'other'
}

export interface TechStackItem {
  name: string
  category: 'cms' | 'analytics' | 'crm' | 'ecommerce' | 'advertising' | 'cdn' | 'framework' | 'other'
  confidence: 'high' | 'medium' | 'low'
  detected_on: string[]
  evidence: string
}

// ---- Connector interface ----

export interface SignalConnectorInput {
  icp_description: string
  seed_domains: string[]
  report_id: string
  user_id: string
}

export interface SignalConnectorResult {
  section_type: SignalSectionType
  status: SignalSectionStatus
  data: Record<string, unknown>
  sources: SignalSource[]
  raw_fetches: Omit<SignalRawFetch, 'id' | 'fetched_at'>[]
  error_message?: string
}

export interface SignalConnector {
  id: string
  name: string
  section_type: SignalSectionType
  fetch(input: SignalConnectorInput): Promise<SignalConnectorResult>
}
