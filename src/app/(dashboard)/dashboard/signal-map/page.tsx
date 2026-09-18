'use client'

import { useState, useEffect } from 'react'
import { Radar, Sparkles, Globe, MessageCircle, Bot, Loader2, Zap, Headphones, Youtube, ExternalLink } from 'lucide-react'

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface SignalSection {
  section_type: string
  status: string
  data: any
  sources: any[]
  error_message?: string
}

interface SignalReport {
  id: string
  icp_description: string
  seed_domains: string[]
  status: string
  sections: SignalSection[]
  created_at: string
}

export default function SignalMapPage() {
  const [icpDescription, setIcpDescription] = useState('')
  const [seedDomains, setSeedDomains] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SignalReport | null>(null)

  const generateReport = async () => {
    if (!icpDescription.trim()) {
      toast.error('Please describe your ICP')
      return
    }

    setLoading(true)
    try {
      const domains = seedDomains
        .split('\n')
        .map(d => d.trim())
        .filter(Boolean)

      const res = await fetch('/api/signal-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icp_description: icpDescription,
          seed_domains: domains,
          location: location || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('[Signal Map] API error:', { status: res.status, data })
        throw new Error(data.error || `API returned ${res.status}`)
      }

      console.log('[Signal Map] Report generated:', data.report)
      setReport(data.report)
      toast.success('Signal Map generated successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  // Poll for report updates while status is running
  useEffect(() => {
    if (!report || report.status !== 'running') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/signal-map?id=${report.id}`)
        if (!res.ok) return

        const data = await res.json()
        if (data.report && data.report.status !== report.status) {
          console.log('[Signal Map] Report updated:', data.report.status)
          setReport(data.report)
        }
      } catch (error) {
        console.error('[Signal Map] Polling error:', error)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [report])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Radar className="h-6 w-6 text-white" />
          </div>
          ICP Signal Map
        </h1>
        <p className="text-slate-400 mt-2">
          Discover where your ideal customers discuss, ask questions, and what AI says about your category.
        </p>
      </div>

      {/* Input Form */}
      <Card className="p-6 bg-slate-900/50 border-slate-800">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Describe your Ideal Customer Profile (ICP)
            </label>
            <Textarea
              placeholder="e.g., US med spa owners and aesthetic injectors, or SaaS founders building AI products"
              value={icpDescription}
              onChange={(e) => setIcpDescription(e.target.value)}
              className="min-h-[100px] bg-slate-950 border-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Seed Domains (optional, one per line)
            </label>
            <Textarea
              placeholder="example.com&#10;another.com"
              value={seedDomains}
              onChange={(e) => setSeedDomains(e.target.value)}
              className="min-h-[80px] bg-slate-950 border-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Location (optional — enables local buyer-intent queries)
            </label>
            <Input
              placeholder="e.g., Oakdale MN"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-slate-950 border-slate-800"
            />
          </div>

          <Button
            onClick={generateReport}
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Signal Map...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate ICP Signal Map
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {report && (
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              report.status === 'completed' ? 'bg-emerald-500' :
              report.status === 'partial' ? 'bg-amber-500' :
              'bg-red-500'
            }`} />
            <span className="text-sm text-slate-400">
              Report status: <span className="font-medium text-slate-200 capitalize">{report.status}</span>
            </span>
          </div>

          {/* Section: Discussion Venues */}
          {report.sections.find(s => s.section_type === 'discussion_venues') && (
            <SectionCard
              title="Discussion Venues"
              icon={<MessageCircle className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'discussion_venues')!}
            >
              {section => {
                const venues = section.data.venues || []
                if (venues.length === 0) {
                  return <EmptyState message="No discussion venues found" />
                }
                return (
                  <div className="space-y-4">
                    {venues.map((venue: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-cyan-400">
                            r/{venue.subreddit}
                          </h3>
                          <div className="text-sm text-slate-400">
                            {venue.post_count} posts • avg score {venue.avg_score}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {venue.top_posts.slice(0, 3).map((post: any, j: number) => (
                            <a
                              key={j}
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-slate-300 hover:text-cyan-400 transition-colors"
                            >
                              → {post.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* Section: Question Mining */}
          {report.sections.find(s => s.section_type === 'question_mining') && (
            <SectionCard
              title="Questions Your ICP Asks"
              icon={<Sparkles className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'question_mining')!}
            >
              {section => {
                const questions = section.data.questions || []
                if (questions.length === 0) {
                  return <EmptyState message="No questions found" />
                }
                return (
                  <div className="space-y-3">
                    {questions.slice(0, 15).map((q: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                        <p className="text-slate-200 mb-2">{q.question}</p>
                        <a
                          href={q.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:underline"
                        >
                          Source: {q.source}
                        </a>
                      </div>
                    ))}
                    {questions.length > 15 && (
                      <p className="text-sm text-slate-500 text-center">
                        +{questions.length - 15} more questions
                      </p>
                    )}
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* Section: AI Answer Share */}
          {report.sections.find(s => s.section_type === 'ai_answer_share') && (
            <SectionCard
              title="AI Answer Share"
              icon={<Bot className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'ai_answer_share')!}
              highlight
            >
              {section => {
                const queries = section.data.queries || []
                const mentions = section.data.business_mentions || {}
                
                if (queries.length === 0) {
                  return <EmptyState message="No AI responses retrieved" />
                }

                return (
                  <div className="space-y-6">
                    {/* Business Mentions Summary */}
                    {mentions.top_mentioned && mentions.top_mentioned.length > 0 && (
                      <div className="p-4 bg-slate-950/50 rounded-lg border border-cyan-900/30">
                        <h4 className="font-semibold text-cyan-400 mb-3">Top Mentioned Businesses</h4>
                        <div className="space-y-2">
                          {mentions.top_mentioned.slice(0, 10).map((mention: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-200">{mention.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-400">{mention.count} mentions</span>
                                <div className="flex gap-1">
                                  {mention.engines.map((engine: string, j: number) => (
                                    <span key={j} className="px-2 py-0.5 bg-cyan-900/20 text-cyan-400 rounded text-xs">
                                      {engine}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Responses */}
                    <div className="space-y-3">
                      {queries.slice(0, 5).map((query: any, i: number) => (
                        <details key={i} className="group">
                          <summary className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 cursor-pointer hover:border-cyan-900/50">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-cyan-400">{query.engine}</span>
                                <span className="text-slate-400 text-sm ml-2">• {query.query}</span>
                              </div>
                              <span className="text-slate-500 group-open:hidden">▼</span>
                              <span className="text-slate-500 hidden group-open:inline">▲</span>
                            </div>
                          </summary>
                          <div className="p-4 mt-2 bg-slate-950/80 rounded-lg border border-slate-800">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{query.response}</p>
                          </div>
                        </details>
                      ))}
                      {queries.length > 5 && (
                        <p className="text-sm text-slate-500 text-center">
                          +{queries.length - 5} more AI responses
                        </p>
                      )}
                    </div>
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* Section: Industry Hubs */}
          {report.sections.find(s => s.section_type === 'industry_hubs') && (
            <SectionCard
              title="Industry Hubs"
              icon={<Globe className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'industry_hubs')!}
            >
              {section => {
                const hubs = section.data.hubs || []
                if (hubs.length === 0) {
                  return <EmptyState message="No industry hubs found" />
                }
                return (
                  <div className="space-y-3">
                    {hubs.slice(0, 15).map((hub: any, i: number) => (
                      <div key={i} className="p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <a
                              href={`https://${hub.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-cyan-400 hover:underline"
                            >
                              {hub.domain}
                            </a>
                            <p className="text-sm text-slate-400 mt-1">{hub.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2 py-0.5 bg-cyan-900/20 text-cyan-400 rounded text-xs">
                              {hub.category}
                            </span>
                            <span className="text-xs text-slate-500">
                              {hub.mention_count} mention{hub.mention_count > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        {hub.source_urls.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-800">
                            <span className="text-xs text-slate-500">
                              Found on: {hub.source_urls.map((url: string) => new URL(url).hostname).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {hubs.length > 15 && (
                      <p className="text-sm text-slate-500 text-center">
                        +{hubs.length - 15} more hubs
                      </p>
                    )}
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* Section: Tech Stack */}
          {report.sections.find(s => s.section_type === 'tech_stack') && (
            <SectionCard
              title="Tech Stack"
              icon={<Zap className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'tech_stack')!}
            >
              {section => {
                const stack = section.data.stack || []
                if (stack.length === 0) {
                  return <EmptyState message="No technologies detected" />
                }

                const byCategory = stack.reduce((acc: any, tech: any) => {
                  if (!acc[tech.category]) acc[tech.category] = []
                  acc[tech.category].push(tech)
                  return acc
                }, {})

                return (
                  <div className="space-y-4">
                    {Object.entries(byCategory).map(([category, techs]: [string, any]) => (
                      <div key={category}>
                        <h4 className="text-sm font-semibold text-slate-400 uppercase mb-2">
                          {category}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {techs.map((tech: any, i: number) => (
                            <div key={i} className="p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-slate-200">{tech.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  tech.confidence === 'high' 
                                    ? 'bg-green-900/20 text-green-400' 
                                    : tech.confidence === 'medium'
                                    ? 'bg-yellow-900/20 text-yellow-400'
                                    : 'bg-slate-700 text-slate-400'
                                }`}>
                                  {tech.confidence}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">{tech.evidence}</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {tech.detected_on.map((domain: string, j: number) => (
                                  <span key={j} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">
                                    {domain}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* Podcasts */}
          {report.sections.find(s => s.section_type === 'podcasts') && (
            <SectionCard
              title="Podcasts"
              icon={<Headphones className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'podcasts')!}
            >
              {section => {
                const podcasts = section.data.podcasts || []
                if (podcasts.length === 0) {
                  return <EmptyState message="No podcasts found for this ICP" />
                }
                return (
                  <div className="space-y-3">
                    {podcasts.map((podcast: any, i: number) => (
                      <a
                        key={i}
                        href={podcast.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-cyan-500/30 transition-colors"
                      >
                        <div className="flex gap-4">
                          {podcast.image_url && (
                            <img 
                              src={podcast.image_url} 
                              alt={podcast.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-200 truncate">{podcast.name}</h3>
                            {podcast.publisher && (
                              <p className="text-sm text-slate-400 truncate">{podcast.publisher}</p>
                            )}
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{podcast.description}</p>
                            {podcast.total_episodes && (
                              <p className="text-xs text-slate-600 mt-2">
                                {podcast.total_episodes} episodes
                                {podcast.language && ` • ${podcast.language.toUpperCase()}`}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="h-5 w-5 text-slate-600 flex-shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* YouTube Channels */}
          {report.sections.find(s => s.section_type === 'youtube_channels') && (
            <SectionCard
              title="YouTube Channels"
              icon={<Youtube className="h-5 w-5" />}
              section={report.sections.find(s => s.section_type === 'youtube_channels')!}
            >
              {section => {
                const channels = section.data.channels || []
                if (channels.length === 0) {
                  return <EmptyState message="No YouTube channels found for this ICP" />
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {channels.map((channel: any, i: number) => (
                      <a
                        key={i}
                        href={channel.channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-cyan-500/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {channel.thumbnail_url && (
                            <img 
                              src={channel.thumbnail_url} 
                              alt={channel.name}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-200 truncate">{channel.name}</h3>
                            {channel.description && (
                              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{channel.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                              {channel.subscriber_count && (
                                <span>{formatNumber(channel.subscriber_count)} subscribers</span>
                              )}
                              {channel.video_count && (
                                <span>{formatNumber(channel.video_count)} videos</span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="h-5 w-5 text-slate-600 flex-shrink-0 mt-1" />
                        </div>
                      </a>
                    ))}
                  </div>
                )
              }}
            </SectionCard>
          )}

          {/* Sources Footer */}
          <div className="text-xs text-slate-500 text-center pt-6 border-t border-slate-800">
            Generated {new Date(report.created_at).toLocaleString()} • 
            {report.sections.reduce((sum, s) => sum + (s.sources?.length || 0), 0)} sources consulted
          </div>
        </div>
      )}
    </div>
  )
}

// Reusable section card component
function SectionCard({ 
  title, 
  icon, 
  section, 
  children,
  highlight = false 
}: {
  title: string
  icon: React.ReactNode
  section: SignalSection
  children: (section: SignalSection) => React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card className={`p-6 ${
      highlight 
        ? 'bg-gradient-to-br from-cyan-500/5 to-purple-600/5 border-cyan-500/20' 
        : 'bg-slate-900/50 border-slate-800'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
          highlight 
            ? 'bg-gradient-to-br from-cyan-500 to-purple-600' 
            : 'bg-slate-800'
        }`}>
          {icon}
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="ml-auto">
          <StatusBadge status={section.status} />
        </div>
      </div>
      {children(section)}
      {section.error_message && (
        <p className="mt-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
          {section.error_message}
        </p>
      )}
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    no_data: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }
  
  return (
    <span className={`text-xs px-2 py-1 rounded border ${colors[status as keyof typeof colors] || colors.pending}`}>
      {status}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-slate-500">
      <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p>{message}</p>
    </div>
  )
}
