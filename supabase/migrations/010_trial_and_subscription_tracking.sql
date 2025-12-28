-- Add trial and subscription tracking fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'; -- none, trialing, active, canceled, past_due
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMP WITH TIME ZONE;

-- Set trial_ends_at for new free users (7 days from creation)
-- This will be set by the application when user signs up

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Function to check if trial is active
CREATE OR REPLACE FUNCTION is_trial_active(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT trial_ends_at, subscription_status, plan INTO user_record
  FROM users WHERE id = user_id;
  
  -- If paid plan, no trial needed
  IF user_record.plan IN ('starter', 'pro', 'business', 'enterprise') AND user_record.subscription_status = 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if trial is still valid
  IF user_record.trial_ends_at IS NOT NULL AND user_record.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get days remaining in trial
CREATE OR REPLACE FUNCTION trial_days_remaining(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  ends_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT trial_ends_at INTO ends_at FROM users WHERE id = user_id;
  
  IF ends_at IS NULL OR ends_at <= NOW() THEN
    RETURN 0;
  END IF;
  
  RETURN EXTRACT(DAY FROM (ends_at - NOW()))::INTEGER + 1;
END;
$$ LANGUAGE plpgsql;
