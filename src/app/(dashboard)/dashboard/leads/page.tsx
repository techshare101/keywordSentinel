'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  Target,
  TrendingUp,
  ExternalLink,
  Star,
  MessageSquare,
  Zap,
  ThumbsUp,
  AlertTriangle,
} from 'lucide-react'
import { ReplyGenerator } from '@/components/dashboard/reply-generator'
import { LeadReAnalyzer } from '@/components/dashboard/lead-re-analyzer'
import { LeadStrategyModal } from '@/components/dashboard/lead-strategy-modal'
import { BookmarkButton } from '@/components/dashboard/bookmark-button'
import { EnrichButton } from '@/components/dashboard/enrich-button'
import type { Match } from '@/types/database'
import { getEffectivePlan } from '@/lib/plans'

interface LeadMatch extends Match {
  keywords: { keyword: string }
  enriched_at?: string | null
}

const scoreColors: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-orange-500',
  cool: 'bg-blue-500',
  cold: 'bg-slate-500',
}

const getScoreCategory = (match: LeadMatch): string => {
  if (match.lead_bucket) return match.lead_bucket
  const score = match.lead_score || 0
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

const getScoreLabel = (match: LeadMatch): string => {
  const category = getScoreCategory(match)
  if (category === 'hot') return '🔥 Hot Lead'
  if (category === 'warm') return '🌡️ Warm Lead'
  return '🧊 Cold Lead'
}

const sourceEmojis: Record<string, string> = {
  reddit: '🔴',
  hackernews: '🟠',
  producthunt: '🟣',
  google_news: '📰',
  twitter: '🐦',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm'>('all')
  const [userPlan, setUserPlan] = useState<string>('free')
  const supabase = createClient()

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userProfile } = await supabase
      .from('users')
      .select('plan, role, trial_ends_at, subscription_status')
      .eq('id', user.id)
      .single()

    if (userProfile) {
      const effectivePlan = getEffectivePlan(userProfile)
      setUserPlan(effectivePlan.plan)
    }

    const { data, error } = await supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .not('lead_score', 'is', null)
      .gte('lead_score', 30)
      .order('lead_score', { ascending: false })
      .limit(50)

    if (!error && data) {
      setLeads(data)
    }
    setLoading(false)
  }

  const filteredLeads = leads.filter(lead => {
    if (filter === 'all') return true
    const category = getScoreCategory(lead)
    return category === filter
  })

  const hotCount = leads.filter(l => getScoreCategory(l) === 'hot').length
  const warmCount = leads.filter(l => getScoreCategory(l) === 'warm').length
  const avgScore = leads.length > 0
    ? Math.round(leads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / leads.length)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Scoring</h1>
          <p className="text-slate-400">
            AI-identified high-value opportunities ranked by conversion potential.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{leads.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm hover:border-red-500/20 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">🔥 Hot Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{hotCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm hover:border-orange-500/20 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">🌡️ Warm Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{warmCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{avgScore}</div>
          </CardContent>
        </Card>
      </div>

      {/* Monetization Banner for Free users */}
      {userPlan === 'free' && (
        <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm overflow-hidden group">
          <div className="flex flex-col md:flex-row items-center justify-between p-4 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">🔥 Hot Leads are hidden on Free</h3>
                <p className="text-xs text-slate-400">🔥 Want deeper insight or a ready-to-send reply? Upgrade to Pro to unlock premium analysis.</p>
              </div>
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" asChild>
              <a href="/pricing">Unlock Hot Leads</a>
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-emerald-600' : 'border-slate-700 text-slate-300'}
        >
          All Leads
        </Button>
        <Button
          variant={filter === 'hot' ? 'default' : 'outline'}
          onClick={() => setFilter('hot')}
          className={filter === 'hot' ? 'bg-red-600' : 'border-slate-700 text-slate-300'}
        >
          🔥 Hot Only
        </Button>
        <Button
          variant={filter === 'warm' ? 'default' : 'outline'}
          onClick={() => setFilter('warm')}
          className={filter === 'warm' ? 'bg-orange-600' : 'border-slate-700 text-slate-300'}
        >
          🌡️ Warm Only
        </Button>
      </div>

      {/* Leads List */}
      {filteredLeads.length > 0 ? (
        <div className="space-y-4">
          {filteredLeads.map((lead) => {
            const score = lead.lead_score || 0
            const category = getScoreCategory(lead)

            return (
              <Card key={lead.id} className="border-slate-800 bg-slate-900 overflow-hidden">
                <div className="flex relative">
                  {/* Score Bar */}
                  <div className={`w-2 ${scoreColors[category]}`} />

                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex-1 min-w-0 ${userPlan === 'free' && category === 'hot' ? 'blur-sm select-none' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{sourceEmojis[lead.source]}</span>
                          <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {lead.keywords?.keyword}
                          </Badge>
                          <Badge
                            className={`${category === 'hot' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              category === 'warm' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              }`}
                          >
                            {getScoreLabel(lead)}
                          </Badge>
                        </div>

                        <h3 className="font-medium text-white mb-2 line-clamp-2">
                          {lead.title}
                        </h3>

                        {lead.ai_summary && (
                          <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                            {lead.ai_summary}
                          </p>
                        )}

                        {/* Score Breakdown */}
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-emerald-400" />
                            <span className="text-slate-400">Score:</span>
                            <span className="text-white font-medium">{score}/100</span>
                          </div>
                          {lead.sentiment && (
                            <div className="flex items-center gap-1">
                              {lead.sentiment === 'positive' ? (
                                <ThumbsUp className="h-3 w-3 text-emerald-400" />
                              ) : lead.sentiment === 'negative' ? (
                                <AlertTriangle className="h-3 w-3 text-red-400" />
                              ) : (
                                <MessageSquare className="h-3 w-3 text-slate-400" />
                              )}
                              <span className="text-slate-400 capitalize">{lead.sentiment}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-slate-500">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Score Progress */}
                        <div className="mt-3">
                          <Progress value={score} className="h-1.5 bg-slate-800" />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {userPlan === 'free' && category === 'hot' ? (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs" asChild>
                            <a href="/pricing">Unlock</a>
                          </Button>
                        ) : (
                          <>
                            <BookmarkButton
                              matchId={lead.id}
                              initialBookmarked={lead.is_bookmarked || false}
                            />
                            <EnrichButton
                              matchId={lead.id}
                              url={lead.url}
                              isEnriched={!!lead.enriched_at}
                              userPlan={userPlan}
                            />
                            <LeadReAnalyzer
                              lead={lead}
                              userPlan={userPlan}
                            />
                            <LeadStrategyModal
                              lead={lead}
                              userPlan={userPlan}
                            />
                            <ReplyGenerator
                              matchId={lead.id}
                              title={lead.title}
                              content={lead.content}
                              source={lead.source}
                              url={lead.url}
                              userPlan={userPlan}
                            />
                            <a
                              href={lead.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Free Plan Overlay for Hot Leads */}
                  {userPlan === 'free' && category === 'hot' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
                      <div className="text-center p-4">
                        <Zap className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-white mb-1">🔥 Hot Lead detected!</p>
                        <p className="text-xs text-slate-300">Upgrade to Pro to unlock this conversion opportunity.</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-slate-800 p-4 mb-4">
              <Target className="h-8 w-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No leads yet</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              When matches are scanned, AI will score them based on conversion potential. High-scoring leads will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
