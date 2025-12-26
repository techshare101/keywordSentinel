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
import { BookmarkButton } from '@/components/dashboard/bookmark-button'
import type { Match } from '@/types/database'

interface LeadMatch extends Match {
  keywords: { keyword: string }
}

const scoreColors: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-orange-500',
  cool: 'bg-blue-500',
  cold: 'bg-slate-500',
}

const getScoreCategory = (score: number): string => {
  if (score >= 80) return 'hot'
  if (score >= 60) return 'warm'
  if (score >= 40) return 'cool'
  return 'cold'
}

const getScoreLabel = (score: number): string => {
  if (score >= 80) return '🔥 Hot Lead'
  if (score >= 60) return '🌡️ Warm Lead'
  if (score >= 40) return '❄️ Cool Lead'
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
  const supabase = createClient()

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
    if (filter === 'hot') return (lead.lead_score || 0) >= 80
    if (filter === 'warm') return (lead.lead_score || 0) >= 60 && (lead.lead_score || 0) < 80
    return true
  })

  const hotCount = leads.filter(l => (l.lead_score || 0) >= 80).length
  const warmCount = leads.filter(l => (l.lead_score || 0) >= 60 && (l.lead_score || 0) < 80).length
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
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{leads.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">🔥 Hot Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{hotCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">🌡️ Warm Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-400">{warmCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{avgScore}</div>
          </CardContent>
        </Card>
      </div>

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
            const category = getScoreCategory(score)
            
            return (
              <Card key={lead.id} className="border-slate-800 bg-slate-900 overflow-hidden">
                <div className="flex">
                  {/* Score Bar */}
                  <div className={`w-2 ${scoreColors[category]}`} />
                  
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{sourceEmojis[lead.source]}</span>
                          <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {lead.keywords?.keyword}
                          </Badge>
                          <Badge 
                            className={`${
                              category === 'hot' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              category === 'warm' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                              'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {getScoreLabel(score)}
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
                        <BookmarkButton
                          matchId={lead.id}
                          initialBookmarked={lead.is_bookmarked || false}
                        />
                        <ReplyGenerator
                          matchId={lead.id}
                          title={lead.title}
                          content={lead.content}
                          source={lead.source}
                          url={lead.url}
                        />
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
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
