import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
        .from('scan_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map to expected format
    const runs = (data || []).map(run => ({
        id: run.id,
        started_at: run.created_at,
        finished_at: run.finished_at,
        keywords_scanned: run.keywords_scanned || 0,
        matches_found: run.matches_found || 0,
        aborted: !run.finished_at,
        error: null,
        duration_ms: run.duration_ms
    }))

    return NextResponse.json({ runs })
}
