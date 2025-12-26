'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Sparkles, Loader2, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Suggestion {
  keyword: string
  reason: string
}

interface KeywordSuggestionsProps {
  onKeywordAdded?: () => void
}

export function KeywordSuggestions({ onKeywordAdded }: KeywordSuggestionsProps) {
  const [open, setOpen] = useState(false)
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const generateSuggestions = async () => {
    setLoading(true)
    setSuggestions([])
    setAddedKeywords(new Set())

    try {
      const response = await fetch('/api/keywords/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: industry.trim() || undefined }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate suggestions')
      }

      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Suggestion error:', error)
      toast.error('Failed to generate suggestions')
    } finally {
      setLoading(false)
    }
  }

  const addKeyword = async (keyword: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('keywords')
      .insert({
        user_id: user.id,
        keyword: keyword.toLowerCase(),
      })

    if (error) {
      if (error.code === '23505') {
        toast.error('Keyword already exists')
      } else {
        toast.error('Failed to add keyword')
      }
      return
    }

    setAddedKeywords(new Set([...addedKeywords, keyword]))
    toast.success(`Added "${keyword}"`)
    onKeywordAdded?.()
  }

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && suggestions.length === 0) {
      generateSuggestions()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
          AI Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            AI Keyword Suggestions
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Get AI-powered keyword ideas based on your industry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter your industry (e.g., SaaS, E-commerce, Fintech)"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateSuggestions()}
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
              />
            </div>
            <Button
              onClick={generateSuggestions}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Generate'
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="ml-3 text-slate-400">Generating suggestions...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-800 bg-slate-800/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{suggestion.keyword}</p>
                  <p className="text-sm text-slate-400 mt-1">{suggestion.reason}</p>
                </div>
                <Button
                  size="sm"
                  variant={addedKeywords.has(suggestion.keyword) ? 'ghost' : 'outline'}
                  onClick={() => addKeyword(suggestion.keyword)}
                  disabled={addedKeywords.has(suggestion.keyword)}
                  className={addedKeywords.has(suggestion.keyword) 
                    ? 'text-emerald-400' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-700'
                  }
                >
                  {addedKeywords.has(suggestion.keyword) ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p>Enter your industry and click Generate to get keyword ideas</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-white"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
