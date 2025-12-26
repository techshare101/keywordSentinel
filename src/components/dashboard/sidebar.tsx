'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Radar,
  LayoutDashboard,
  Search,
  Bell,
  Settings,
  LogOut,
  TrendingUp,
  Zap,
  Target,
  BarChart3,
  Flame,
  Activity,
  Crown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Keywords', href: '/dashboard/keywords', icon: Search },
  { name: 'Matches', href: '/dashboard/matches', icon: TrendingUp },
  { name: 'Leads', href: '/dashboard/leads', icon: Flame },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Competitors', href: '/dashboard/competitors', icon: Target },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userPlan, setUserPlan] = useState<string>('free')

  useEffect(() => {
    const fetchUserPlan = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('plan')
          .eq('id', user.id)
          .single()
        if (data?.plan) {
          setUserPlan(data.plan)
        }
      }
    }
    fetchUserPlan()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 border-r border-slate-800">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
          <Radar className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white">KeywordSentinel</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        {userPlan === 'free' ? (
          <div className="mb-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Get 50 keywords, 15-min scans, and AI summaries.
            </p>
            <Link href="/pricing">
              <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Upgrade Now
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mb-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-white capitalize">{userPlan} Plan</span>
              <Badge className="bg-emerald-500 text-white text-xs">Active</Badge>
            </div>
            <p className="text-xs text-slate-400">
              {userPlan === 'pro' ? '50 keywords, 15-min scans' : '200 keywords, 5-min scans'}
            </p>
          </div>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
