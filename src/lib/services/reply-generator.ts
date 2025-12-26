import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateReply(
  title: string,
  content: string,
  source: string,
  context?: string
): Promise<string> {
  try {
    const sourceGuidelines: Record<string, string> = {
      reddit: 'Be casual and conversational. Use Reddit-appropriate tone. Avoid being promotional.',
      hackernews: 'Be technical and insightful. HN users appreciate depth and nuance. Avoid fluff.',
      producthunt: 'Be supportive and constructive. Focus on the product angle.',
      google_news: 'Be professional and informative.',
      twitter: 'Be concise and engaging. Use a friendly tone.',
    }

    const prompt = `You are helping someone respond to a social media post/comment. Generate a helpful, authentic reply that:
- Is conversational and not salesy
- Provides genuine value or insight
- ${sourceGuidelines[source] || 'Is appropriate for the platform'}
- Is 2-4 sentences max
- Feels human and authentic

Original post title: ${title}
Original content: ${content.slice(0, 1000)}
${context ? `\nContext about the person replying (use subtly if relevant): ${context}` : ''}

Write ONLY the reply text, nothing else. No quotes, no "Here's a reply:", just the reply itself.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You write helpful, authentic social media replies. Be conversational, not corporate. Never be pushy or salesy. Sound like a real person who genuinely wants to help.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 250,
    })

    return response.choices[0]?.message?.content?.trim() || 'Unable to generate reply'
  } catch (error) {
    console.error('Reply generation error:', error)
    throw new Error('Failed to generate reply')
  }
}

export async function generateMultipleReplies(
  title: string,
  content: string,
  source: string,
  count: number = 3
): Promise<string[]> {
  const replies: string[] = []
  
  for (let i = 0; i < count; i++) {
    try {
      const reply = await generateReply(title, content, source)
      replies.push(reply)
    } catch {
      // Continue generating other replies even if one fails
    }
  }
  
  return replies
}
