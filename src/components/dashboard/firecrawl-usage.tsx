'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Flame, Loader2 } from 'lucide-react'

interface UsageData {
  available: boolean
  usage?: {
    todayCalls: number
    hourCalls: number
    monthCalls: number
    remainingToday: number
    remainingHour: number
    remainingMonth: number
  }
  message?: string
}

const LIMITS = {
  daily: 10,
  hourly: 2,
  monthly: 100,
}

export function FirecrawlUsage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const response = await fetch('/api/enrich')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Failed to fetch Firecrawl usage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsage()
    // Refresh every 5 minutes
    const interval = setInterval(fetchUsage, 300000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  if (!data?.available) {
    return null // Don't show if Firecrawl is not configured
  }

  const usage = data.usage!

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          Firecrawl Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hourly Usage */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">This Hour</span>
            <span className="text-white font-medium">
              {usage.hourCalls}/{LIMITS.hourly}
            </span>
          </div>
          <Progress 
            value={(usage.hourCalls / LIMITS.hourly) * 100} 
            className="h-1.5 bg-slate-800"
          />
        </div>

        {/* Daily Usage */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Today</span>
            <span className="text-white font-medium">
              {usage.todayCalls}/{LIMITS.daily}
            </span>
          </div>
          <Progress 
            value={(usage.todayCalls / LIMITS.daily) * 100} 
            className="h-1.5 bg-slate-800"
          />
        </div>

        {/* Monthly Usage */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">This Month</span>
            <span className="text-white font-medium">
              {usage.monthCalls}/{LIMITS.monthly}
            </span>
          </div>
          <Progress 
            value={(usage.monthCalls / LIMITS.monthly) * 100} 
            className="h-1.5 bg-slate-800"
          />
        </div>

        <p className="text-[10px] text-slate-500 pt-1">
          Deep enrichment uses Firecrawl credits. Use wisely!
        </p>
      </CardContent>
    </Card>
  )
}
