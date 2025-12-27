import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { analyzeLeadPremium } from '@/lib/services/llm'

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
            .select('plan')
            .eq('id', user.id)
            .single()

        const userPlan = profile?.plan || 'free'

        const body = await request.json()
        const { lead } = body

        if (!lead) {
            return NextResponse.json({ error: 'Missing lead data' }, { status: 400 })
        }

        const analysis = await analyzeLeadPremium(lead, userPlan)

        return NextResponse.json({ analysis })
    } catch (error) {
        console.error('Lead re-analysis error:', error)
        const message = (error as Error).message
        return NextResponse.json(
            { error: message.includes('plan required') ? message : 'Failed to analyze lead' },
            { status: message.includes('plan required') ? 403 : 500 }
        )
    }
}
