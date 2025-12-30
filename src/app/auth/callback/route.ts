import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Set trial_ends_at for new users (7 days from now)
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 7)

      // Check if user already has trial_ends_at set
      const { data: existingUser } = await supabase
        .from('users')
        .select('trial_ends_at')
        .eq('id', data.user.id)
        .single()

      // Only set trial if not already set (new user)
      if (!existingUser?.trial_ends_at) {
        await supabase
          .from('users')
          .update({ 
            trial_ends_at: trialEndsAt.toISOString(),
            plan: 'trial'
          })
          .eq('id', data.user.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}
