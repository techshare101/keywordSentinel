-- Create scan_runs table to track metric history of each cron run
CREATE TABLE IF NOT EXISTS public.scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  keywords_scanned INTEGER NOT NULL DEFAULT 0,
  matches_found INTEGER NOT NULL DEFAULT 0,
  aborted BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  duration_ms INTEGER
);

-- Index for fast lookup of recent runs
CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at ON public.scan_runs(started_at DESC);

-- Enable RLS (though typically only read by admins or system)
ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;

-- Allow users to view scan metrics (if they have dashboard access)
-- Note: In a true multi-tenant system, this table might be per-user or shared.
-- For now, we'll allow all authenticated users to see the global scan history.
CREATE POLICY "Users can view scan metrics" ON public.scan_runs
  FOR SELECT USING (auth.role() = 'authenticated');
