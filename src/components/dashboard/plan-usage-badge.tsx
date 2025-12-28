'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { getPlanById, PLANS, type PlanId } from '@/lib/plans'
import { Crown, Zap, Sparkles, ChevronRight } from 'lucide-react'

export function PlanUsageBadge() {
  const [plan, setPlan] = useState<PlanId>('free')
  const [keywordCount, setKeywordCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [profileRes, keywordsRes] = await Promise.all([
      supabase.from('users').select('plan').eq('id', user.id).single(),
      supabase.from('keywords').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    if (profileRes.data?.plan) {
      setPlan(profileRes.data.plan as PlanId)
    }
    if (keywordsRes.count !== null) {
      setKeywordCount(keywordsRes.count)
    }
    setLoading(false)
  }

  if (loading) return null

  const planData = getPlanById(plan)
  if (!planData) return null

  const keywordLimit = planData.keywords
  const usagePercent = Math.min((keywordCount / keywordLimit) * 100, 100)
  const isNearLimit = usagePercent >= 80
  const isAtLimit = keywordCount >= keywordLimit

  const getPlanIcon = () => {
    switch (plan) {
      case 'business': return <Crown className="h-3 w-3" />
      case 'pro': return <Zap className="h-3 w-3" />
      case 'starter': return <Sparkles className="h-3 w-3" />
      default: return null
    }
  }

  const getPlanColor = () => {
    switch (plan) {
      case 'business': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'pro': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'starter': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-8 px-2 gap-1.5 hover:bg-slate-800">
          <Badge className={`${getPlanColor()} text-xs font-medium`}>
            {getPlanIcon()}
            <span className="ml-1 capitalize">{plan}</span>
          </Badge>
          {isNearLimit && (
            <span className={`text-xs ${isAtLimit ? 'text-red-400' : 'text-amber-400'}`}>
              {keywordCount}/{keywordLimit}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-slate-900 border-slate-800 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white capitalize">{plan} Plan</h4>
            <span className="text-sm text-slate-400">${planData.price}/mo</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Keywords</span>
              <span className={isAtLimit ? 'text-red-400' : 'text-white'}>
                {keywordCount} / {keywordLimit}
              </span>
            </div>
            <Progress 
              value={usagePercent} 
              className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
            />
          </div>

          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Scans per day</span>
              <span className="text-slate-400">{planData.scansPerDay}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Competitor tracking</span>
              <span className={planData.competitorTracking ? 'text-emerald-400' : 'text-slate-600'}>
                {planData.competitorTracking ? '✓' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deep enrichments</span>
              <span className="text-slate-400">{planData.firecrawlCap}/mo</span>
            </div>
          </div>

          {plan !== 'business' && (
            <Button
              onClick={() => router.push('/pricing')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-9"
            >
              Upgrade Plan
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
