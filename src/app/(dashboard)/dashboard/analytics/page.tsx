'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

interface AnalyticsData {
  matchesByDay: Array<{ date: string; count: number }>
  sourceDistribution: Array<{ name: string; value: number; color: string }>
  sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>
  topKeywords: Array<{ keyword: string; count: number }>
  stats: {
    totalMatches: number
    thisWeek: number
    lastWeek: number
    avgPerDay: number
  }
}

const sourceColors: Record<string, string> = {
  reddit: '#FF4500',
  hackernews: '#FF6600',
  producthunt: '#DA552F',
  google_news: '#4285F4',
  twitter: '#1DA1F2',
}

const sourceLabels: Record<string, string> = {
  reddit: 'Reddit',
  hackernews: 'Hacker News',
  producthunt: 'Product Hunt',
  google_news: 'Google News',
  twitter: 'Twitter/X',
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get all matches for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: matches } = await supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    if (!matches) {
      setLoading(false)
      return
    }

    // Process matches by day
    const matchesByDayMap: Record<string, number> = {}
    const sentimentByDayMap: Record<string, { positive: number; neutral: number; negative: number }> = {}
    const sourceCount: Record<string, number> = {}
    const keywordCount: Record<string, number> = {}

    // Initialize last 14 days
    for (let i = 13; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      matchesByDayMap[dateStr] = 0
      sentimentByDayMap[dateStr] = { positive: 0, neutral: 0, negative: 0 }
    }

    matches.forEach((match: any) => {
      const dateStr = new Date(match.created_at).toISOString().split('T')[0]
      
      // Matches by day
      if (matchesByDayMap[dateStr] !== undefined) {
        matchesByDayMap[dateStr]++
      }

      // Sentiment by day
      if (sentimentByDayMap[dateStr] && match.sentiment) {
        sentimentByDayMap[dateStr][match.sentiment as 'positive' | 'neutral' | 'negative']++
      }

      // Source distribution
      sourceCount[match.source] = (sourceCount[match.source] || 0) + 1

      // Keyword performance
      const kw = match.keywords?.keyword || 'unknown'
      keywordCount[kw] = (keywordCount[kw] || 0) + 1
    })

    // Calculate stats
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const thisWeekMatches = matches.filter(m => new Date(m.created_at) >= oneWeekAgo)
    const lastWeekMatches = matches.filter(m => 
      new Date(m.created_at) >= twoWeeksAgo && new Date(m.created_at) < oneWeekAgo
    )

    setData({
      matchesByDay: Object.entries(matchesByDayMap).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      })),
      sourceDistribution: Object.entries(sourceCount).map(([name, value]) => ({
        name: sourceLabels[name] || name,
        value,
        color: sourceColors[name] || '#6B7280',
      })),
      sentimentTrend: Object.entries(sentimentByDayMap).map(([date, sentiment]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...sentiment,
      })),
      topKeywords: Object.entries(keywordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count })),
      stats: {
        totalMatches: matches.length,
        thisWeek: thisWeekMatches.length,
        lastWeek: lastWeekMatches.length,
        avgPerDay: Math.round(matches.length / 30 * 10) / 10,
      },
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BarChart3 className="h-12 w-12 text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No data yet</h3>
        <p className="text-slate-400">Analytics will appear once you have matches.</p>
      </div>
    )
  }

  const weekChange = data.stats.lastWeek > 0 
    ? Math.round((data.stats.thisWeek - data.stats.lastWeek) / data.stats.lastWeek * 100)
    : data.stats.thisWeek > 0 ? 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400">Track your keyword monitoring performance over time.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Matches (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{data.stats.totalMatches}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-white">{data.stats.thisWeek}</span>
              <div className={`flex items-center text-sm ${weekChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {weekChange >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(weekChange)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Last Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{data.stats.lastWeek}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{data.stats.avgPerDay}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matches Over Time */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Matches Over Time</CardTitle>
            <CardDescription className="text-slate-400">Daily match count for the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.matchesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Source Distribution</CardTitle>
            <CardDescription className="text-slate-400">Where your matches come from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sourceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#64748b' }}
                  >
                    {data.sourceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sentiment Trend */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Sentiment Trend</CardTitle>
            <CardDescription className="text-slate-400">Sentiment breakdown over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sentimentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="positive" stackId="a" fill="#10b981" name="Positive" />
                  <Bar dataKey="neutral" stackId="a" fill="#64748b" name="Neutral" />
                  <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Keywords */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Top Keywords</CardTitle>
            <CardDescription className="text-slate-400">Best performing keywords by match count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topKeywords} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis 
                    dataKey="keyword" 
                    type="category" 
                    stroke="#64748b" 
                    fontSize={12}
                    width={120}
                    tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
