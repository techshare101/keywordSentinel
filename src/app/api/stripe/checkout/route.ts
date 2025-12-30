import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { PLANS, type PlanId } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const VALID_PLANS: PlanId[] = ['starter', 'pro', 'business']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json()

    if (!plan || !VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be starter, pro, or business.' },
        { status: 400 }
      )
    }

    // Get price ID from plans config
    const planConfig = PLANS[plan as PlanId]
    const priceId = planConfig?.priceId
    
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured for this plan' },
        { status: 500 }
      )
    }

    // Get user's Stripe customer ID and role
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, email, role')
      .eq('id', user.id)
      .single()

    // Block admin/tester accounts from purchasing
    if (profile?.role === 'admin' || profile?.role === 'internal_tester') {
      return NextResponse.json(
        { error: 'Internal accounts cannot purchase plans. You already have full access.' },
        { status: 403 }
      )
    }

    let customerId = profile?.stripe_customer_id

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: profile?.email || user.email,
        metadata: {
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?plan=${plan}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
