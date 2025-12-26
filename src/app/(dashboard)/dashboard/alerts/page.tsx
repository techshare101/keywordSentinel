'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Bell, 
  Mail, 
  MessageSquare as Slack,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Alert } from '@/types/database'

interface AlertWithMatch extends Alert {
  matches: {
    title: string
    source: string
    keywords: { keyword: string }
  }
}

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  slack: <Slack className="h-4 w-4" />,
  discord: <Bell className="h-4 w-4" />,
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  sent: { 
    icon: <CheckCircle className="h-4 w-4" />, 
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
  },
  pending: { 
    icon: <Clock className="h-4 w-4" />, 
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
  },
  failed: { 
    icon: <XCircle className="h-4 w-4" />, 
    color: 'bg-red-500/10 text-red-400 border-red-500/20' 
  },
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertWithMatch[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('alerts')
      .select('*, matches(title, source, keywords(keyword))')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(50)

    if (error) {
      toast.error('Failed to fetch alerts')
      return
    }

    setAlerts(data || [])
    setLoading(false)
  }

  const sentCount = alerts.filter(a => a.status === 'sent').length
  const pendingCount = alerts.filter(a => a.status === 'pending').length
  const failedCount = alerts.filter(a => a.status === 'failed').length

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
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <p className="text-slate-400">
          View your notification history and delivery status.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Sent</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{sentCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Alert History</CardTitle>
          <CardDescription className="text-slate-400">
            Recent notifications sent for your keyword matches
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Match</TableHead>
                    <TableHead className="text-slate-400">Channel</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white truncate max-w-xs">
                            {alert.matches?.title || 'Unknown match'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                              {alert.matches?.keywords?.keyword}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {alert.matches?.source}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-300">
                          {channelIcons[alert.channel]}
                          <span className="capitalize">{alert.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${statusConfig[alert.status].color} flex items-center gap-1 w-fit`}
                        >
                          {statusConfig[alert.status].icon}
                          <span className="capitalize">{alert.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {new Date(alert.sent_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-800 p-4 mb-4">
                <Bell className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No alerts yet</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                When we find matches for your keywords, alerts will be sent and logged here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
