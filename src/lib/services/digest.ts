import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface DigestData {
  totalMatches: number
  newMatches: number
  topOpportunities: Array<{
    title: string
    url: string
    keyword: string
    source: string
    sentiment: string | null
    leadScore: number | null
    aiSummary: string | null
  }>
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  sourceBreakdown: Record<string, number>
  keywordPerformance: Array<{
    keyword: string
    matchCount: number
  }>
  aiInsights: string
}

export async function generateDigestForUser(userId: string): Promise<DigestData | null> {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  // Get matches from the last week
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*, keywords(keyword)')
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString())
    .order('lead_score', { ascending: false, nullsFirst: false })

  if (error || !matches || matches.length === 0) {
    return null
  }

  // Calculate sentiment breakdown
  const sentimentBreakdown = {
    positive: matches.filter(m => m.sentiment === 'positive').length,
    neutral: matches.filter(m => m.sentiment === 'neutral').length,
    negative: matches.filter(m => m.sentiment === 'negative').length,
  }

  // Calculate source breakdown
  const sourceBreakdown: Record<string, number> = {}
  matches.forEach(m => {
    sourceBreakdown[m.source] = (sourceBreakdown[m.source] || 0) + 1
  })

  // Calculate keyword performance
  const keywordCounts: Record<string, number> = {}
  matches.forEach(m => {
    const kw = m.keywords?.keyword || 'unknown'
    keywordCounts[kw] = (keywordCounts[kw] || 0) + 1
  })
  const keywordPerformance = Object.entries(keywordCounts)
    .map(([keyword, matchCount]) => ({ keyword, matchCount }))
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 5)

  // Get top opportunities (highest lead scores)
  const topOpportunities = matches
    .filter(m => m.lead_score && m.lead_score >= 50)
    .slice(0, 5)
    .map(m => ({
      title: m.title,
      url: m.url,
      keyword: m.keywords?.keyword || 'unknown',
      source: m.source,
      sentiment: m.sentiment,
      leadScore: m.lead_score,
      aiSummary: m.ai_summary,
    }))

  // Generate AI insights
  const aiInsights = await generateAIInsights(matches, sentimentBreakdown, keywordPerformance)

  return {
    totalMatches: matches.length,
    newMatches: matches.filter(m => !m.is_read).length,
    topOpportunities,
    sentimentBreakdown,
    sourceBreakdown,
    keywordPerformance,
    aiInsights,
  }
}

