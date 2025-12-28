import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { PLANS, getPriceIdToPlan } from '@/lib/plans'
import { sendActivationEmail } from '@/lib/services/alerts'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getPlanFromPriceId(priceId: string) {
  const plan = getPriceIdToPlan(priceId)
  if (!plan) {
    return {
      id: 'free',
      name: 'Free',
      keywordsLimit: 3,
      scanInterval: 60,
    }
  }
  return {
    id: plan.id,
    name: plan.name,
    keywordsLimit: plan.keywords,
    scanInterval: plan.scanInterval,
  }
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  console.log(`[Stripe Webhook] Event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(
            session.subscription as string
          )

          const userId = session.metadata?.user_id
          if (!userId) {
            console.error('[Stripe Webhook] No user_id in session metadata')
            break
          }

          const priceId = subscription.items.data[0]?.price.id
          const planInfo = getPlanFromPriceId(priceId)

          console.log(`[Stripe Webhook] Checkout complete: user=${userId}, plan=${planInfo.id}`)

          // Get user email for activation email
          const { data: userData } = await getSupabaseAdmin()
            .from('users')
            .select('email')
            .eq('id', userId)
            .single()

          // INSTANT UPDATE: Update user subscription immediately
          const { error: updateError } = await getSupabaseAdmin()
            .from('users')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              plan: planInfo.id,
              keywords_limit: planInfo.keywordsLimit,
              scan_interval_minutes: planInfo.scanInterval,
              plan_updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

          if (updateError) {
            console.error('[Stripe Webhook] Failed to update user:', updateError)
          } else {
            console.log(`[Stripe Webhook] ✅ User ${userId} upgraded to ${planInfo.name} (${planInfo.keywordsLimit} keywords)`)
            
            // Send activation email: "Your monitoring is now live!"
            if (userData?.email) {
              await sendActivationEmail(
                userData.email,
                planInfo.name,
                planInfo.keywordsLimit
              )
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // Find user by subscription ID
        const { data: user } = await getSupabaseAdmin()
          .from('users')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (user) {
          const priceId = subscription.items.data[0]?.price.id
          const planInfo = getPlanFromPriceId(priceId)

          console.log(`[Stripe Webhook] Subscription updated: user=${user.id}, plan=${planInfo.id}, status=${subscription.status}`)

          await getSupabaseAdmin()
            .from('users')
            .update({
              subscription_status: subscription.status,
              plan: planInfo.id,
              keywords_limit: planInfo.keywordsLimit,
              scan_interval_minutes: planInfo.scanInterval,
            })
            .eq('id', user.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // Find user and downgrade to free
        const { data: user } = await getSupabaseAdmin()
          .from('users')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (user) {
          await getSupabaseAdmin()
            .from('users')
            .update({
              subscription_status: 'canceled',
              plan: 'free',
              stripe_subscription_id: null,
              keywords_limit: 3,
              scan_interval_minutes: 60,
            })
            .eq('id', user.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription

        if (subscriptionId) {
          const { data: user } = await getSupabaseAdmin()
            .from('users')
            .select('id, email')
            .eq('stripe_subscription_id', subscriptionId as string)
            .single()

          if (user) {
            await getSupabaseAdmin()
              .from('users')
              .update({ subscription_status: 'past_due' })
              .eq('id', user.id)

            // TODO: Send payment failed email
            console.log(`Payment failed for user ${user.email}`)
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
