import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getLeadStrategy } from '@/lib/services/agents/strategist'
import { getEffectivePlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch user plan for gating
        const { data: profile } = await supabase
            .from('users')
            .select('plan, role, trial_ends_at, subscription_status')
            .eq('id', user.id)
            .single()

        const effectivePlan = getEffectivePlan(profile || {})
        const userPlan = effectivePlan.plan

        const body = await request.json()
        const { lead } = body

        if (!lead) {
            return NextResponse.json({ error: 'Missing lead data' }, { status: 400 })
        }

        const strategy = await getLeadStrategy(lead, userPlan)

        return NextResponse.json({ strategy })
    } catch (error) {
        console.error('Lead strategy agent error:', error)
        const message = (error as Error).message
        return NextResponse.json(
            { error: message.includes('plan required') ? message : 'Agent failed to generate strategy' },
            { status: message.includes('plan required') ? 403 : 500 }
        )
    }
}
