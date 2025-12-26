'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload, Loader2, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface BulkImportProps {
  onImportComplete?: () => void
  keywordLimit: number
  currentCount: number
}

export function BulkImport({ onImportComplete, keywordLimit, currentCount }: BulkImportProps) {
  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ added: number; skipped: number; errors: string[] } | null>(null)
  const supabase = createClient()

  const parseKeywords = (text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0 && k.length <= 100)
      .filter((k, i, arr) => arr.indexOf(k) === i) // Remove duplicates
  }

  const handleImport = async () => {
    const keywordList = parseKeywords(keywords)
    
    if (keywordList.length === 0) {
      toast.error('No valid keywords found')
      return
    }

    const available = keywordLimit - currentCount
    if (keywordList.length > available) {
      toast.error(`You can only add ${available} more keywords. Upgrade your plan for more.`)
      return
    }

    setImporting(true)
    setResults(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let added = 0
    let skipped = 0
    const errors: string[] = []

    for (const keyword of keywordList) {
      const { error } = await supabase
        .from('keywords')
        .insert({
          user_id: user.id,
          keyword,
        })

      if (error) {
        if (error.code === '23505') {
          skipped++
        } else {
          errors.push(`${keyword}: ${error.message}`)
        }
      } else {
        added++
      }
    }

    setResults({ added, skipped, errors })
    setImporting(false)

    if (added > 0) {
      toast.success(`Added ${added} keyword${added > 1 ? 's' : ''}`)
      onImportComplete?.()
    }
  }

  const handleClose = () => {
    setOpen(false)
    setKeywords('')
    setResults(null)
  }

  const parsedCount = parseKeywords(keywords).length

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            Bulk Import Keywords
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Add multiple keywords at once. Paste one keyword per line, or separate with commas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={`Enter keywords, one per line:\n\nbest CRM software\nlooking for project management\nalternative to Notion\nrecommend a tool for...`}
            className="min-h-[200px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 resize-none font-mono text-sm"
          />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {parsedCount} keyword{parsedCount !== 1 ? 's' : ''} detected
            </span>
            <span className="text-slate-500">
              {currentCount + parsedCount} / {keywordLimit} after import
            </span>
          </div>

          {results && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-2">
              {results.added > 0 && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span>{results.added} keyword{results.added > 1 ? 's' : ''} added</span>
                </div>
              )}
              {results.skipped > 0 && (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{results.skipped} duplicate{results.skipped > 1 ? 's' : ''} skipped</span>
                </div>
              )}
              {results.errors.length > 0 && (
                <div className="text-red-400 text-sm">
                  <p className="font-medium">Errors:</p>
                  {results.errors.slice(0, 3).map((err, i) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-slate-400 hover:text-white"
          >
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results && (
            <Button
              onClick={handleImport}
              disabled={importing || parsedCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {parsedCount} Keyword{parsedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
