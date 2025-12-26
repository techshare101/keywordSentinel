import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const source = searchParams.get('source')
    const sentiment = searchParams.get('sentiment')

    // Build query
    let query = supabase
      .from('matches')
      .select('*, keywords(keyword)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (source && source !== 'all') {
      query = query.eq('source', source)
    }

    if (sentiment && sentiment !== 'all') {
      query = query.eq('sentiment', sentiment)
    }

    const { data: matches, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ error: 'No matches to export' }, { status: 404 })
    }

    // Generate CSV
    const headers = [
      'Date',
      'Keyword',
      'Title',
      'Source',
      'Sentiment',
      'Lead Score',
      'Author',
      'URL',
      'AI Summary',
      'Content',
    ]

    const rows = matches.map((match: any) => [
      new Date(match.created_at).toISOString().split('T')[0],
      match.keywords?.keyword || '',
      escapeCsvField(match.title),
      match.source,
      match.sentiment || 'unknown',
      match.lead_score || '',
      match.author || '',
      match.url,
      escapeCsvField(match.ai_summary || ''),
      escapeCsvField(match.content?.slice(0, 500) || ''),
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="keywordsentinel-matches-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export matches' },
      { status: 500 }
    )
  }
}

function escapeCsvField(field: string): string {
  if (!field) return ''
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  const escaped = field.replace(/"/g, '""')
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped}"`
  }
  return escaped
}
