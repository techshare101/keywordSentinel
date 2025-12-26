export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          plan: 'free' | 'pro' | 'team' | 'enterprise'
          keywords_limit: number
          scan_interval_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          plan?: 'free' | 'pro' | 'team' | 'enterprise'
          keywords_limit?: number
          scan_interval_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          plan?: 'free' | 'pro' | 'team' | 'enterprise'
          keywords_limit?: number
          scan_interval_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          user_id: string
          keyword: string
          is_active: boolean
          created_at: string
          updated_at: string
          last_scanned: string | null
        }
        Insert: {
          id?: string
          user_id: string
          keyword: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_scanned?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          keyword?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_scanned?: string | null
        }
      }
      matches: {
        Row: {
          id: string
          keyword_id: string
          user_id: string
          source: 'reddit' | 'hackernews' | 'producthunt' | 'google_news' | 'twitter'
          title: string
          content: string
          url: string
          author: string | null
          sentiment: 'positive' | 'negative' | 'neutral' | null
          ai_summary: string | null
          lead_score: number | null
          lead_bucket: string | null
          is_read: boolean
          is_bookmarked: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          keyword_id: string
          user_id: string
          source: 'reddit' | 'hackernews' | 'producthunt' | 'google_news' | 'twitter'
          title: string
          content: string
          url: string
          author?: string | null
          sentiment?: 'positive' | 'negative' | 'neutral' | null
          ai_summary?: string | null
          lead_score?: number | null
          lead_bucket?: string | null
          is_read?: boolean
          is_bookmarked?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          keyword_id?: string
          user_id?: string
          source?: 'reddit' | 'hackernews' | 'producthunt' | 'google_news' | 'twitter'
          title?: string
          content?: string
          url?: string
          author?: string | null
          sentiment?: 'positive' | 'negative' | 'neutral' | null
          ai_summary?: string | null
          lead_score?: number | null
          lead_bucket?: string | null
          is_read?: boolean
          is_bookmarked?: boolean
          notes?: string | null
          created_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          match_id: string
          user_id: string
          channel: 'email' | 'slack' | 'discord'
          sent_at: string
          status: 'pending' | 'sent' | 'failed'
        }
        Insert: {
          id?: string
          match_id: string
          user_id: string
          channel: 'email' | 'slack' | 'discord'
          sent_at?: string
          status?: 'pending' | 'sent' | 'failed'
        }
        Update: {
          id?: string
          match_id?: string
          user_id?: string
          channel?: 'email' | 'slack' | 'discord'
          sent_at?: string
          status?: 'pending' | 'sent' | 'failed'
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          email_alerts: boolean
          slack_webhook: string | null
          discord_webhook: string | null
          alert_frequency: 'instant' | 'hourly' | 'daily'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_alerts?: boolean
          slack_webhook?: string | null
          discord_webhook?: string | null
          alert_frequency?: 'instant' | 'hourly' | 'daily'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_alerts?: boolean
          slack_webhook?: string | null
          discord_webhook?: string | null
          alert_frequency?: 'instant' | 'hourly' | 'daily'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type User = Database['public']['Tables']['users']['Row']
export type Keyword = Database['public']['Tables']['keywords']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']

export type SourceType = Match['source']
export type SentimentType = Match['sentiment']
export type PlanType = User['plan']
