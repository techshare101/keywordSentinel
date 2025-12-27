'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface EnrichButtonProps {
  matchId: string
  url: string
  isEnriched?: boolean
  userPlan?: string
}

export function EnrichButton({ matchId, url, isEnriched, userPlan = 'free' }: EnrichButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    content?: string
    error?: string
  } | null>(null)

  const handleEnrich = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, url }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResult({ success: false, error: data.message || data.error })
        toast.error(data.message || 'Enrichment failed')
        return
      }

      setResult({ 
        success: true, 
        content: data.enrichedContent 
      })
      toast.success('Lead enriched successfully!')

    } catch (error) {
      setResult({ success: false, error: 'Network error' })
      toast.error('Failed to enrich lead')
    } finally {
      setIsLoading(false)
    }
  }

  // Only show for pro/team users
  if (userPlan === 'free') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-xs border-slate-700 text-slate-400 hover:bg-slate-800"
        onClick={() => toast.info('Upgrade to Pro to unlock deep enrichment')}
      >
        <Sparkles className="h-3 w-3 mr-1" />
        Enrich
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`text-xs ${
            isEnriched 
              ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' 
              : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {isEnriched ? 'Enriched' : 'Deep Enrich'}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Deep Lead Enrichment
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Use Firecrawl to extract deep context from this lead's source page.
            This uses your limited Firecrawl credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300 mb-1">URL to scrape:</p>
            <p className="truncate">{url}</p>
          </div>

          {!result && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                ⚠️ This will use 1 Firecrawl credit. You have limited credits per day.
              </p>
            </div>
          )}

          {result && (
            <div className={`rounded-lg p-4 ${
              result.success 
                ? 'bg-emerald-500/10 border border-emerald-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {result.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Enrichment Complete</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-6">
                    {result.content}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{result.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Close
            </Button>
            {!result?.success && (
              <Button
                onClick={handleEnrich}
                disabled={isLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Enrich Now
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
