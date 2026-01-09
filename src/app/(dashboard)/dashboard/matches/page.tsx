'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Search, 
  ExternalLink, 
  Loader2, 
  MessageSquare,
  Filter,
  CheckCircle,
  Circle,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Match, SourceType, SentimentType } from '@/types/database'
import { ReplyGenerator } from '@/components/dashboard/reply-generator'
import { ExportButton } from '@/components/dashboard/export-button'
import { BookmarkButton } from '@/components/dashboard/bookmark-button'
import { MatchNotes } from '@/components/dashboard/match-notes'
import { getEffectivePlan } from '@/lib/plans'

interface MatchWithKeyword extends Match {
  keywords: { keyword: string }
}

const sourceLabels: Record<SourceType, { label: string; emoji: string }> = {
  reddit: { label: 'Reddit', emoji: '🔴' },
  hackernews: { label: 'Hacker News', emoji: '🟠' },
  producthunt: { label: 'Product Hunt', emoji: '🟣' },
  google_news: { label: 'Google News', emoji: '📰' },
  twitter: { label: 'Twitter/X', emoji: '🐦' },
  devto: { label: 'Dev.to', emoji: '📝' },
  stackoverflow: { label: 'Stack Overflow', emoji: '📚' },
  github: { label: 'GitHub', emoji: '🐙' },
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  negative: 'bg-red-500/10 text-red-400 border-red-500/20',
  neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchWithKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [userPlan, setUserPlan] = useState<string>('trial')
  const supabase = createClient()

  useEffect(() => {
    fetchMatches()
    fetchUserPlan()
  }, [])

  const fetchUserPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('plan, trial_ends_at, subscription_status, role')
        .eq('id', user.id)
        .single()
      if (data) {
        const { plan } = getEffectivePlan(data)
        setUserPlan(plan)
      }
    }
  }

  const fetchMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      toast.error('Failed to fetch matches')
      return
    }

    setMatches(data || [])
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('matches')
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update')
      return
    }

    setMatches(matches.map(m => 
      m.id === id ? { ...m, is_read: true } : m
    ))
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('matches')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      toast.error('Failed to update')
      return
    }

    setMatches(matches.map(m => ({ ...m, is_read: true })))
    toast.success('All matches marked as read')
  }

  const filteredMatches = matches.filter(match => {
    const matchesSearch = searchQuery === '' || 
      match.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.keywords.keyword.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesSource = sourceFilter === 'all' || match.source === sourceFilter
    const matchesSentiment = sentimentFilter === 'all' || match.sentiment === sentimentFilter
    const matchesBookmark = !showBookmarked || match.is_bookmarked

    return matchesSearch && matchesSource && matchesSentiment && matchesBookmark
  })

  const bookmarkedCount = matches.filter(m => m.is_bookmarked).length

  const unreadCount = matches.filter(m => !m.is_read).length

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
          <h1 className="text-2xl font-bold text-white">Matches</h1>
          <p className="text-slate-400">
            View all keyword mentions found across the web.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showBookmarked ? 'default' : 'outline'}
            onClick={() => setShowBookmarked(!showBookmarked)}
            className={showBookmarked 
              ? 'bg-amber-600 hover:bg-amber-700 text-white' 
              : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }
          >
            <Star className={`mr-2 h-4 w-4 ${showBookmarked ? 'fill-current' : ''}`} />
            Bookmarked ({bookmarkedCount})
          </Button>
          <ExportButton 
            source={sourceFilter} 
            sentiment={sentimentFilter}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          />
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all as read ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search matches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px] border-slate-700 bg-slate-800 text-white">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white">All Sources</SelectItem>
                  {Object.entries(sourceLabels).map(([key, { label, emoji }]) => (
                    <SelectItem key={key} value={key} className="text-white">
                      {emoji} {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger className="w-[150px] border-slate-700 bg-slate-800 text-white">
                  <SelectValue placeholder="Sentiment" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-white">All Sentiment</SelectItem>
                  <SelectItem value="positive" className="text-white">Positive</SelectItem>
                  <SelectItem value="neutral" className="text-white">Neutral</SelectItem>
                  <SelectItem value="negative" className="text-white">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMatches.length > 0 ? (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 w-8"></TableHead>
                    <TableHead className="text-slate-400">Match</TableHead>
                    <TableHead className="text-slate-400">Source</TableHead>
                    <TableHead className="text-slate-400">Keyword</TableHead>
                    <TableHead className="text-slate-400">Sentiment</TableHead>
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400 w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches.map((match) => (
                    <TableRow 
                      key={match.id} 
                      className={`border-slate-800 hover:bg-slate-800/50 ${!match.is_read ? 'bg-slate-800/30' : ''}`}
                    >
                      <TableCell>
                        <button
                          onClick={() => markAsRead(match.id)}
                          className="text-slate-500 hover:text-emerald-400"
                        >
                          {match.is_read ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium text-white truncate">{match.title}</p>
                          <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                            {match.ai_summary || match.content}
                          </p>
                          {match.author && (
                            <p className="text-xs text-slate-500 mt-1">by {match.author}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{sourceLabels[match.source]?.emoji}</span>
                          <span className="text-slate-300">{sourceLabels[match.source]?.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {match.keywords.keyword}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {match.sentiment && (
                          <Badge variant="outline" className={sentimentColors[match.sentiment]}>
                            {match.sentiment}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {new Date(match.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <BookmarkButton
                            matchId={match.id}
                            initialBookmarked={match.is_bookmarked || false}
                          />
                          <MatchNotes
                            matchId={match.id}
                            initialNotes={match.notes}
                          />
                          <ReplyGenerator
                            matchId={match.id}
                            title={match.title}
                            content={match.content}
                            source={match.source}
                            url={match.url}
                            userPlan={userPlan}
                          />
                          <a
                            href={match.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white p-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-800 p-4 mb-4">
                <MessageSquare className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No matches yet</h3>
              <p className="text-sm text-slate-400 mb-4 max-w-sm">
                Once your keywords are scanned, matches will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
              <p className="text-sm text-slate-400">
                Try adjusting your search or filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
