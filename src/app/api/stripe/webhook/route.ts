import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          
          const userId = session.metadata?.user_id
          if (!userId) {
            console.error('No user_id in session metadata')
            break
          }

          // Determine plan based on price
          const priceId = subscription.items.data[0]?.price.id
          let plan = 'free'
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
            plan = 'pro'
          } else if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) {
            plan = 'agency'
          }

          // Update user subscription
          await supabaseAdmin
            .from('users')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              plan,
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Find user by subscription ID
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (user) {
          const priceId = subscription.items.data[0]?.price.id
          let plan = 'free'
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
            plan = 'pro'
          } else if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) {
            plan = 'agency'
          }

          await supabaseAdmin
            .from('users')
            .update({
              subscription_status: subscription.status,
              plan,
            })
            .eq('id', user.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Find user and downgrade to free
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (user) {
          await supabaseAdmin
            .from('users')
            .update({
              subscription_status: 'canceled',
              plan: 'free',
              stripe_subscription_id: null,
            })
            .eq('id', user.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription
        
        if (subscriptionId) {
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, email')
            .eq('stripe_subscription_id', subscriptionId as string)
            .single()

          if (user) {
            await supabaseAdmin
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
