'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Clock, Zap, X } from 'lucide-react'

interface TrialInfo {
  isTrialing: boolean
  daysRemaining: number
  trialEndsAt: string | null
  plan: string
  subscriptionStatus: string
}

export function TrialCountdownBanner() {
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchTrialInfo()
  }, [])

  const fetchTrialInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('plan, subscription_status')
        .eq('id', user.id)
        .single()

      if (profileError) {
        // Silently fail - trial banner is not critical
        setLoading(false)
        return
      }

      if (!profile) {
        setLoading(false)
        return
      }

      // For now, disable trial banner until trial_ends_at column is added
      // This is a pre-launch simplification
      const isTrialing = false
      const daysRemaining = 0

      setTrialInfo({
        isTrialing,
        daysRemaining,
        trialEndsAt: null,
        plan: profile.plan || 'free',
        subscriptionStatus: profile.subscription_status || 'none'
      })
    } catch (error) {
      console.error('Error fetching trial info:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || dismissed || !trialInfo) return null

  // Don't show if not trialing or if paid
  if (!trialInfo.isTrialing) return null

  const urgencyColor = trialInfo.daysRemaining <= 2 
    ? 'from-red-500/20 to-orange-500/20 border-red-500/30' 
    : trialInfo.daysRemaining <= 4
    ? 'from-amber-500/20 to-yellow-500/20 border-amber-500/30'
    : 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/30'

  const textColor = trialInfo.daysRemaining <= 2 
    ? 'text-red-400' 
    : trialInfo.daysRemaining <= 4
    ? 'text-amber-400'
    : 'text-emerald-400'

  return (
    <div className={`relative rounded-lg border bg-gradient-to-r ${urgencyColor} p-4 mb-6`}>
      <button 
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-slate-500 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-800/50`}>
            <Clock className={`h-5 w-5 ${textColor}`} />
          </div>
          <div>
            <p className="font-medium text-white">
              {trialInfo.daysRemaining === 0 
                ? 'Your trial ends today!' 
                : trialInfo.daysRemaining === 1
                ? '1 day left in your trial'
                : `${trialInfo.daysRemaining} days left in your trial`
              }
            </p>
            <p className="text-sm text-slate-400">
              {trialInfo.daysRemaining <= 2 
                ? 'Subscribe now to keep your keywords active'
                : 'Upgrade to unlock 7+ keywords and full monitoring'
              }
            </p>
          </div>
        </div>
        
        <Button 
          onClick={() => router.push('/pricing')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
        >
          <Zap className="h-4 w-4 mr-2" />
          Upgrade Now
        </Button>
      </div>
    </div>
  )
}
