-- Add bookmarking and notes to matches
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for faster bookmark queries
CREATE INDEX IF NOT EXISTS idx_matches_bookmarked ON public.matches(user_id, is_bookmarked) WHERE is_bookmarked = true;
