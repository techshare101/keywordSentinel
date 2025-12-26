import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url, events, name } = body

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Missing required fields: url, events' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 })
    }

    // Store webhook in user settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('webhooks')
      .eq('user_id', user.id)
      .single()

    const existingWebhooks = settings?.webhooks || []
    const newWebhook = {
      id: crypto.randomUUID(),
      name: name || 'Webhook',
      url,
      events,
      created_at: new Date().toISOString(),
      active: true,
    }

    const { error } = await supabase
      .from('user_settings')
      .update({
        webhooks: [...existingWebhooks, newWebhook],
      })
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      webhook: newWebhook,
    })
  } catch (error) {
    console.error('Webhook creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('webhooks')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ 
      webhooks: settings?.webhooks || [],
    })
  } catch (error) {
    console.error('Webhook fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return NextResponse.json({ error: 'Missing webhook ID' }, { status: 400 })
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('webhooks')
      .eq('user_id', user.id)
      .single()

    const webhooks = (settings?.webhooks || []).filter(
      (w: any) => w.id !== webhookId
    )

    const { error } = await supabase
      .from('user_settings')
      .update({ webhooks })
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    )
  }
}