async function generateAIInsights(
  matches: any[],
  sentiment: { positive: number; neutral: number; negative: number },
  keywords: Array<{ keyword: string; matchCount: number }>
): Promise<string> {
  try {
    const prompt = `Analyze this weekly keyword monitoring data and provide 2-3 actionable insights:

Total matches: ${matches.length}
Sentiment: ${sentiment.positive} positive, ${sentiment.neutral} neutral, ${sentiment.negative} negative
Top keywords: ${keywords.map(k => `${k.keyword} (${k.matchCount} mentions)`).join(', ')}

Sample match titles:
${matches.slice(0, 5).map(m => `- ${m.title}`).join('\n')}

Provide brief, actionable insights in 2-3 bullet points. Focus on opportunities and trends. Be concise.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a marketing analyst providing weekly insights on keyword monitoring data. Be concise and actionable.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 300,
    })

    return response.choices[0]?.message?.content || 'No insights available this week.'
  } catch (error) {
    console.error('AI insights error:', error)
    return 'Unable to generate insights this week.'
  }
}

export async function sendWeeklyDigest(
  email: string,
  userName: string,
  digest: DigestData
): Promise<boolean> {
  const sourceEmojis: Record<string, string> = {
    reddit: '🔴',
    hackernews: '🟠',
    producthunt: '🟣',
    google_news: '📰',
    twitter: '🐦',
  }

  const opportunitiesHtml = digest.topOpportunities.length > 0
    ? digest.topOpportunities.map(opp => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #334155;">
            <a href="${opp.url}" style="color: #60a5fa; text-decoration: none; font-weight: 500;">
              ${opp.title.slice(0, 60)}${opp.title.length > 60 ? '...' : ''}
            </a>
            <div style="margin-top: 4px; font-size: 12px; color: #94a3b8;">
              ${sourceEmojis[opp.source] || '🌐'} ${opp.source} • 
              <span style="color: #10b981;">Score: ${opp.leadScore}</span> •
              Keyword: ${opp.keyword}
            </div>
          </td>
        </tr>
      `).join('')
    : '<tr><td style="padding: 12px; color: #94a3b8;">No high-value opportunities this week</td></tr>'

  const keywordsHtml = digest.keywordPerformance.map(kp => `
    <div style="display: inline-block; margin: 4px; padding: 6px 12px; background: #1e293b; border-radius: 16px; font-size: 13px;">
      <span style="color: #10b981; font-weight: 500;">${kp.keyword}</span>
      <span style="color: #64748b;"> (${kp.matchCount})</span>
    </div>
  `).join('')

  const insightsHtml = digest.aiInsights
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<li style="margin-bottom: 8px; color: #e2e8f0;">${line.replace(/^[-•*]\s*/, '')}</li>`)
    .join('')

  try {
    const { error } = await resend.emails.send({
      from: 'KeywordSentinel <digest@keywordsentinel.ai>',
      to: email,
      subject: `📊 Your Weekly Keyword Report - ${digest.totalMatches} matches found`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto;">
            
            <!-- Header -->
            <div style="text-align: center; padding: 30px 0; border-bottom: 1px solid #334155;">
              <h1 style="color: #10b981; margin: 0; font-size: 24px;">🔍 KeywordSentinel</h1>
              <p style="color: #94a3b8; margin: 10px 0 0 0;">Weekly Digest</p>
            </div>

            <!-- Greeting -->
            <div style="padding: 30px 0;">
              <h2 style="color: #fff; margin: 0 0 10px 0;">Hi ${userName || 'there'}! 👋</h2>
              <p style="color: #94a3b8; margin: 0;">Here's your keyword monitoring summary for the past week.</p>
            </div>

            <!-- Stats Grid -->
            <div style="display: flex; gap: 15px; margin-bottom: 30px;">
              <div style="flex: 1; background: #1e293b; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #10b981;">${digest.totalMatches}</div>
                <div style="font-size: 13px; color: #94a3b8;">Total Matches</div>
              </div>
              <div style="flex: 1; background: #1e293b; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${digest.newMatches}</div>
                <div style="font-size: 13px; color: #94a3b8;">Unread</div>
              </div>
              <div style="flex: 1; background: #1e293b; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">${digest.topOpportunities.length}</div>
                <div style="font-size: 13px; color: #94a3b8;">Hot Leads</div>
              </div>
            </div>

            <!-- Sentiment Breakdown -->
            <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #fff; margin: 0 0 15px 0; font-size: 16px;">📊 Sentiment Breakdown</h3>
              <div style="display: flex; gap: 20px;">
                <div>
                  <span style="color: #10b981; font-size: 20px; font-weight: bold;">${digest.sentimentBreakdown.positive}</span>
                  <span style="color: #94a3b8; font-size: 13px;"> positive</span>
                </div>
                <div>
                  <span style="color: #64748b; font-size: 20px; font-weight: bold;">${digest.sentimentBreakdown.neutral}</span>
                  <span style="color: #94a3b8; font-size: 13px;"> neutral</span>
                </div>
                <div>
                  <span style="color: #ef4444; font-size: 20px; font-weight: bold;">${digest.sentimentBreakdown.negative}</span>
                  <span style="color: #94a3b8; font-size: 13px;"> negative</span>
                </div>
              </div>
            </div>

            <!-- Top Keywords -->
            <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #fff; margin: 0 0 15px 0; font-size: 16px;">🔑 Top Keywords</h3>
              <div>${keywordsHtml}</div>
            </div>

            <!-- AI Insights -->
            <div style="background: linear-gradient(135deg, #10b98120 0%, #0ea5e920 100%); border: 1px solid #10b98140; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #10b981; margin: 0 0 15px 0; font-size: 16px;">✨ AI Insights</h3>
              <ul style="margin: 0; padding-left: 20px;">
                ${insightsHtml}
              </ul>
            </div>

            <!-- Top Opportunities -->
            <div style="background: #1e293b; border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
              <div style="padding: 15px 20px; border-bottom: 1px solid #334155;">
                <h3 style="color: #fff; margin: 0; font-size: 16px;">🎯 Top Opportunities</h3>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                ${opportunitiesHtml}
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align: center; padding: 20px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
                 style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                View Full Dashboard →
              </a>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 30px 0; border-top: 1px solid #334155; margin-top: 20px;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                You're receiving this because you have weekly digests enabled.<br>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color: #60a5fa;">Manage preferences</a>
              </p>
            </div>

          </div>
        </body>
        </html>
      `,
    })

    if (error) {
      console.error('Digest email error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Send digest error:', error)
    return false
  }
}

export async function sendAllWeeklyDigests(): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  // Get all users with weekly digest enabled
  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('alert_frequency', 'daily') // Using 'daily' for weekly digest for now

  if (!settings || settings.length === 0) {
    return { sent: 0, failed: 0 }
  }

  for (const setting of settings) {
    try {
      // Get user info
      const { data: user } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', setting.user_id)
        .single()

      if (!user) continue

      // Generate digest
      const digest = await generateDigestForUser(setting.user_id)
      if (!digest || digest.totalMatches === 0) continue

      // Send email
      const success = await sendWeeklyDigest(user.email, user.full_name || '', digest)
      
      if (success) {
        sent++
      } else {
        failed++
      }
    } catch (error) {
      console.error('Digest error for user:', setting.user_id, error)
      failed++
    }
  }

  return { sent, failed }
}
