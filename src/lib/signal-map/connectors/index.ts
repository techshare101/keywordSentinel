import type { SignalConnector } from '@/types/signal-map'
import { RedditConnector } from './reddit-connector'
import { QuestionMiningConnector } from './question-mining-connector'
import { AIAnswerShareConnector } from './ai-answer-share-connector'
import { IndustryHubsConnector } from './industry-hubs-connector'
import { TechStackConnector } from './tech-stack-connector'
import { PodcastsConnector } from './podcasts-connector'
import { YouTubeChannelsConnector } from './youtube-channels-connector'

// Connector registry — all active connectors run in parallel
export const signalConnectors: SignalConnector[] = [
  new RedditConnector(),
  new QuestionMiningConnector(),
  new AIAnswerShareConnector(),
  new IndustryHubsConnector(),
  new TechStackConnector(),
  new PodcastsConnector(),
  new YouTubeChannelsConnector(),
]

export function getConnector(sectionType: string): SignalConnector | undefined {
  return signalConnectors.find((c) => c.section_type === sectionType)
}

export function getAllConnectors(): SignalConnector[] {
  return signalConnectors
}
