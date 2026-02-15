'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Thermometer, 
  Eye, 
  DollarSign,
  BarChart3,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'

interface InsightsData {
  overview: {
    totalMatches: number
    matchesLast7Days: number
    hotLeads: number
    warmLeads: number
    unseenCount: number
    estimatedValue: number
    growthPercentage: number
  }
  breakdown: {
    sentiment: { positive: number; negative: number; neutral: number }
    sources: { source: string; count: number }[]
    intent: Record<string, number>
  }
  trends: {
    daily: { date: string; count: number }[]
  }
}

interface IntentMatch {
  id: string
  title: string
  url: string
  source: string
  lead_score: number | null
  lead_bucket: string | null
  created_at: string
}

interface IntentKeywordGroup {
  keyword: string
  matches: IntentMatch[]
}

interface IntentDetail {
  intent: string
  totalMatches: number
  keywords: IntentKeywordGroup[]
}

const sourceIcons: Record<string, string> = {
  reddit: '🔴',
  hackernews: '🟠',
  producthunt: '🟣',
  google_news: '📰',
  twitter: '🐦',
  devto: '📝',
  stackoverflow: '📚',
  github: '🐙',
}

const intentColors: Record<string, string> = {
  buying: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  researching: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  complaining: 'bg-red-500/10 text-red-400 border-red-500/30',
  casual: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  irrelevant: 'bg-slate-700/10 text-slate-500 border-slate-700/30',
  unknown: 'bg-slate-700/10 text-slate-500 border-slate-700/30',
}

const intentActiveColors: Record<string, string> = {
  buying: 'bg-emerald-500/30 text-emerald-300 border-emerald-400 ring-1 ring-emerald-400/50',
  researching: 'bg-blue-500/30 text-blue-300 border-blue-400 ring-1 ring-blue-400/50',
  complaining: 'bg-red-500/30 text-red-300 border-red-400 ring-1 ring-red-400/50',
  casual: 'bg-slate-500/30 text-slate-300 border-slate-400 ring-1 ring-slate-400/50',
  irrelevant: 'bg-slate-700/30 text-slate-400 border-slate-500 ring-1 ring-slate-500/50',
  unknown: 'bg-slate-700/30 text-slate-400 border-slate-500 ring-1 ring-slate-500/50',
}

