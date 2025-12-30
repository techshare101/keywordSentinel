-- Migration: Add support for test alerts in alerts table
-- Test alerts don't have a real match_id, so we need to make it nullable
-- and add is_test flag to distinguish them

-- Make match_id nullable for test alerts
ALTER TABLE alerts ALTER COLUMN match_id DROP NOT NULL;

-- Add is_test column to distinguish test alerts from real ones
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- Add alert_type column for categorizing alerts
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type TEXT DEFAULT 'match';

-- Add message column for test alert content
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message TEXT;

-- Create index for filtering test alerts
CREATE INDEX IF NOT EXISTS idx_alerts_is_test ON alerts(is_test);
