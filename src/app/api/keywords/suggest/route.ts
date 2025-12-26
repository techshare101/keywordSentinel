import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { industry, existingKeywords } = body

    // Get user's existing keywords if not provided
    let keywords = existingKeywords
    if (!keywords) {
      const { data } = await supabase
        .from('keywords')
        .select('keyword')
        .eq('user_id', user.id)
      keywords = data?.map(k => k.keyword) || []
    }

    const prompt = `You are a keyword research expert. Based on the following context, suggest 10 highly relevant keywords for monitoring.

${industry ? `Industry/Niche: ${industry}` : ''}
${keywords.length > 0 ? `Existing keywords being tracked: ${keywords.join(', ')}` : 'No existing keywords yet.'}

Suggest keywords that would help find:
1. Potential customers asking questions or expressing pain points
2. Competitor mentions and comparisons
3. Industry trends and discussions
4. Buying intent signals

Return ONLY a JSON array of objects with "keyword" and "reason" fields. Example:
[{"keyword": "looking for CRM", "reason": "High buying intent signal"}, ...]

Focus on specific, actionable phrases that indicate real opportunities. Avoid generic single words.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a keyword research expert. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const text = response.choices[0]?.message?.content || '[]'
    
    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Invalid response format')
    }

    const suggestions = JSON.parse(jsonMatch[0])

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Keyword suggestion error:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
