import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface AIAnalysis {
  summary: string
  sentiment: 'positive' | 'negative' | 'neutral'
  leadScore: number
  suggestedAction: string
}

export async function analyzeMatch(
  title: string,
  content: string,
  keyword: string
): Promise<AIAnalysis> {
  try {
    const prompt = `Analyze this social media post/article that mentions the keyword "${keyword}".

Title: ${title}
Content: ${content.slice(0, 1000)}

Provide a JSON response with:
1. "summary": A 2-3 sentence summary explaining what this is about and why it matters for someone monitoring "${keyword}"
2. "sentiment": Either "positive", "negative", or "neutral" based on the overall tone
3. "leadScore": A number 0-100 indicating how valuable this is as a potential lead/opportunity (100 = high-intent buyer, 0 = irrelevant)
4. "suggestedAction": A brief actionable recommendation (e.g., "Reply with your solution", "Monitor for follow-up", "Low priority - just awareness")

Respond ONLY with valid JSON, no markdown or explanation.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that analyzes social media posts and articles for keyword monitoring. You provide concise, actionable insights. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const text = response.choices[0]?.message?.content || ''
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const analysis = JSON.parse(jsonMatch[0])

    return {
      summary: analysis.summary || 'No summary available',
      sentiment: validateSentiment(analysis.sentiment),
      leadScore: Math.min(100, Math.max(0, parseInt(analysis.leadScore) || 50)),
      suggestedAction: analysis.suggestedAction || 'Review manually',
    }
  } catch (error) {
    console.error('AI analysis error:', error)
    
    // Return default analysis on error
    return {
      summary: `Match found for "${keyword}" - review for relevance.`,
      sentiment: 'neutral',
      leadScore: 50,
      suggestedAction: 'Review manually',
    }
  }
}

function validateSentiment(sentiment: string): 'positive' | 'negative' | 'neutral' {
  const normalized = sentiment?.toLowerCase()
  if (normalized === 'positive') return 'positive'
  if (normalized === 'negative') return 'negative'
  return 'neutral'
}

export async function batchAnalyzeMatches(
  matches: Array<{ title: string; content: string; keyword: string }>
): Promise<AIAnalysis[]> {
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  const results: AIAnalysis[] = []

  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((match) => analyzeMatch(match.title, match.content, match.keyword))
    )
    results.push(...batchResults)
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < matches.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return results
}
