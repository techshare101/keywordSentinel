export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    keywords: 3,
    scanInterval: 60, // minutes
    features: [
      '3 keywords',
      'Delayed scans',
      'Email alerts',
      'Basic AI analysis',
      'Limited Lead insights',
      '❌ No Hot Leads',
    ],
  },
  pro: {
    name: 'Pro',
    price: 19,
    priceId: null as string | null, // Set at runtime from env
    keywords: 30,
    scanInterval: 15,
    features: [
      '30 keywords',
      '15-minute priority scans',
      'Unlock 🔥 Hot Leads',
      'Email, Slack & Discord alerts',
      'Full AI summaries & sentiment',
      'Weekly digest',
      'CSV export',
    ],
  },
  team: {
    name: 'Team',
    price: 49,
    priceId: null as string | null, // Set at runtime from env
    keywords: 200,
    scanInterval: 5,
    features: [
      '200 keywords',
      '5-minute instant scans',
      'All Pro features',
      'Priority team support',
      'API & Webhook access',
      'Advanced Lead filtering',
    ],
  },
} as const

export type PlanType = keyof typeof PLANS
