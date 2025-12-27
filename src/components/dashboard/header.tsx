'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationCenter } from '@/components/dashboard/notification-center'
import { MobileMenuButton } from '@/components/dashboard/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  user: {
    email: string
    full_name?: string | null
  }
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user.email[0].toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 lg:px-6">
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile Menu Button */}
        <MobileMenuButton />
        
        {/* Search - Hidden on mobile, visible on tablet+ */}
        <div className="relative max-w-md flex-1 hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search matches..."
            className="pl-10 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        
        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-500 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-slate-800 border-slate-700" align="end">
            <DropdownMenuLabel className="text-slate-300">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-white">{user.full_name || 'User'}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem 
              className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer"
              onSelect={() => router.push('/dashboard/settings')}
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer"
              onSelect={() => router.push('/dashboard/settings')}
            >
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer"
              onSelect={() => router.push('/dashboard/settings')}
            >
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
