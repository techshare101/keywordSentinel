-- Signal Map (ICP Signal Map) — Phase 1 schema
-- Discussion venues, question mining, AI answer share

-- Signal Map reports
CREATE TABLE public.signal_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  icp_description TEXT NOT NULL,
  seed_domains TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raw fetches — every external API call stored for audit trail
CREATE TABLE public.signal_raw_fetches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.signal_reports(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  source TEXT NOT NULL,
  request_url TEXT,
  request_params JSONB DEFAULT '{}',
  response_body JSONB,
  response_status INTEGER,
  latency_ms INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signal sections — parsed results per section
CREATE TABLE public.signal_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.signal_reports(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'discussion_venues',
    'question_mining',
    'industry_hubs',
    'podcasts',
    'youtube_channels',
    'tech_stack',
    'ai_answer_share'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'no_data', 'error')),
  data JSONB NOT NULL DEFAULT '{}',
  sources JSONB DEFAULT '[]',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, section_type)
);

-- Indexes
CREATE INDEX idx_signal_reports_user_id ON public.signal_reports(user_id);
CREATE INDEX idx_signal_reports_status ON public.signal_reports(status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_signal_reports_created_at ON public.signal_reports(created_at DESC);
CREATE INDEX idx_signal_raw_fetches_report_id ON public.signal_raw_fetches(report_id);
CREATE INDEX idx_signal_sections_report_id ON public.signal_sections(report_id);

-- RLS
ALTER TABLE public.signal_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_raw_fetches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_sections ENABLE ROW LEVEL SECURITY;

-- Signal reports policies
CREATE POLICY "Users can view own signal reports" ON public.signal_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own signal reports" ON public.signal_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own signal reports" ON public.signal_reports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own signal reports" ON public.signal_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Raw fetches policies (accessible via report ownership)
CREATE POLICY "Users can view raw fetches for own reports" ON public.signal_raw_fetches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.signal_reports WHERE id = signal_raw_fetches.report_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert raw fetches for own reports" ON public.signal_raw_fetches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.signal_reports WHERE id = signal_raw_fetches.report_id AND user_id = auth.uid())
  );

-- Signal sections policies (accessible via report ownership)
CREATE POLICY "Users can view sections for own reports" ON public.signal_sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.signal_reports WHERE id = signal_sections.report_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert sections for own reports" ON public.signal_sections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.signal_reports WHERE id = signal_sections.report_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update sections for own reports" ON public.signal_sections
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.signal_reports WHERE id = signal_sections.report_id AND user_id = auth.uid())
  );
