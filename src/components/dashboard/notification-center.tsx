'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, TrendingUp, Flame, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: 'match' | 'lead' | 'alert'
  title: string
  description: string
  url?: string
  timestamp: string
  isRead: boolean
  leadScore?: number
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: matches } = await supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(15)

    const notifs: Notification[] = (matches || []).map((match: any) => ({
      id: match.id,
      type: match.lead_score >= 70 ? 'lead' : 'match',
      title: match.lead_score >= 70 
        ? `🔥 Hot Lead: ${match.keywords?.keyword}`
        : `New: ${match.keywords?.keyword}`,
      description: match.title?.slice(0, 60) + (match.title?.length > 60 ? '...' : ''),
      url: match.url,
      timestamp: match.created_at,
      isRead: match.is_read,
      leadScore: match.lead_score,
    }))

    setNotifications(notifs)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchNotifications()
    
    // Refresh notifications every 2 minutes
    const interval = setInterval(fetchNotifications, 120000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    await supabase
      .from('matches')
      .update({ is_read: true })
      .eq('id', id)

    setNotifications(notifications.filter(n => n.id !== id))
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('matches')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setNotifications([])
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    return date.toLocaleDateString()
  }

  const unreadCount = notifications.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-emerald-500 text-[10px]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-slate-800 border-slate-700" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-white">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-slate-400 hover:text-white h-auto p-1"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 text-slate-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        ) : notifications.length > 0 ? (
          <div className="max-h-[350px] overflow-y-auto">
            {notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer focus:bg-slate-700",
                  notif.type === 'lead' && "bg-orange-500/5"
                )}
                onClick={() => {
                  markAsRead(notif.id)
                  if (notif.url) window.open(notif.url, '_blank')
                }}
              >
                <div className={cn(
                  "rounded-full p-2 mt-0.5",
                  notif.type === 'lead' 
                    ? "bg-orange-500/10" 
                    : "bg-emerald-500/10"
                )}>
                  {notif.type === 'lead' ? (
                    <Flame className="h-3 w-3 text-orange-400" />
                  ) : (
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                  <p className="text-xs text-slate-400 truncate">{notif.description}</p>
                  {notif.leadScore && notif.leadScore >= 70 && (
                    <span className="text-[10px] text-orange-400 font-medium">
                      Score: {notif.leadScore}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">{formatTime(notif.timestamp)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No new notifications</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
          </div>
        )}

        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem
          className="text-center text-sm text-emerald-400 hover:text-emerald-300 cursor-pointer justify-center"
          onClick={() => router.push('/dashboard/activity')}
        >
          View all activity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
