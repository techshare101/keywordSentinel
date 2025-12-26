-- Add last_scanned column to keywords table for fair scanning
ALTER TABLE public.keywords
ADD COLUMN IF NOT EXISTS last_scanned TIMESTAMPTZ;
