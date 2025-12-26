'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Search,
  TrendingUp,
  BarChart3,
  Target,
  Bell,
  Settings,
  Flame,
  Plus,
  FileText,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const supabase = createClient()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." className="border-none" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/keywords'))}>
            <Search className="mr-2 h-4 w-4" />
            Keywords
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/matches'))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Matches
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/leads'))}>
            <Flame className="mr-2 h-4 w-4" />
            Leads
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/analytics'))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/competitors'))}>
            <Target className="mr-2 h-4 w-4" />
            Competitors
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/alerts'))}>
            <Bell className="mr-2 h-4 w-4" />
            Alerts
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/keywords'))}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Keyword
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            fetch('/api/scan/user', { method: 'POST' })
          })}>
            <Search className="mr-2 h-4 w-4" />
            Scan Now
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            fetch('/api/digest', { method: 'POST' })
          })}>
            <FileText className="mr-2 h-4 w-4" />
            Send Weekly Digest
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            Light Mode
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            Dark Mode
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem onSelect={() => runCommand(handleSignOut)}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
