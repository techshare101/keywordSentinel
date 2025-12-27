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
  Loader2
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

const sourceIcons: Record<string, string> = {
  reddit: '🔴',
  hackernews: '🟠',
  producthunt: '🟣',
  google_news: '📰',
  twitter: '🐦',
}

export function InsightsOverview() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
            <CardTitle className="text-sm font-medium text-white">Buyer Intent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(breakdown.intent).map(([intent, count]) => (
                <Badge 
                  key={intent}
                  variant="outline"
                  className={`
                    ${intent === 'buying' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : ''}
                    ${intent === 'researching' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : ''}
                    ${intent === 'complaining' ? 'bg-red-500/10 text-red-400 border-red-500/30' : ''}
                    ${intent === 'casual' ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' : ''}
                    ${intent === 'irrelevant' ? 'bg-slate-700/10 text-slate-500 border-slate-700/30' : ''}
                  `}
                >
                  {intent}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
