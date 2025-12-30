-- Fix RLS policy to allow team members to see basic info of other team members
-- This is needed for the team_members join to users table to work

-- Add policy allowing users to see basic info of team members in their teams
CREATE POLICY "Users can view team members basic info" ON public.users
  FOR SELECT USING (
    id IN (
      SELECT tm.user_id 
      FROM public.team_members tm 
      WHERE tm.team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Note: This policy allows users to see email and full_name of other users
-- who are members of the same team(s) they belong to.
-- The existing "Users can view own profile" policy still applies for their own data.
