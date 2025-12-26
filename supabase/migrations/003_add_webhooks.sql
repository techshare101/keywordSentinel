-- Add webhooks column to user_settings for integration webhooks
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS webhooks JSONB DEFAULT '[]'::jsonb;

-- Add weekly_digest column to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN NOT NULL DEFAULT true;
