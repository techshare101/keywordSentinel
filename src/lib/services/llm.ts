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
 * 
 * SCORING CRITERIA (0-100):
 * - 80-100: HOT LEAD - Explicit buying intent, budget mentioned, urgent timeline
 * - 60-79: WARM LEAD - Clear pain point, actively researching solutions
 * - 40-59: INTERESTED - Relevant discussion, potential future buyer
 * - 20-39: COLD - Casual mention, no clear intent
 * - 0-19: IRRELEVANT - Off-topic, spam, or no business value
 */
export async function analyzeLeadDiscovery(
    title: string,
    content: string,
    keyword: string,
    advancedScoring: boolean = false
): Promise<DiscoveryResult> {
    const model = getModelForTask('discovery')
    console.log(`[LLM] Discovery model: ${model}, advanced: ${advancedScoring}`)

    const systemPrompt = advancedScoring 
        ? `You are an expert B2B lead qualification engine with deep understanding of buyer psychology and sales signals.

Your task is to score social media posts for REAL buyer intent. You must be accurate - false positives waste sales time, false negatives lose deals.

SCORING FRAMEWORK (0-100):
- 90-100: IMMEDIATE BUYER - "Looking to buy", "need recommendations", mentions budget/timeline
- 75-89: HIGH INTENT - Explicit pain point, comparing solutions, asking for alternatives
- 60-74: ACTIVE RESEARCH - Evaluating options, asking detailed questions about features
- 45-59: PROBLEM AWARE - Discussing challenges, may not know solutions exist
- 30-44: CURIOUS - General interest, early stage awareness
- 15-29: CASUAL - Tangential mention, no clear business need
- 0-14: IRRELEVANT - Off-topic, spam, or clearly not a prospect

INTENT SIGNALS TO LOOK FOR:
✓ "Looking for", "need help with", "recommendations for"
✓ Frustration with current solution
✓ Budget or timeline mentions
✓ Decision-maker language ("my team", "our company")
✓ Comparison questions ("X vs Y")
✓ Pain point descriptions with urgency

RED FLAGS (lower score):
✗ Just sharing news/articles
✗ Academic/theoretical discussion
✗ Already solved their problem
✗ Clearly not the target market`
        : `You are a lead qualification engine. Score whether a social post represents real buyer pain. Be conservative - false positives are worse than false negatives.

SCORING (0-100):
- 70+: Clear buying intent or urgent pain
- 50-69: Active research or problem discussion
- 30-49: Casual interest
- 0-29: Irrelevant or no intent`

    try {
        const response = await openrouter.chat.completions.create({
            model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: `Analyze this post for the keyword "${keyword}".

Post Title: ${title}
Post Content: ${content.slice(0, 1500)}

Return ONLY valid JSON:
{
  "score": <number 0-100>,
  "intent": <"buying" | "researching" | "complaining" | "casual" | "irrelevant">,
  "pain_summary": <1-2 sentence summary of the pain/need>,
  "why_it_matters": <why this is/isn't a good lead>
}`,
                },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
        })

        const text = response.choices[0]?.message?.content || '{}'
        const result = JSON.parse(text) as DiscoveryResult
        
        // Ensure score is within bounds
        result.score = Math.max(0, Math.min(100, result.score))
        
        return result
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
    if (!['pro', 'business', 'enterprise'].includes(userPlan)) {
        throw new Error('Pro plan or higher required for deep analysis')
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
    if (!['pro', 'business', 'enterprise'].includes(userPlan)) {
        throw new Error('Pro plan or higher required for reply generation')
    }

    const model = getModelForTask('reply_generation')
    console.log(`[LLM] Reply generation model: ${model}`)

    try {
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
    } catch (error) {
        console.error('[LLM] Reply generation error:', error)
        throw new Error(`LLM API error: ${(error as Error).message}`)
    }
}
