import type { SignalConnector, SignalConnectorInput, SignalConnectorResult, Podcast } from '@/types/signal-map'

const TREG_URL = 'https://treg.to'

export class PodcastsConnector implements SignalConnector {
  id = 'podcasts'
  name = 'Podcasts'
  section_type = 'podcasts' as const

  async fetch(input: SignalConnectorInput): Promise<SignalConnectorResult> {
    const { icp_description, report_id } = input
    const token = process.env.TREG_API_KEY

    if (!token) {
      return {
        section_type: this.section_type,
        status: 'no_data',
        data: { podcasts: [] },
        sources: [],
        raw_fetches: [],
        error_message: 'TREG_API_KEY not configured',
      }
    }

    const endpoint = 'scrapecreators.x.v1-spotify-search'
    const requestUrl = `${TREG_URL}/call/${endpoint}?query=${encodeURIComponent(icp_description)}`
    const startTime = Date.now()

    try {
      console.log(`[PodcastsConnector] Searching Spotify for: ${icp_description}`)
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { 'X-Treg-Token': token },
      })

      const latencyMs = Date.now() - startTime
      const result = await response.json()

      if (!response.ok) {
        console.error(`[PodcastsConnector] treg returned ${response.status}:`, result)
        return {
          section_type: this.section_type,
          status: 'no_data',
          data: { podcasts: [] },
          sources: [],
          raw_fetches: [{
            report_id,
            connector_id: this.id,
            source: 'treg/spotify',
            request_url: requestUrl,
            request_params: { query: icp_description },
            response_body: result,
            response_status: response.status,
            latency_ms: Date.now() - startTime,
          }],
          error_message: `treg API error: ${response.status}`,
        }
      }

      // Spotify search returns shows/podcasts
      const shows = result?.data?.shows?.items || result?.shows?.items || result?.data?.episodes?.items || []
      const podcasts: Podcast[] = shows.slice(0, 20).map((show: any) => ({
        name: show.name || show.title || 'Unknown',
        publisher: show.publisher,
        description: (show.description || '').slice(0, 200),
        spotify_url: show.external_urls?.spotify || `https://open.spotify.com/show/${show.id}`,
        total_episodes: show.total_episodes,
        language: show.languages?.[0],
        image_url: show.images?.[0]?.url,
      }))

      return {
        section_type: this.section_type,
        status: podcasts.length > 0 ? 'completed' : 'no_data',
        data: { podcasts, total_found: podcasts.length },
        sources: [{
          source: 'spotify',
          url: 'https://open.spotify.com',
          description: `Spotify podcast search for "${icp_description}"`,
          fetched_at: new Date().toISOString(),
        }],
        raw_fetches: [{
          report_id,
          connector_id: this.id,
          source: 'treg/spotify',
          request_url: requestUrl,
          request_params: { query: icp_description },
          response_body: { show_count: shows.length },
          response_status: response.status,
          latency_ms: latencyMs,
        }],
      }
    } catch (error) {
      console.error('[PodcastsConnector] Error:', error)
      return {
        section_type: this.section_type,
        status: 'error',
        data: { podcasts: [] },
        sources: [],
        raw_fetches: [{
          report_id,
          connector_id: this.id,
          source: 'treg/spotify',
          request_url: requestUrl,
          request_params: { query: icp_description },
          response_body: { error: String(error) },
          response_status: 500,
          latency_ms: Date.now() - startTime,
        }],
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
