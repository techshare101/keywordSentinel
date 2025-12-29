-- Team Access Migration for KeywordSentinel
-- Enables multi-user team access with roles

-- ============================================
-- 1. CREATE TEAMS TABLE
-- ============================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. CREATE TEAM_MEMBERS TABLE
-- ============================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ============================================
-- 3. ADD team_id TO EXISTING TABLES
-- ============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.keywords ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.scan_runs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- ============================================
-- 4. CREATE INDEXES
-- ============================================
CREATE INDEX idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_keywords_team_id ON public.keywords(team_id);
CREATE INDEX idx_matches_team_id ON public.matches(team_id);

-- ============================================
-- 5. HELPER FUNCTION: Get user's team IDs
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_team_ids(uid UUID)
RETURNS SETOF UUID AS $$
  SELECT team_id FROM public.team_members WHERE user_id = uid
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 6. HELPER FUNCTION: Check if user is team admin/owner
-- ============================================
CREATE OR REPLACE FUNCTION public.is_team_admin(uid UUID, tid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE user_id = uid AND team_id = tid AND role IN ('owner', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 7. RLS FOR TEAMS TABLE
-- ============================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams they belong to" ON public.teams
  FOR SELECT USING (
    id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Only owner can update team" ON public.teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Only owner can delete team" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================
-- 8. RLS FOR TEAM_MEMBERS TABLE
-- ============================================
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team members of their teams" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Admins can add team members" ON public.team_members
  FOR INSERT WITH CHECK (
    public.is_team_admin(auth.uid(), team_id)
  );

CREATE POLICY "Admins can update team members" ON public.team_members
  FOR UPDATE USING (
    public.is_team_admin(auth.uid(), team_id)
  );

CREATE POLICY "Admins can remove team members" ON public.team_members
  FOR DELETE USING (
    public.is_team_admin(auth.uid(), team_id)
  );

-- ============================================
-- 9. UPDATE EXISTING RLS POLICIES
-- Now users can access data if:
--   a) They own it directly (user_id = auth.uid()), OR
--   b) They're on the same team (team_id in their teams)
-- ============================================

-- KEYWORDS: Drop old policies and create new ones
DROP POLICY IF EXISTS "Users can view own keywords" ON public.keywords;
DROP POLICY IF EXISTS "Users can insert own keywords" ON public.keywords;
DROP POLICY IF EXISTS "Users can update own keywords" ON public.keywords;
DROP POLICY IF EXISTS "Users can delete own keywords" ON public.keywords;

CREATE POLICY "Users can view keywords" ON public.keywords
  FOR SELECT USING (
    user_id = auth.uid() OR 
    team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Users can insert keywords" ON public.keywords
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR 
    (team_id IN (SELECT public.get_user_team_ids(auth.uid())) AND public.is_team_admin(auth.uid(), team_id))
  );

CREATE POLICY "Users can update keywords" ON public.keywords
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    (team_id IN (SELECT public.get_user_team_ids(auth.uid())) AND public.is_team_admin(auth.uid(), team_id))
  );

CREATE POLICY "Users can delete keywords" ON public.keywords
  FOR DELETE USING (
    user_id = auth.uid() OR 
    (team_id IN (SELECT public.get_user_team_ids(auth.uid())) AND public.is_team_admin(auth.uid(), team_id))
  );

-- MATCHES: Drop old policies and create new ones
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;

CREATE POLICY "Users can view matches" ON public.matches
  FOR SELECT USING (
    user_id = auth.uid() OR 
    team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Users can update matches" ON public.matches
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

-- ALERTS: Drop old policies and create new ones
DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;

CREATE POLICY "Users can view alerts" ON public.alerts
  FOR SELECT USING (
    user_id = auth.uid() OR 
    team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

-- SCAN_RUNS: Update policies
DROP POLICY IF EXISTS "Users can view own scan runs" ON public.scan_runs;
DROP POLICY IF EXISTS "Users can insert own scan runs" ON public.scan_runs;

CREATE POLICY "Users can view scan runs" ON public.scan_runs
  FOR SELECT USING (
    user_id = auth.uid() OR 
    team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  );

CREATE POLICY "Users can insert scan runs" ON public.scan_runs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 10. AUTO-CREATE TEAM ON USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_team_id UUID;
BEGIN
  -- Create user record
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Create default team for user
  INSERT INTO public.teams (owner_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Team')
  RETURNING id INTO new_team_id;
  
  -- Add user as owner of their team
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, NEW.id, 'owner');
  
  -- Update user with team_id
  UPDATE public.users SET team_id = new_team_id WHERE id = NEW.id;
  
  -- Create user settings
  INSERT INTO public.user_settings (user_id, team_id)
  VALUES (NEW.id, new_team_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. BACKFILL: Create teams for existing users
-- ============================================
DO $$
DECLARE
  user_record RECORD;
  new_team_id UUID;
BEGIN
  FOR user_record IN SELECT id, email, full_name FROM public.users WHERE team_id IS NULL
  LOOP
    -- Create team for existing user
    INSERT INTO public.teams (owner_id, name)
    VALUES (user_record.id, COALESCE(user_record.full_name, split_part(user_record.email, '@', 1)) || '''s Team')
    RETURNING id INTO new_team_id;
    
    -- Add user as owner
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team_id, user_record.id, 'owner');
    
    -- Update user's team_id
    UPDATE public.users SET team_id = new_team_id WHERE id = user_record.id;
    
    -- Update user's keywords
    UPDATE public.keywords SET team_id = new_team_id WHERE user_id = user_record.id;
    
    -- Update user's matches
    UPDATE public.matches SET team_id = new_team_id WHERE user_id = user_record.id;
    
    -- Update user's alerts
    UPDATE public.alerts SET team_id = new_team_id WHERE user_id = user_record.id;
    
    -- Update user's settings
    UPDATE public.user_settings SET team_id = new_team_id WHERE user_id = user_record.id;
    
    -- Update user's scan_runs
    UPDATE public.scan_runs SET team_id = new_team_id WHERE user_id = user_record.id;
  END LOOP;
END $$;

-- ============================================
-- 12. TEAM INVITE FUNCTION (for future use)
-- ============================================
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_team_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS UUID AS $$
DECLARE
  new_member_id UUID;
BEGIN
  -- Check if inviter is admin/owner
  IF NOT public.is_team_admin(auth.uid(), p_team_id) THEN
    RAISE EXCEPTION 'Only team admins can invite members';
  END IF;
  
  -- Add member
  INSERT INTO public.team_members (team_id, user_id, role, invited_by)
  VALUES (p_team_id, p_user_id, p_role, auth.uid())
  RETURNING id INTO new_member_id;
  
  -- Update user's team_id if they don't have one
  UPDATE public.users 
  SET team_id = p_team_id 
  WHERE id = p_user_id AND team_id IS NULL;
  
  RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.teams IS 'Teams for multi-user access';
COMMENT ON TABLE public.team_members IS 'Team membership with roles';
COMMENT ON FUNCTION public.get_user_team_ids IS 'Returns all team IDs a user belongs to';
COMMENT ON FUNCTION public.is_team_admin IS 'Checks if user is admin/owner of a team';
COMMENT ON FUNCTION public.invite_team_member IS 'Invites a user to a team';
