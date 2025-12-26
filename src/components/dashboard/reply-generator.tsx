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
} from '@/components/ui/dialog'
import { MessageSquare, Loader2, Copy, Check, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface ReplyGeneratorProps {
  matchId: string
  title: string
  content: string
  source: string
  url: string
}

export function ReplyGenerator({ matchId, title, content, source, url }: ReplyGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reply, setReply] = useState('')
  const [copied, setCopied] = useState(false)

  const generateReply = async () => {
    setGenerating(true)
    
    try {
      const response = await fetch('/api/reply/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, source }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reply')
      }

      setReply(data.reply)
    } catch (error) {
      console.error('Reply generation error:', error)
      toast.error('Failed to generate reply')
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(reply)
      setCopied(true)
      toast.success('Reply copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const openOriginal = () => {
    window.open(url, '_blank')
  }

  const handleOpen = () => {
    setOpen(true)
    if (!reply) {
      generateReply()
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
      >
        <Sparkles className="h-4 w-4 mr-1" />
        Reply
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              AI Suggested Reply
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Generated reply for: <span className="text-slate-300">{title.slice(0, 60)}...</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {generating ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <span className="ml-3 text-slate-400">Generating reply...</span>
              </div>
            ) : (
              <>
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Your reply will appear here..."
                  className="min-h-[150px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 resize-none"
                />
                <p className="text-xs text-slate-500">
                  Feel free to edit the reply before copying. Make it your own!
                </p>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={generateReply}
              disabled={generating}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={openOriginal}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Open Original
              </Button>
              <Button
                onClick={copyToClipboard}
                disabled={!reply || generating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Reply
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
