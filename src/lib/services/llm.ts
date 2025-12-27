import OpenAI from 'openai'

// OpenRouter Client (For high-volume inference)
export const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': 'https://keywordsentinel.com',
        'X-Title': 'KeywordSentinel',
    },
})

// OpenAI Client (Reserved for Intelligent Agents & Reasoning)
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
})

export type LLMTask = 'discovery' | 'premium_analysis' | 'reply_generation'

const MODEL_BY_TASK: Record<LLMTask, string> = {
    discovery: 'openai/gpt-4o-mini',
    premium_analysis: 'anthropic/claude-3.5-sonnet',
    reply_generation: 'anthropic/claude-3.5-sonnet',
}

export function getModelForTask(task: LLMTask) {
    return MODEL_BY_TASK[task]
}

export interface DiscoveryResult {
    score: number
    intent: 'buying' | 'researching' | 'complaining' | 'casual' | 'irrelevant'
    pain_summary: string
    why_it_matters: string
}

/**
 * Discovery Scan (Ungated - uses cheap models)
 * Used in the main scanner loop for volume processing.
 */
export async function analyzeLeadDiscovery(
    title: string,
    content: string,
    keyword: string
): Promise<DiscoveryResult> {
    const model = getModelForTask('discovery')
    console.log(`[LLM] Discovery model: ${model}`)

    try {
        const response = await openrouter.chat.completions.create({
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a lead qualification engine. Your task is to score whether a social post represents a real buyer pain. Be conservative. False positives (scoring junk as high intent) are worse than false negatives.',
                },
                {
                    role: 'user',
                    content: `Analyze the following post for the keyword "${keyword}".
          
Return ONLY valid JSON.

Score from 0–100 based on:
- Explicit pain
- Urgency
- Buyer intent
- Authority of speaker

Classify intent as one of: ["buying", "researching", "complaining", "casual", "irrelevant"]

Post Title: ${title}
Post Content: ${content.slice(0, 1000)}

Output format:
{
  "score": number,
  "intent": string,
  "pain_summary": string,
  "why_it_matters": string
}`,
                },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
        })

        const text = response.choices[0]?.message?.content || '{}'
        return JSON.parse(text) as DiscoveryResult
    } catch (error) {
        console.error('[LLM] Discovery error:', error)
        return {
            score: 0,
            intent: 'irrelevant',
            pain_summary: 'Error during analysis',
            why_it_matters: 'N/A',
        }
    }
}

/**
 * Premium Re-analysis (Hard Gated - uses strong models)
 */
export async function analyzeLeadPremium(
    lead: any,
    userPlan: string
): Promise<string> {
    if (userPlan !== 'pro' && userPlan !== 'team') {
        throw new Error('Premium plan required for deep analysis')
    }

    const model = getModelForTask('premium_analysis')
    console.log(`[LLM] Premium analysis model: ${model}`)

    const response = await openrouter.chat.completions.create({
        model,
        messages: [
            {
                role: 'system',
                content: 'You are a senior sales intelligence analyst. Deeply analyze the provided lead to find hidden opportunities, budget signals, and technical fit.',
            },
            {
                role: 'user',
                content: `Deeply analyze this lead and explain:
- Why they care
- What they might buy
- Best approach angle / entry point

Lead Data:
${JSON.stringify(lead, null, 2)}`,
            },
        ],
        temperature: 0.3,
    })

    return response.choices[0]?.message?.content || 'No analysis generated.'
}

/**
 * Reply Generation (Hard Gated - uses strong models)
 */
export async function generateReply(
    lead: any,
    tone: 'professional' | 'casual' | 'helpful' | 'aggressive',
    userPlan: string
): Promise<string> {
    if (userPlan !== 'pro' && userPlan !== 'team') {
        throw new Error('Premium plan required for reply generation')
    }

    const model = getModelForTask('reply_generation')
    console.log(`[LLM] Reply generation model: ${model}`)

    const response = await openrouter.chat.completions.create({
        model,
        messages: [
            {
                role: 'system',
                content: 'You write concise, human-sounding sales replies. Never sound like marketing. Be helpful, specific, and direct.',
            },
            {
                role: 'user',
                content: `Write a ${tone} reply to this post. 
        
Lead Context:
Title: ${lead.title}
Content: ${lead.content}

Requirements:
- Don't mention you are an AI.
- Keep it under 2 paragraphs.
- Focus on the problem mentioned.`,
            },
        ],
        temperature: 0.5,
    })

    return response.choices[0]?.message?.content || 'Failed to generate reply.'
}
