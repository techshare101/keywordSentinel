-- Plans metadata table for subscription tiers
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_id TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  keyword_limit INTEGER NOT NULL,
  scans_per_day INTEGER NOT NULL,
  competitor_tracking BOOLEAN DEFAULT FALSE,
  team_notifications BOOLEAN DEFAULT FALSE,
  slack_alerts BOOLEAN DEFAULT FALSE,
  digest_daily BOOLEAN DEFAULT FALSE,
  digest_weekly BOOLEAN DEFAULT FALSE,
  firecrawl_cap INTEGER DEFAULT 0,
  api_access BOOLEAN DEFAULT FALSE,
  white_label BOOLEAN DEFAULT FALSE,
  team_members INTEGER DEFAULT 1,
  priority_support BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert production plan metadata (AUTHORITATIVE - DO NOT CHANGE PRICE IDs)
INSERT INTO plans (id, name, price_id, price_monthly, keyword_limit, scans_per_day,
  competitor_tracking, team_notifications, slack_alerts,
  digest_daily, digest_weekly, firecrawl_cap, api_access, white_label, team_members, priority_support)
VALUES
  ('free', 'Free', '', 0, 3, 2, FALSE, FALSE, FALSE, FALSE, FALSE, 0, FALSE, FALSE, 1, FALSE),
  ('starter', 'Starter', 'price_1SiY2cGRxp9eu0DJAJYpdXsJ', 19, 7, 15, FALSE, FALSE, FALSE, TRUE, FALSE, 10, FALSE, FALSE, 1, FALSE),
  ('pro', 'Pro', 'price_1SiY5EGRxp9eu0DJvWHdVl9N', 49, 15, 15, TRUE, TRUE, TRUE, TRUE, TRUE, 50, FALSE, FALSE, 3, TRUE),
  ('business', 'Business', 'price_1Sj6eiGRxp9eu0DJbHRNt868', 99, 25, 48, TRUE, TRUE, TRUE, TRUE, TRUE, 200, TRUE, TRUE, 10, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_id = EXCLUDED.price_id,
  price_monthly = EXCLUDED.price_monthly,
  keyword_limit = EXCLUDED.keyword_limit,
  scans_per_day = EXCLUDED.scans_per_day,
  competitor_tracking = EXCLUDED.competitor_tracking,
  team_notifications = EXCLUDED.team_notifications,
  slack_alerts = EXCLUDED.slack_alerts,
  digest_daily = EXCLUDED.digest_daily,
  digest_weekly = EXCLUDED.digest_weekly,
  firecrawl_cap = EXCLUDED.firecrawl_cap,
  api_access = EXCLUDED.api_access,
  white_label = EXCLUDED.white_label,
  team_members = EXCLUDED.team_members,
  priority_support = EXCLUDED.priority_support;

-- Add plan column to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'plan') THEN
    ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free' REFERENCES plans(id);
  END IF;
END $$;

-- Add stripe_customer_id to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Add stripe_subscription_id to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
  END IF;
END $$;

-- RLS policies for plans table
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone" ON plans
  FOR SELECT USING (true);
