'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Search, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Keyword } from '@/types/database'
import { KeywordSuggestions } from '@/components/dashboard/keyword-suggestions'
import { BulkImport } from '@/components/dashboard/bulk-import'

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [adding, setAdding] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [keywordLimit, setKeywordLimit] = useState(3)
  const supabase = createClient()

  useEffect(() => {
    fetchKeywords()
    fetchUserLimit()
  }, [])

  const fetchUserLimit = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('keywords_limit')
        .eq('id', user.id)
        .single()
      if (data) {
        setKeywordLimit(data.keywords_limit)
      }
    }
  }

  const fetchKeywords = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to fetch keywords')
      return
    }

    setKeywords(data || [])
    setLoading(false)
  }

  const addKeyword = async () => {
    if (!newKeyword.trim()) {
      toast.error('Please enter a keyword')
      return
    }

    if (keywords.length >= keywordLimit) {
      toast.error(`You've reached your limit of ${keywordLimit} keywords. Upgrade to add more.`)
      return
    }

    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('keywords')
      .insert({
        user_id: user.id,
        keyword: newKeyword.trim().toLowerCase(),
      })
      .select()
      .single()

    if (error) {
      console.error('Add keyword error:', error)
      if (error.code === '23505') {
        toast.error('This keyword already exists')
      } else if (error.code === '23503') {
        toast.error('User profile not found. Please sign out and sign in again.')
      } else {
        toast.error(`Failed to add keyword: ${error.message}`)
      }
      setAdding(false)
      return
    }

    setKeywords([data, ...keywords])
    setNewKeyword('')
    setDialogOpen(false)
    setAdding(false)
    toast.success('Keyword added successfully')
  }

  const toggleKeyword = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('keywords')
      .update({ is_active: !isActive })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update keyword')
      return
    }

    setKeywords(keywords.map(k => 
      k.id === id ? { ...k, is_active: !isActive } : k
    ))
    toast.success(isActive ? 'Keyword paused' : 'Keyword activated')
  }

  const deleteKeyword = async (id: string) => {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete keyword')
      return
    }

    setKeywords(keywords.filter(k => k.id !== id))
    toast.success('Keyword deleted')
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
          <h1 className="text-2xl font-bold text-white">Keywords</h1>
          <p className="text-slate-400">
            Manage the keywords you want to monitor across the web.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkImport 
            onImportComplete={fetchKeywords}
            keywordLimit={keywordLimit}
            currentCount={keywords.length}
          />
          <KeywordSuggestions onKeywordAdded={fetchKeywords} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Add Keyword
              </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Add New Keyword</DialogTitle>
              <DialogDescription className="text-slate-400">
                Enter a keyword or phrase to monitor. We&apos;ll scan Reddit, Hacker News, Product Hunt, and more.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="keyword" className="text-slate-300">Keyword</Label>
                <Input
                  id="keyword"
                  placeholder="e.g., invoice reminder, AI tool, competitor name"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-1">Tips for better results:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use specific phrases for targeted results</li>
                  <li>Include competitor names to track mentions</li>
                  <li>Add pain points your product solves</li>
                </ul>
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
                onClick={addKeyword}
                disabled={adding}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Keyword'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Your Keywords</CardTitle>
              <CardDescription className="text-slate-400">
                {keywords.length} of {keywordLimit} keywords used
              </CardDescription>
            </div>
            <Badge 
              variant="outline" 
              className={`${
                keywords.length >= keywordLimit 
                  ? 'border-amber-500/50 text-amber-400' 
                  : 'border-emerald-500/50 text-emerald-400'
              }`}
            >
              {keywordLimit - keywords.length} remaining
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {keywords.length > 0 ? (
            <div className="space-y-3">
              {keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-lg p-2 ${keyword.is_active ? 'bg-emerald-500/10' : 'bg-slate-700'}`}>
                      <Search className={`h-4 w-4 ${keyword.is_active ? 'text-emerald-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-white">{keyword.keyword}</p>
                      <p className="text-xs text-slate-500">
                        Added {new Date(keyword.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        {keyword.is_active ? 'Active' : 'Paused'}
                      </span>
                      <Switch
                        checked={keyword.is_active}
                        onCheckedChange={() => toggleKeyword(keyword.id, keyword.is_active)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteKeyword(keyword.id)}
                      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-800 p-4 mb-4">
                <Search className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No keywords yet</h3>
              <p className="text-sm text-slate-400 mb-4 max-w-sm">
                Add your first keyword to start monitoring mentions across Reddit, Hacker News, and more.
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Keyword
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {keywords.length >= keywordLimit && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-white">Keyword limit reached</p>
              <p className="text-sm text-slate-400">
                Upgrade to Pro for 50 keywords and faster scan intervals.
              </p>
            </div>
            <Link href="/pricing">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Upgrade to Pro
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
