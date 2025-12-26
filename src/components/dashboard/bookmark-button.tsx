'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface BookmarkButtonProps {
  matchId: string
  initialBookmarked: boolean
  onBookmarkChange?: (bookmarked: boolean) => void
}

export function BookmarkButton({ matchId, initialBookmarked, onBookmarkChange }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const toggleBookmark = async () => {
    setLoading(true)
    const newValue = !bookmarked
    
    try {
      const { error } = await supabase
        .from('matches')
        .update({ is_bookmarked: newValue })
        .eq('id', matchId)

      if (error) throw error

      setBookmarked(newValue)
      onBookmarkChange?.(newValue)
      toast.success(newValue ? 'Bookmarked!' : 'Bookmark removed')
    } catch (error) {
      console.error('Bookmark error:', error)
      toast.error('Failed to update bookmark')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleBookmark}
      disabled={loading}
      className={`${bookmarked ? 'text-amber-400' : 'text-slate-400'} hover:text-amber-400 hover:bg-amber-500/10`}
    >
      <Star className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
    </Button>
  )
}
