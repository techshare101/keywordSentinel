'use client'

import { useState, useEffect } from 'react'
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
import { Bell, TrendingUp, ExternalLink, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'match' | 'alert'
  title: string
  description: string
  url?: string
  timestamp: string
  isRead: boolean
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: matches } = await supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    const notifs: Notification[] = (matches || []).map((match: any) => ({
      id: match.id,
      type: 'match',
      title: `New: ${match.keywords?.keyword}`,
      description: match.title.slice(0, 50) + '...',
      url: match.url,
      timestamp: match.created_at,
      isRead: match.is_read,
    }))

    setNotifications(notifs)
    setLoading(false)
  }

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
        
        {notifications.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className="flex items-start gap-3 p-3 cursor-pointer focus:bg-slate-700"
                onClick={() => {
                  markAsRead(notif.id)
                  if (notif.url) window.open(notif.url, '_blank')
                }}
              >
                <div className="rounded-full bg-emerald-500/10 p-2 mt-0.5">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                  <p className="text-xs text-slate-400 truncate">{notif.description}</p>
                </div>
                <span className="text-xs text-slate-500">{formatTime(notif.timestamp)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No new notifications</p>
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
