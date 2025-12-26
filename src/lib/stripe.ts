import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
})

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    keywords: 3,
    scanInterval: 60, // minutes
    features: [
      '3 keywords',
      'Hourly scans',
      'Email alerts',
      'AI summaries',
    ],
  },
  pro: {
    name: 'Pro',
    price: 19,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    keywords: 50,
    scanInterval: 15,
    features: [
      '50 keywords',
      '15-minute scans',
      'Email, Slack & Discord alerts',
      'AI summaries & lead scoring',
      'Weekly digest',
      'CSV export',
    ],
  },
  team: {
    name: 'Team',
    price: 49,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    keywords: 200,
    scanInterval: 5,
    features: [
      '200 keywords',
      '5-minute scans',
      'All Pro features',
      'Priority support',
      'API access',
      'Webhooks',
    ],
  },
} as const

export type PlanType = keyof typeof PLANS
