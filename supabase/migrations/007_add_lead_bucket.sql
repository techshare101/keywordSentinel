-- Add lead_bucket column to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lead_bucket TEXT DEFAULT 'neutral';

-- Update types for lead_bucket if needed (optional, keeping it as TEXT for flexibility)
COMMENT ON COLUMN public.matches.lead_bucket IS 'Bucket for lead prioritization: hot, warm, cold, neutral';
