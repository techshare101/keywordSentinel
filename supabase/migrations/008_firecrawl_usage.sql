-- Firecrawl usage tracking table
-- Tracks all Firecrawl API calls for rate limiting and budget management

CREATE TABLE IF NOT EXISTS public.firecrawl_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('scrape', 'enrich')),
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying by user and time
CREATE INDEX IF NOT EXISTS idx_firecrawl_usage_user_created 
  ON public.firecrawl_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_firecrawl_usage_created 
  ON public.firecrawl_usage(created_at DESC);

-- Add enriched_content column to matches table for storing Firecrawl enrichment
ALTER TABLE public.matches 
  ADD COLUMN IF NOT EXISTS enriched_content TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- RLS policies
ALTER TABLE public.firecrawl_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own firecrawl usage"
  ON public.firecrawl_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert firecrawl usage"
  ON public.firecrawl_usage FOR INSERT
  WITH CHECK (true);
