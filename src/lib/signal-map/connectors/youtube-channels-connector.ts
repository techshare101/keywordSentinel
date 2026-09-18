import type { SignalConnector, SignalConnectorInput, SignalConnectorResult, YouTubeChannel } from '@/types/signal-map'

const TREG_URL = 'https://treg.to'

export class YouTubeChannelsConnector implements SignalConnector {
  id = 'youtube_channels'
  name = 'YouTube Channels'
  section_type = 'youtube_channels' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { icp_description, report_id } = input
    const token = process.env.TREG_API_KEY

    if (!token) {
      return {
        section_type: this.section_type,
        status: 'no_data',
        data: { channels: [] },
        sources: [],
        raw_fetches: [],
        error_message: 'TREG_API_KEY not configured',
      }
    }

    const endpoint = 'tikhub.x.youtube-web-v2-search-channels'
    const requestUrl = `${TREG_URL}/call/${endpoint}?keyword=${encodeURIComponent(icp_description)}&need_format=true`
    const startTime = Date.now()

    try {
      console.log(`[YouTubeChannelsConnector] Searching YouTube for: ${icp_description}`)
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { 'X-Treg-Token': token },
      })

      const latencyMs = Date.now() - startTime
      const result = await response.json()

      if (!response.ok) {
        console.error(`[YouTubeChannelsConnector] treg returned ${response.status}:`, result)
        return {
          section_type: this.section_type,
          status: 'no_data',
          data: { channels: [] },
          sources: [],
          raw_fetches: [{
            report_id,
            connector_id: this.id,
            source: 'treg/youtube',
            request_url: requestUrl,
            request_params: { keyword: icp_description },
            response_body: result,
            response_status: response.status,
            latency_ms: latencyMs,
          }],
          error_message: `treg API error: ${response.status}`,
        }
      }

      const rawChannels = result?.data?.channels || []
      const channels: YouTubeChannel[] = rawChannels.slice(0, 20).map((ch: any) => ({
        channel_id: ch.channel_id || ch.channelId || ch.id || '',
        name: ch.name || ch.title || ch.channel_title || 'Unknown',
        description: (ch.description || '').slice(0, 200),
        subscriber_count: ch.subscriber_count || ch.subscribers || ch.subscriberCountText,
        video_count: ch.video_count || ch.videoCount || ch.videos,
        channel_url: ch.channel_url || `https://www.youtube.com/channel/${ch.channel_id || ch.channelId || ch.id}`,
        thumbnail_url: ch.thumbnail?.[0]?.url || ch.avatar?.[0]?.url || ch.thumbnails?.[0]?.url,
      }))

      return {
        section_type: this.section_type,
        status: channels.length > 0 ? 'completed' : 'no_data',
        data: { channels, total_found: channels.length },
        sources: [{
          source: 'youtube',
          url: 'https://www.youtube.com',
          description: `YouTube channel search for "${icp_description}"`,
          fetched_at: new Date().toISOString(),
        }],
        raw_fetches: [{
          report_id,
          connector_id: this.id,
          source: 'treg/youtube',
          request_url: requestUrl,
          request_params: { keyword: icp_description },
          response_body: { channel_count: rawChannels.length },
          response_status: response.status,
          latency_ms: latencyMs,
        }],
      }
    } catch (error) {
      console.error('[YouTubeChannelsConnector] Error:', error)
      return {
        section_type: this.section_type,
        status: 'error',
        data: { channels: [] },
        sources: [],
        raw_fetches: [{
          report_id,
          connector_id: this.id,
          source: 'treg/youtube',
          request_url: requestUrl,
          request_params: { keyword: icp_description },
          response_body: { error: String(error) },
          response_status: 500,
          latency_ms: Date.now() - startTime,
        }],
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
