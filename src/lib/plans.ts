// PRODUCTION PRICING - NO FREE TIER
// Stripe Price IDs are LOCKED - DO NOT CHANGE
export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Trial',
    price: 0,
    priceId: null,
    description: '7-day free trial',
    keywords: 3,
    scansPerDay: 10,
    scanInterval: 60,
    competitorTracking: false,
    teamNotifications: false,
    slackAlerts: false,
    discordAlerts: false,
    digestDaily: true,
    digestWeekly: false,
    firecrawlCap: 5,
    firecrawlManualOnly: true,
    apiAccess: false,
    whiteLabel: false,
    teamMembers: 1,
    prioritySupport: false,
    advancedLeadScoring: false,
    aiReply: false,
    features: [
      '3 keywords',
      '10 scans per day',
      'Email alerts',
      'Daily digest',
      '🔥 Hot Lead detection',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 19,
    priceId: 'price_1SiY2cGRxp9eu0DJAJYpdXsJ',
    description: 'For solo founders getting started',
    keywords: 7,
    scansPerDay: 15,
    scanInterval: 30,
    competitorTracking: false,
    teamNotifications: false,
    slackAlerts: false,
    discordAlerts: false,
    digestDaily: true,
    digestWeekly: false,
    firecrawlCap: 10,
    firecrawlManualOnly: true,
    apiAccess: false,
    whiteLabel: false,
    teamMembers: 1,
    prioritySupport: false,
    advancedLeadScoring: false,
    aiReply: false,
    features: [
      '7 keywords',
      '15 scans per day',
      'Email alerts',
      'Daily digest',
      '🔥 Hot Lead detection',
      'Basic AI summaries',
      '10 enrichments/month',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 49,
    priceId: 'price_1SiY5EGRxp9eu0DJvWHdVl9N',
    description: 'For serious monitoring',
    keywords: 15,
    scansPerDay: 15,
    scanInterval: 15,
    competitorTracking: true,
    teamNotifications: true,
    slackAlerts: true,
    discordAlerts: true,
    digestDaily: true,
    digestWeekly: true,
    firecrawlCap: 50,
    firecrawlManualOnly: false,
    apiAccess: false,
    whiteLabel: false,
    teamMembers: 3,
    prioritySupport: true,
    advancedLeadScoring: true,
    aiReply: true,
    features: [
      '15 keywords',
      '15-minute scans',
      'Slack & Discord alerts',
      'Daily + Weekly digest',
      'Competitor tracking',
      'Advanced lead scoring',
      '50 enrichments/month',
      'Priority support',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 99,
    priceId: 'price_1Sj6eiGRxp9eu0DJbHRNt868',
    description: 'For teams and agencies',
    keywords: 25,
    scansPerDay: 48,
    scanInterval: 5,
    competitorTracking: true,
    teamNotifications: true,
    slackAlerts: true,
    discordAlerts: true,
    digestDaily: true,
    digestWeekly: true,
    firecrawlCap: 200,
    firecrawlManualOnly: false,
    apiAccess: true,
    whiteLabel: true,
    teamMembers: 10,
    prioritySupport: true,
    advancedLeadScoring: true,
    aiReply: true,
    features: [
      '25 keywords',
      '5-minute scans',
      'All alert channels',
      'Team access (10 seats)',
      'API & Webhooks',
      'White-label reports',
      '200 enrichments/month',
      'Dedicated support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0, // Custom pricing
    priceId: null, // No Stripe checkout - contact sales
    description: 'Custom solutions for large teams',
    keywords: 999,
    scansPerDay: 999,
    scanInterval: 1,
    competitorTracking: true,
    teamNotifications: true,
    slackAlerts: true,
    discordAlerts: true,
    digestDaily: true,
    digestWeekly: true,
    firecrawlCap: 999,
    firecrawlManualOnly: false,
    apiAccess: true,
    whiteLabel: true,
    teamMembers: 999,
    prioritySupport: true,
    advancedLeadScoring: true,
    aiReply: true,
    features: [
      'Unlimited keywords',
      'Real-time scanning',
      'Custom integrations',
      'Unlimited team seats',
      'SLA guarantee',
      'Dedicated account manager',
      'Custom onboarding',
      'SSO & SAML',
    ],
  },
} as const

export type PlanId = keyof typeof PLANS
export type Plan = typeof PLANS[PlanId]

export function getPlanById(id: string): Plan | null {
  return PLANS[id as PlanId] || null
}

export function getPriceIdToPlan(priceId: string): Plan | null {
  return Object.values(PLANS).find(p => p.priceId === priceId) || null
}

export function canAccessFeature(userPlan: string, feature: keyof Plan): boolean {
  const plan = getPlanById(userPlan)
  if (!plan) return false
  return !!plan[feature]
}

export function isWithinLimit(userPlan: string, feature: 'keywords' | 'scansPerDay' | 'firecrawlCap' | 'teamMembers', current: number): boolean {
  const plan = getPlanById(userPlan)
  if (!plan) return false
  return current < plan[feature]
}

// Get effective plan considering trial status
export function getEffectivePlan(user: {
  plan?: string | null
  trial_ends_at?: string | null
  subscription_status?: string | null
}): { plan: PlanId; daysLeft: number | null; isTrialing: boolean } {
  const now = new Date()

  // Check if user is in active trial
  if (user.trial_ends_at) {
    const ends = new Date(user.trial_ends_at)
    if (ends > now && user.subscription_status !== 'active') {
      const daysLeft = Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        plan: 'trial',
        daysLeft,
        isTrialing: true,
      }
    }
  }

  // Not trialing - use actual plan
  const plan = (user.plan as PlanId) || 'starter'
  return {
    plan: PLANS[plan] ? plan : 'starter',
    daysLeft: null,
    isTrialing: false,
  }
}
