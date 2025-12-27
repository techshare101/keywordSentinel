import { openai } from '../llm'

export interface StrategicAdvice {
    summary: string
    suggested_angle: string
    entry_point: string
    danger_zones: string[]
}

/**
 * Lead Strategist Agent (OpenAI powered)
 * Provides high-level conversion strategy for Hot Leads.
 * Gated for Pro/Team.
 */
export async function getLeadStrategy(
    lead: any,
    userPlan: string
): Promise<StrategicAdvice> {
    if (userPlan !== 'pro' && userPlan !== 'team') {
        throw new Error('Agent services require a Pro or Team plan')
    }

    console.log('[Agent] Requesting strategy from OpenAI Lead Strategist...')

    const response = await openai.chat.completions.create({
        model: 'gpt-4o', // Use strong reasoning model for agents
        messages: [
            {
                role: 'system',
                content: `You are the Lead Strategist for KeywordSentinel. Your job is to help the user convert a specific lead.
You analyze the post context and provide a clear, tactical strategy.
Be concise, professional, and insight-driven.`,
            },
            {
                role: 'user',
                content: `Lead Data:
Title: ${lead.title}
Content: ${lead.content}
Source: ${lead.source}

Provide a tactical strategy in JSON format:
{
  "summary": "1-sentence summary of the user's core problem",
  "suggested_angle": "The specific value proposition to lead with",
  "entry_point": "The exact first sentence or question to ask",
  "danger_zones": ["List of things to avoid saying or doing"]
}`,
            },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content || '{}'
    return JSON.parse(text) as StrategicAdvice
}
