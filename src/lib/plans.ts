export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    keywords: 3,
    scansPerDay: 2,
    scanInterval: 60,
    competitorTracking: false,
    teamNotifications: false,
    slackAlerts: false,
    digestDaily: false,
    digestWeekly: false,
    firecrawlCap: 0,
    apiAccess: false,
    whiteLabel: false,
    teamMembers: 1,
    prioritySupport: false,
    features: [
      '3 keywords',
      '2 scans per day',
      'Email alerts',
      'Basic AI analysis',
      '❌ No Hot Leads',
      '❌ No competitor tracking',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 19,
    priceId: 'price_1SiY2cGRxp9eu0DJAJYpdXsJ',
    keywords: 7,
    scansPerDay: 15,
    scanInterval: 30,
    competitorTracking: false,
    teamNotifications: false,
    slackAlerts: false,
    digestDaily: true,
    digestWeekly: false,
    firecrawlCap: 10,
    apiAccess: false,
    whiteLabel: false,
    teamMembers: 1,
    prioritySupport: false,
    features: [
      '7 keywords',
      '15 scans per day',
      'Daily email digest',
      '🔥 Hot Lead detection',
      '10 deep enrichments/month',
      'CSV export',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 49,
    priceId: 'price_1SiY5EGRxp9eu0DJvWHdVl9N',
    keywords: 15,
    scansPerDay: 15,
    scanInterval: 15,
    competitorTracking: true,
    teamNotifications: true,
    slackAlerts: true,
    digestDaily: true,
    digestWeekly: true,
    firecrawlCap: 50,
    apiAccess: false,
    whiteLabel: false,
    teamMembers: 3,
    prioritySupport: true,
    features: [
      '15 keywords',
      '15-minute priority scans',
      '🔥 Hot Lead detection',
      'Competitor tracking',
      'Slack & Discord alerts',
      'Daily + Weekly digest',
      '50 deep enrichments/month',
      '3 team members',
      'Priority support',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 99,
    priceId: 'price_1Sj6eiGRxp9eu0DJbHRNt868',
    keywords: 25,
    scansPerDay: 48,
    scanInterval: 5,
    competitorTracking: true,
    teamNotifications: true,
    slackAlerts: true,
    digestDaily: true,
    digestWeekly: true,
    firecrawlCap: 200,
    apiAccess: true,
    whiteLabel: true,
    teamMembers: 10,
    prioritySupport: true,
    features: [
      '25 keywords',
      '5-minute instant scans',
      'All Pro features',
      'API & Webhook access',
      'White-label reports',
      '200 deep enrichments/month',
      '10 team members',
      'Dedicated support',
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
