'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLANS, getPlanById, getEffectivePlan, type PlanId } from '@/lib/plans'

interface PlanGateResult {
  userPlan: PlanId
  planData: typeof PLANS[PlanId] | null
  loading: boolean
  isAllowed: (feature: string) => boolean
  isWithinLimit: (feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers', current: number) => boolean
  enforce: (feature: string, current?: number) => { allowed: boolean; reason: string | null; upgradeUrl: string }
  getLimit: (feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers') => number
  refresh: () => Promise<void>
}

const FEATURE_NAMES: Record<string, string> = {
  competitorTracking: 'Competitor Tracking',
  teamNotifications: 'Team Notifications',
  slackAlerts: 'Slack & Discord Alerts',
  digestDaily: 'Daily Digest',
  digestWeekly: 'Weekly Digest',
  apiAccess: 'API Access',
  whiteLabel: 'White-label Reports',
  prioritySupport: 'Priority Support',
  keywords: 'Keywords',
  scansPerDay: 'Scans per Day',
  firecrawlCap: 'Deep Enrichments',
  teamMembers: 'Team Members',
}

const UPGRADE_SUGGESTIONS: Record<string, PlanId> = {
  competitorTracking: 'pro',
  teamNotifications: 'pro',
  slackAlerts: 'pro',
  digestDaily: 'starter',
  digestWeekly: 'pro',
  apiAccess: 'business',
  whiteLabel: 'business',
  prioritySupport: 'pro',
}

export function usePlanGate(): PlanGateResult {
  const [userPlan, setUserPlan] = useState<PlanId>('starter')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchUserPlan = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserPlan('starter')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('plan, role, trial_ends_at, subscription_status')
        .eq('id', user.id)
        .single()

      if (profile) {
        const effectivePlan = getEffectivePlan(profile)
        setUserPlan(effectivePlan.plan)
      } else {
        // Default to starter if no plan set (no free tier)
        setUserPlan('starter')
      }
    } catch (error) {
      console.error('Error fetching user plan:', error)
      setUserPlan('starter')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchUserPlan()
  }, [fetchUserPlan])

  const planData = getPlanById(userPlan)

  const isAllowed = useCallback((feature: string): boolean => {
    if (!planData) return false
    const value = planData[feature as keyof typeof planData]
    return typeof value === 'boolean' ? value : true
  }, [planData])

  const isWithinLimit = useCallback((
    feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers',
    current: number
  ): boolean => {
    if (!planData) return false
    return current < planData[feature]
  }, [planData])

  const getLimit = useCallback((
    feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers'
  ): number => {
    if (!planData) return 0
    return planData[feature]
  }, [planData])

  const enforce = useCallback((
    feature: string,
    current?: number
  ): { allowed: boolean; reason: string | null; upgradeUrl: string } => {
    if (!planData) {
      return { allowed: false, reason: 'Plan not loaded', upgradeUrl: '/pricing' }
    }

    const featureName = FEATURE_NAMES[feature] || feature
    const suggestedPlan = UPGRADE_SUGGESTIONS[feature] || 'pro'
    const upgradeUrl = `/pricing?highlight=${suggestedPlan}`

    // Check boolean features
    if (typeof planData[feature as keyof typeof planData] === 'boolean') {
      const allowed = planData[feature as keyof typeof planData] as boolean
      if (!allowed) {
        return {
          allowed: false,
          reason: `${featureName} requires ${PLANS[suggestedPlan].name} plan or higher`,
          upgradeUrl,
        }
      }
      return { allowed: true, reason: null, upgradeUrl }
    }

    // Check numeric limits
    if (current !== undefined && typeof planData[feature as keyof typeof planData] === 'number') {
      const limit = planData[feature as keyof typeof planData] as number
      if (current >= limit) {
        return {
          allowed: false,
          reason: `You've reached your ${featureName} limit (${limit}). Upgrade to get more.`,
          upgradeUrl,
        }
      }
      return { allowed: true, reason: null, upgradeUrl }
    }

    return { allowed: true, reason: null, upgradeUrl }
  }, [planData])

  return {
    userPlan,
    planData,
    loading,
    isAllowed,
    isWithinLimit,
    enforce,
    getLimit,
    refresh: fetchUserPlan,
  }
}

export function getPlanGateServer(userPlan: string) {
  const planData = getPlanById(userPlan)

  const isAllowed = (feature: string): boolean => {
    if (!planData) return false
    const value = planData[feature as keyof typeof planData]
    return typeof value === 'boolean' ? value : true
  }

  const isWithinLimit = (
    feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers',
    current: number
  ): boolean => {
    if (!planData) return false
    return current < planData[feature]
  }

  const getLimit = (
    feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers'
  ): number => {
    if (!planData) return 0
    return planData[feature]
  }

  return { planData, isAllowed, isWithinLimit, getLimit }
}
