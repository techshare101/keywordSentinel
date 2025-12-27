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
export { PLANS, type PlanId } from './plans'

// Helper to get price IDs (server-side only) - deprecated, use PLANS directly
export function getPriceId(plan: string): string | undefined {
  const { PLANS } = require('./plans')
  return PLANS[plan]?.priceId || undefined
}
