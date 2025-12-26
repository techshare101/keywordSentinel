import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateReply } from '@/lib/services/reply-generator'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, source, context } = body

    if (!title || !content || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, source' },
        { status: 400 }
      )
    }

    const reply = await generateReply(title, content, source, context)

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Reply generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate reply' },
      { status: 500 }
    )
  }
}
