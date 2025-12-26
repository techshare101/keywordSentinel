import Stripe from 'stripe'

// Lazy initialization to avoid client-side errors
let stripeInstance: Stripe | null = null

export function getStripe() {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }
  return stripeInstance
}

// Re-export PLANS from separate file for client-side usage
export { PLANS, type PlanType } from './plans'

// Helper to get price IDs (server-side only)
export function getPriceId(plan: 'pro' | 'team'): string | undefined {
  if (plan === 'pro') return process.env.STRIPE_PRO_PRICE_ID
  if (plan === 'team') return process.env.STRIPE_TEAM_PRICE_ID
  return undefined
}
