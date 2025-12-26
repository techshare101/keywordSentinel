import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  TrendingUp, 
  Bell, 
  Zap,
  ArrowUpRight,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { ScanButton } from '@/components/dashboard/scan-button'
import { DigestButton } from '@/components/dashboard/digest-button'

const sourceIcons: Record<string, string> = {
  reddit: '🔴',
  hackernews: '🟠',
  producthunt: '🟣',
  google_news: '📰',
  twitter: '🐦',
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  negative: 'bg-red-500/10 text-red-400 border-red-500/20',
  neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .single()

  const { count: keywordCount } = await supabase
    .from('keywords')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: matchCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: unreadCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .eq('is_read', false)

  const { data: recentMatches } = await supabase
    .from('matches')
    .select('*, keywords(keyword)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    {
      name: 'Active Keywords',
      value: keywordCount || 0,
      limit: profile?.keywords_limit || 3,
      icon: Search,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      name: 'Total Matches',
      value: matchCount || 0,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      name: 'Unread Alerts',
      value: unreadCount || 0,
      icon: Bell,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      name: 'Scan Interval',
      value: `${profile?.scan_interval_minutes || 60}m`,
      icon: Zap,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400">Monitor your keywords and track mentions across the web.</p>
        </div>
        <div className="flex items-center gap-3">
          <DigestButton 
            variant="outline" 
            className="border-slate-700 text-slate-300 hover:bg-slate-800" 
          />
          <ScanButton className="bg-emerald-600 hover:bg-emerald-700 text-white" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-slate-800 bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                {stat.name}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stat.value}
                {stat.limit && (
                  <span className="text-sm font-normal text-slate-500">
                    /{stat.limit}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Recent Matches</CardTitle>
              <CardDescription className="text-slate-400">
                Latest keyword mentions from across the web
              </CardDescription>
            </div>
            <Link href="/dashboard/matches">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                View all
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentMatches && recentMatches.length > 0 ? (
              <div className="space-y-4">
                {recentMatches.map((match: any) => (
                  <div
                    key={match.id}
                    className="flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-800/50 p-4"
                  >
                    <div className="text-2xl">
                      {sourceIcons[match.source] || '🌐'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                          {match.keywords?.keyword}
                        </Badge>
                        {match.sentiment && (
                          <Badge variant="outline" className={`text-xs ${sentimentColors[match.sentiment]}`}>
                            {match.sentiment}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-white truncate">{match.title}</h4>
                      <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                        {match.ai_summary || match.content}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>{match.source}</span>
                        <span>{new Date(match.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <a
                      href={match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-12 w-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No matches yet</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Add keywords to start monitoring the web
                </p>
                <Link href="/dashboard/keywords">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Keywords
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-400">
              Get started with KeywordSentinel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/keywords" className="block">
              <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-800/50 p-4 hover:bg-slate-800 transition-colors cursor-pointer">
                <div className="rounded-lg bg-blue-500/10 p-3">
                  <Search className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">Add Keywords</h4>
                  <p className="text-sm text-slate-400">
                    Set up keywords to monitor across the web
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/dashboard/settings" className="block">
              <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-800/50 p-4 hover:bg-slate-800 transition-colors cursor-pointer">
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <Bell className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">Configure Alerts</h4>
                  <p className="text-sm text-slate-400">
                    Set up email, Slack, or Discord notifications
                  </p>
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-4 rounded-lg border border-dashed border-slate-700 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 p-4">
              <div className="rounded-lg bg-emerald-500/10 p-3">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-white">Upgrade to Pro</h4>
                <p className="text-sm text-slate-400">
                  Get 50 keywords and 15-minute scans
                </p>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Upgrade
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
