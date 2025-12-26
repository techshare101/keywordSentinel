'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { 
  Plus, 
  Target, 
  Trash2, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Minus,
  ExternalLink,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Keyword, Match } from '@/types/database'

interface CompetitorData {
  keyword: Keyword
  matches: Match[]
  sentiment: {
    positive: number
    neutral: number
    negative: number
  }
  trend: 'up' | 'down' | 'stable'
  recentMentions: number
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([])
  const [loading, setLoading] = useState(true)
  const [newCompetitor, setNewCompetitor] = useState('')
  const [adding, setAdding] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchCompetitors()
  }, [])

  const fetchCompetitors = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get keywords that are marked as competitors (we'll use a naming convention: starts with @)
    const { data: keywords, error } = await supabase
      .from('keywords')
      .select('*')
      .eq('user_id', user.id)
      .like('keyword', '@%')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to fetch competitors')
      setLoading(false)
      return
    }

    // Get matches for each competitor
    const competitorData: CompetitorData[] = []
    
    for (const keyword of keywords || []) {
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('keyword_id', keyword.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const allMatches = matches || []
      
      // Calculate sentiment breakdown
      const sentiment = {
        positive: allMatches.filter(m => m.sentiment === 'positive').length,
        neutral: allMatches.filter(m => m.sentiment === 'neutral').length,
        negative: allMatches.filter(m => m.sentiment === 'negative').length,
      }

      // Calculate trend (compare last 7 days vs previous 7 days)
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const recentMatches = allMatches.filter(m => new Date(m.created_at) >= oneWeekAgo)
      const previousMatches = allMatches.filter(m => 
        new Date(m.created_at) >= twoWeeksAgo && new Date(m.created_at) < oneWeekAgo
      )

      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (recentMatches.length > previousMatches.length * 1.2) {
        trend = 'up'
      } else if (recentMatches.length < previousMatches.length * 0.8) {
        trend = 'down'
      }

      competitorData.push({
        keyword,
        matches: allMatches,
        sentiment,
        trend,
        recentMentions: recentMatches.length,
      })
    }

    setCompetitors(competitorData)
    setLoading(false)
  }

  const addCompetitor = async () => {
    if (!newCompetitor.trim()) {
      toast.error('Please enter a competitor name')
      return
    }

    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Add @ prefix to mark as competitor
    const competitorKeyword = `@${newCompetitor.trim().toLowerCase()}`

    const { data, error } = await supabase
      .from('keywords')
      .insert({
        user_id: user.id,
        keyword: competitorKeyword,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        toast.error('This competitor is already being tracked')
      } else {
        toast.error('Failed to add competitor')
      }
      setAdding(false)
      return
    }

    // Add to local state
    setCompetitors([
      {
        keyword: data,
        matches: [],
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        trend: 'stable',
        recentMentions: 0,
      },
      ...competitors,
    ])
    
    setNewCompetitor('')
    setDialogOpen(false)
    setAdding(false)
    toast.success('Competitor added! We\'ll start tracking mentions.')
  }

  const deleteCompetitor = async (id: string) => {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to remove competitor')
      return
    }

    setCompetitors(competitors.filter(c => c.keyword.id !== id))
    toast.success('Competitor removed')
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-emerald-400" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-400" />
      default:
        return <Minus className="h-4 w-4 text-slate-400" />
    }
  }

  const getSentimentBar = (sentiment: { positive: number; neutral: number; negative: number }) => {
    const total = sentiment.positive + sentiment.neutral + sentiment.negative
    if (total === 0) return null

    const positiveWidth = (sentiment.positive / total) * 100
    const neutralWidth = (sentiment.neutral / total) * 100
    const negativeWidth = (sentiment.negative / total) * 100

    return (
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-700">
        <div 
          className="bg-emerald-500" 
          style={{ width: `${positiveWidth}%` }} 
        />
        <div 
          className="bg-slate-500" 
          style={{ width: `${neutralWidth}%` }} 
        />
        <div 
          className="bg-red-500" 
          style={{ width: `${negativeWidth}%` }} 
        />
      </div>
    )
  }

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
          <h1 className="text-2xl font-bold text-white">Competitor Watchlist</h1>
          <p className="text-slate-400">
            Track competitor mentions and sentiment across the web.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add Competitor
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Add Competitor</DialogTitle>
              <DialogDescription className="text-slate-400">
                Enter a competitor name to start tracking their mentions and sentiment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="competitor" className="text-slate-300">Competitor Name</Label>
                <Input
                  id="competitor"
                  placeholder="e.g., Notion, Slack, Airtable"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={addCompetitor}
                disabled={adding}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Competitor'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {competitors.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => (
            <Card key={competitor.keyword.id} className="border-slate-800 bg-slate-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-purple-500/10 p-2">
                      <Target className="h-4 w-4 text-purple-400" />
                    </div>
                    <CardTitle className="text-lg text-white">
                      {competitor.keyword.keyword.replace('@', '')}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCompetitor(competitor.keyword.id)}
                    className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Total Mentions</p>
                    <p className="text-2xl font-bold text-white">{competitor.matches.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">This Week</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-white">{competitor.recentMentions}</p>
                      {getTrendIcon(competitor.trend)}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-2">Sentiment</p>
                  {getSentimentBar(competitor.sentiment)}
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-emerald-400">{competitor.sentiment.positive} positive</span>
                    <span className="text-slate-400">{competitor.sentiment.neutral} neutral</span>
                    <span className="text-red-400">{competitor.sentiment.negative} negative</span>
                  </div>
                </div>

                {competitor.matches.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-xs text-slate-500 mb-2">Latest Mention</p>
                    <a
                      href={competitor.matches[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-300 hover:text-white line-clamp-2 flex items-start gap-1"
                    >
                      {competitor.matches[0].title}
                      <ExternalLink className="h-3 w-3 shrink-0 mt-1" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-slate-800 p-4 mb-4">
              <Target className="h-8 w-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No competitors tracked</h3>
            <p className="text-sm text-slate-400 mb-4 max-w-sm">
              Add competitors to track their mentions, sentiment, and trends across the web.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Competitor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
