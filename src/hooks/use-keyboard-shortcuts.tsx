'use client'

import { useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface ShortcutHandlers {
  onMarkAsRead?: () => void
  onBookmark?: () => void
  onOpenLink?: () => void
  onNextItem?: () => void
  onPrevItem?: () => void
}

export function useKeyboardShortcuts(handlers?: ShortcutHandlers) {
  const router = useRouter()
  const pathname = usePathname()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return
    }

    // Ignore if modifier keys are pressed (except for Cmd+K which is handled by command palette)
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return
    }

    switch (e.key.toLowerCase()) {
      case 'd':
        if (pathname !== '/dashboard') {
          e.preventDefault()
          router.push('/dashboard')
        }
        break

      case 'm':
        if (pathname !== '/dashboard/matches') {
          e.preventDefault()
          router.push('/dashboard/matches')
        }
        break

      case 'l':
        if (pathname !== '/dashboard/leads') {
          e.preventDefault()
          router.push('/dashboard/leads')
        }
        break

      case 'a':
        if (pathname !== '/dashboard/analytics') {
          e.preventDefault()
          router.push('/dashboard/analytics')
        }
        break

      // Item navigation
      case 'j':
        e.preventDefault()
        handlers?.onNextItem?.()
        break

      // Actions
      case 'r':
        e.preventDefault()
        handlers?.onMarkAsRead?.()
        break

      case 'b':
        e.preventDefault()
        handlers?.onBookmark?.()
        break

      case 'o':
        e.preventDefault()
        handlers?.onOpenLink?.()
        break
    }
  }, [router, pathname, handlers])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export function KeyboardShortcutsHelp() {
  return (
    <div className="text-sm text-slate-400 space-y-2">
      <div className="font-medium text-white mb-3">Keyboard Shortcuts</div>
      <div className="grid grid-cols-2 gap-2">
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">d</kbd> Dashboard</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">m</kbd> Matches</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">l</kbd> Leads</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">a</kbd> Analytics</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Cmd+K</kbd> Command</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">j</kbd> Next item</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">r</kbd> Mark read</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">b</kbd> Bookmark</div>
        <div><kbd className="px-2 py-1 bg-slate-800 rounded text-xs">o</kbd> Open link</div>
      </div>
    </div>
  )
}