export function InsightsOverview() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const [intentDetail, setIntentDetail] = useState<IntentDetail | null>(null)
  const [intentLoading, setIntentLoading] = useState(false)
  const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchInsights() {
      try {
        const response = await fetch('/api/insights/overview')
        const result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch insights')
        }
        
        setData(result)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch insights:', err)
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInsights()
    // Refresh every 2 minutes
    const interval = setInterval(fetchInsights, 120000)
    return () => clearInterval(interval)
  }, [])

  const handleIntentClick = async (intent: string) => {
    if (selectedIntent === intent) {
      // Toggle off
      setSelectedIntent(null)
      setIntentDetail(null)
      setExpandedKeywords(new Set())
      return
    }

    setSelectedIntent(intent)
    setIntentLoading(true)
    setExpandedKeywords(new Set())

    try {
      const response = await fetch(`/api/insights/intent?intent=${encodeURIComponent(intent)}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch intent details')
      }

      setIntentDetail(result)
    } catch (err) {
      console.error('Failed to fetch intent detail:', err)
      setIntentDetail(null)
    } finally {
      setIntentLoading(false)
    }
  }

  const toggleKeywordExpand = (keyword: string) => {
    setExpandedKeywords(prev => {
      const next = new Set(prev)
      if (next.has(keyword)) {
        next.delete(keyword)
      } else {
        next.add(keyword)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return null
  }

  const { overview, breakdown, trends } = data

  // Calculate max for chart scaling
  const maxDaily = Math.max(...trends.daily.map(d => d.count), 1)

  return (
    <div className="space-y-4">
      {/* Key Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Hot Leads</p>
                <p className="text-2xl font-bold text-white">{overview.hotLeads}</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-2">
                <Flame className="h-5 w-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Warm Leads</p>
                <p className="text-2xl font-bold text-white">{overview.warmLeads}</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Thermometer className="h-5 w-5 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Unseen</p>
                <p className="text-2xl font-bold text-white">{overview.unseenCount}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Eye className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Est. Value</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ${overview.estimatedValue.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend & Breakdown Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 7-Day Trend Chart */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                7-Day Trend
              </CardTitle>
              <Badge 
                variant="outline" 
                className={`text-xs ${overview.growthPercentage >= 0 ? 'text-emerald-400 border-emerald-400/30' : 'text-red-400 border-red-400/30'}`}
              >
                {overview.growthPercentage >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {overview.growthPercentage >= 0 ? '+' : ''}{overview.growthPercentage}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {trends.daily.map((day, i) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-emerald-500/80 rounded-t transition-all hover:bg-emerald-400"
                    style={{ height: `${(day.count / maxDaily) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[10px] text-slate-500">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {overview.matchesLast7Days} matches this week
            </p>
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Top Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {breakdown.sources.length > 0 ? (
                breakdown.sources.map((source) => (
                  <div key={source.source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{sourceIcons[source.source] || '🌐'}</span>
                      <span className="text-sm text-slate-300 capitalize">
                        {source.source.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ 
                            width: `${(source.count / (breakdown.sources[0]?.count || 1)) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-white w-8 text-right">
                        {source.count}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  No source data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment & Intent Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sentiment Breakdown */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Sentiment Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400">Positive</span>
                  <span className="font-medium text-white">{breakdown.sentiment.positive}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ 
                      width: `${(breakdown.sentiment.positive / (overview.totalMatches || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Neutral</span>
                  <span className="font-medium text-white">{breakdown.sentiment.neutral}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-500 rounded-full"
                    style={{ 
                      width: `${(breakdown.sentiment.neutral / (overview.totalMatches || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-400">Negative</span>
                  <span className="font-medium text-white">{breakdown.sentiment.negative}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full"
                    style={{ 
                      width: `${(breakdown.sentiment.negative / (overview.totalMatches || 1)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Intent Breakdown */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white">Buyer Intent</CardTitle>
              {selectedIntent && (
                <button
                  onClick={() => {
                    setSelectedIntent(null)
                    setIntentDetail(null)
                    setExpandedKeywords(new Set())
                  }}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(breakdown.intent).map(([intent, count]) => (
                <button
                  key={intent}
                  onClick={() => handleIntentClick(intent)}
                  className="transition-all"
                >
                  <Badge 
                    variant="outline"
                    className={`cursor-pointer transition-all ${
                      selectedIntent === intent
                        ? intentActiveColors[intent] || intentActiveColors.unknown
                        : intentColors[intent] || intentColors.unknown
                    }`}
                  >
                    {intent}: {count}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Intent Detail Panel */}
            {selectedIntent && (
              <div className="mt-4 border-t border-slate-800 pt-4">
                {intentLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    <span className="ml-2 text-sm text-slate-400">Loading keywords...</span>
                  </div>
                ) : intentDetail && intentDetail.keywords.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 mb-3">
                      {intentDetail.totalMatches} matches across {intentDetail.keywords.length} keyword{intentDetail.keywords.length !== 1 ? 's' : ''}
                    </p>
                    {intentDetail.keywords.map((group) => (
                      <div key={group.keyword} className="rounded-lg border border-slate-800 overflow-hidden">
                        <button
                          onClick={() => toggleKeywordExpand(group.keyword)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
                              {group.keyword}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {group.matches.length} match{group.matches.length !== 1 ? 'es' : ''}
                            </span>
                          </div>
                          {expandedKeywords.has(group.keyword) ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                          )}
                        </button>

                        {expandedKeywords.has(group.keyword) && (
                          <div className="border-t border-slate-800 bg-slate-950/50">
                            {group.matches.slice(0, 10).map((match) => (
                              <a
                                key={match.id}
                                href={match.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800/50 transition-colors group border-b border-slate-800/50 last:border-b-0"
                              >
                                <span className="text-sm shrink-0">
                                  {sourceIcons[match.source] || '🌐'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">
                                    {match.title}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(match.created_at).toLocaleDateString()}
                                    {match.lead_score != null && (
                                      <span className="ml-2">Score: {match.lead_score}</span>
                                    )}
                                  </p>
                                </div>
                                <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-400 shrink-0" />
                              </a>
                            ))}
                            {group.matches.length > 10 && (
                              <p className="text-[10px] text-slate-500 text-center py-1.5">
                                +{group.matches.length - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : intentDetail ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No matches found for &quot;{selectedIntent}&quot; intent
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
