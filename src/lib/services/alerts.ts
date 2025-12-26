import { Resend } from 'resend'
import type { Match, UserSettings } from '@/types/database'

const resend = new Resend(process.env.RESEND_API_KEY)

interface MatchWithKeyword extends Match {
  keywords: { keyword: string }
}

export async function sendEmailAlert(
  email: string,
  matches: MatchWithKeyword[]
): Promise<boolean> {
  if (matches.length === 0) return true

  try {
    const matchList = matches
      .map(
        (m) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #334155;">
            <strong style="color: #10b981;">${m.keywords.keyword}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #334155;">
            <a href="${m.url}" style="color: #60a5fa; text-decoration: none;">${m.title}</a>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 14px;">${m.ai_summary || m.content.slice(0, 150)}...</p>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #334155;">
            <span style="background: ${getSentimentColor(m.sentiment)}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
              ${m.sentiment || 'neutral'}
            </span>
          </td>
        </tr>
      `
      )
      .join('')

    const { error } = await resend.emails.send({
      from: 'KeywordSentinel <alerts@keywordsentinel.ai>',
      to: email,
      subject: `🔔 ${matches.length} new keyword match${matches.length > 1 ? 'es' : ''} found`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #10b981; margin: 0;">🔍 KeywordSentinel</h1>
              <p style="color: #94a3b8;">New matches found for your keywords</p>
            </div>
            
            <div style="background: #1e293b; border-radius: 8px; overflow: hidden;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #334155;">
                    <th style="padding: 12px; text-align: left; color: #94a3b8;">Keyword</th>
                    <th style="padding: 12px; text-align: left; color: #94a3b8;">Match</th>
                    <th style="padding: 12px; text-align: left; color: #94a3b8;">Sentiment</th>
                  </tr>
                </thead>
                <tbody>
                  ${matchList}
                </tbody>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/matches" 
                 style="background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                View All Matches
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 30px;">
              You're receiving this because you have keyword alerts enabled.<br>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color: #60a5fa;">Manage your notification settings</a>
            </p>
          </div>
        </body>
        </html>
      `,
    })

    if (error) {
      console.error('Email send error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Email alert error:', error)
    return false
  }
}

export async function sendSlackAlert(
  webhookUrl: string,
  matches: MatchWithKeyword[]
): Promise<boolean> {
  if (matches.length === 0 || !webhookUrl) return true

  try {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🔔 ${matches.length} new keyword match${matches.length > 1 ? 'es' : ''} found`,
        },
      },
      { type: 'divider' },
      ...matches.slice(0, 10).flatMap((m) => [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Keyword:* \`${m.keywords.keyword}\`\n*${m.title}*\n${m.ai_summary || m.content.slice(0, 200)}...`,
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'View' },
            url: m.url,
          },
        },
        { type: 'divider' },
      ]),
    ]

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })

    return response.ok
  } catch (error) {
    console.error('Slack alert error:', error)
    return false
  }
}

export async function sendDiscordAlert(
  webhookUrl: string,
  matches: MatchWithKeyword[]
): Promise<boolean> {
  if (matches.length === 0 || !webhookUrl) return true

  try {
    const embeds = matches.slice(0, 10).map((m) => ({
      title: m.title.slice(0, 256),
      description: (m.ai_summary || m.content).slice(0, 500),
      url: m.url,
      color: getSentimentColorInt(m.sentiment),
      fields: [
        { name: 'Keyword', value: m.keywords.keyword, inline: true },
        { name: 'Source', value: m.source, inline: true },
        { name: 'Sentiment', value: m.sentiment || 'neutral', inline: true },
      ],
      timestamp: m.created_at,
    }))

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🔔 **${matches.length} new keyword match${matches.length > 1 ? 'es' : ''} found**`,
        embeds,
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Discord alert error:', error)
    return false
  }
}

function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case 'positive':
      return '#10b981'
    case 'negative':
      return '#ef4444'
    default:
      return '#64748b'
  }
}

function getSentimentColorInt(sentiment: string | null): number {
  switch (sentiment) {
    case 'positive':
      return 0x10b981
    case 'negative':
      return 0xef4444
    default:
      return 0x64748b
  }
}
