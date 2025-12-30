-- Migration: Add admin roles and trial support
-- This adds role column for admin/tester access and ensures trial_ends_at exists

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Add trial_ends_at if not exists (for 7-day trial tracking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- Add subscription_status if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- Set founders as admin (update with your actual emails)
UPDATE users SET role = 'admin' WHERE email IN (
  'support@metalmindtech.com',
  'valentinv2000@gmail.com',
  'valentin2v2000@gmail.com'
);

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- RLS Policy: Admins can view all users (for analytics)
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- RLS Policy: Admins can view all keywords
DROP POLICY IF EXISTS "Admins can view all keywords" ON keywords;
CREATE POLICY "Admins can view all keywords" ON keywords
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- RLS Policy: Admins can view all matches
DROP POLICY IF EXISTS "Admins can view all matches" ON matches;
CREATE POLICY "Admins can view all matches" ON matches
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- RLS Policy: Admins can view all teams
DROP POLICY IF EXISTS "Admins can view all teams" ON teams;
CREATE POLICY "Admins can view all teams" ON teams
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm 
      WHERE tm.team_id = teams.id 
      AND tm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );
