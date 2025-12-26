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
import { StickyNote, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface MatchNotesProps {
  matchId: string
  initialNotes: string | null
  onNotesUpdated?: (notes: string) => void
}

export function MatchNotes({ matchId, initialNotes, onNotesUpdated }: MatchNotesProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const saveNotes = async () => {
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('matches')
        .update({ notes })
        .eq('id', matchId)

      if (error) throw error

      toast.success('Notes saved')
      onNotesUpdated?.(notes)
      setOpen(false)
    } catch (error) {
      console.error('Save notes error:', error)
      toast.error('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 ${initialNotes ? 'text-amber-400' : ''}`}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-400" />
            Match Notes
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Add private notes about this match for follow-up
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this match... (e.g., 'Contacted via DM', 'Hot lead - follow up tomorrow')"
            className="min-h-[150px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 resize-none"
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={saveNotes}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Notes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
