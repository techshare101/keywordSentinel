'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  TrendingUp, 
  Bell, 
  Search,
  Mail,
  MessageSquare,
  Star,
  ExternalLink,
  Clock,
} from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'match' | 'alert' | 'keyword' | 'scan'
  title: string
  description: string
  timestamp: string
  metadata?: Record<string, any>
}

const activityIcons: Record<string, React.ReactNode> = {
  match: <TrendingUp className="h-4 w-4 text-emerald-400" />,
  alert: <Bell className="h-4 w-4 text-amber-400" />,
  keyword: <Search className="h-4 w-4 text-blue-400" />,
  scan: <Clock className="h-4 w-4 text-purple-400" />,
}

const activityColors: Record<string, string> = {
  match: 'bg-emerald-500/10 border-emerald-500/20',
  alert: 'bg-amber-500/10 border-amber-500/20',
  keyword: 'bg-blue-500/10 border-blue-500/20',
  scan: 'bg-purple-500/10 border-purple-500/20',
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchActivity()
  }, [])

  const fetchActivity = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const activityList: ActivityItem[] = []

    // Get recent matches
    const { data: matches } = await supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    matches?.forEach((match: any) => {
      activityList.push({
        id: `match-${match.id}`,
        type: 'match',
        title: 'New match found',
        description: `"${match.keywords?.keyword}" mentioned in ${match.source}: ${match.title.slice(0, 50)}...`,
        timestamp: match.created_at,
        metadata: { url: match.url, source: match.source },
      })
    })

    // Get recent alerts
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*, matches(title)')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(10)

    alerts?.forEach((alert: any) => {
      activityList.push({
        id: `alert-${alert.id}`,
        type: 'alert',
        title: `Alert sent via ${alert.channel}`,
        description: alert.matches?.title?.slice(0, 60) || 'Alert notification',
        timestamp: alert.sent_at,
        metadata: { channel: alert.channel, status: alert.status },
      })
    })

    // Get recent keywords
    const { data: keywords } = await supabase
      .from('keywords')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    keywords?.forEach((keyword: any) => {
      activityList.push({
        id: `keyword-${keyword.id}`,
        type: 'keyword',
        title: 'Keyword added',
        description: `Started monitoring "${keyword.keyword}"`,
        timestamp: keyword.created_at,
      })
    })

    // Sort by timestamp
    activityList.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    setActivities(activityList.slice(0, 50))
    setLoading(false)
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Activity Feed</h1>
        <p className="text-slate-400">
          Real-time timeline of all your keyword monitoring activity.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="p-0">
          {activities.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 hover:bg-slate-800/50 transition-colors"
                >
                  <div className={`rounded-full p-2 ${activityColors[activity.type]} border`}>
                    {activityIcons[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white">{activity.title}</p>
                      <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {activity.description}
                    </p>
                    {activity.metadata?.url && (
                      <a
                        href={activity.metadata.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-2"
                      >
                        View original <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {formatTime(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-8 w-8 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No activity yet</h3>
              <p className="text-sm text-slate-400">
                Your activity timeline will appear here as you use KeywordSentinel.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
