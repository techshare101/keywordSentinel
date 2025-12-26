import type { SourceType } from '@/types/database'

export interface ScoringResult {
    score: number
    bucket: 'hot' | 'warm' | 'cold' | 'neutral'
}

const INTENT_KEYWORDS = [
    'looking for',
    'any tool',
    'recommend',
    'alternative to',
    'how to',
    'best way to',
    'help with',
    'question about',
    'anyone know',
    'trying to',
    'problem with',
]

export function calculateHeuristicScore(
    title: string,
    content: string,
    source: SourceType,
    sentiment: 'positive' | 'negative' | 'neutral' | null = 'neutral'
): ScoringResult {
    let score = 0
    const combinedText = `${title} ${content}`.toLowerCase()

    // 1. Intent Score (Heuristic)
    let intentScore = 10
    const hasIntent = INTENT_KEYWORDS.some(k => combinedText.includes(k))
    if (hasIntent) {
        intentScore = 40
    }
    score += intentScore

    // 2. Source Score
    let sourceScore = 10
    if (source === 'hackernews') sourceScore = 25
    else if (source === 'reddit') sourceScore = 20
    else if (source === 'producthunt') sourceScore = 15
    score += sourceScore

    // 3. Sentiment Score
    let sentimentScore = 0
    if (sentiment === 'positive') sentimentScore = 10
    else if (sentiment === 'neutral') sentimentScore = 5
    score += sentimentScore

    // 4. Recency bonus (always 15 for now as we only scan new matches)
    score += 15

    // Determine Bucket
    let bucket: 'hot' | 'warm' | 'cold' | 'neutral' = 'neutral'
    if (score >= 70) bucket = 'hot'
    else if (score >= 40) bucket = 'warm'
    else if (score > 10) bucket = 'cold'

    return {
        score: Math.min(100, score),
        bucket
    }
}
