'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Clock, Activity } from 'lucide-react'

interface ScanRun {
    id: string
    started_at: string
    finished_at: string
    keywords_scanned: number
    matches_found: number
    aborted: boolean
    error: string | null
    duration_ms: number | null
}

export function ScanMetrics() {
    const [runs, setRuns] = useState<ScanRun[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const response = await fetch('/api/metrics/scan')
                const data = await response.json()
                if (data.runs) {
                    setRuns(data.runs)
                }
            } catch (error) {
                console.error('Failed to fetch scan metrics:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchMetrics()
        // Refresh every minute
        const interval = setInterval(fetchMetrics, 60000)
        return () => clearInterval(interval)
    }, [])

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (runs.length === 0) return null

    const latest = runs[0]
    const lastScanDate = new Date(latest.started_at)

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Scanner Status
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Last automated scan: {lastScanDate.toLocaleString()}
                        </CardDescription>
                    </div>
                    <Badge
                        variant={latest.aborted ? "outline" : "default"}
                        className={latest.aborted
                            ? (latest.error === 'insufficient_credits' ? "text-red-600 border-red-200 bg-red-50" : "text-yellow-600 border-yellow-200 bg-yellow-50")
                            : "bg-green-500 hover:bg-green-600"}
                    >
                        {latest.aborted ? (
                            <span className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {latest.error === 'insufficient_credits' ? 'Aborted (No Credits)' : 'Aborted (Rate Limited)'}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Successful
                            </span>
                        )}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-3 divide-x border-b">
                    <div className="p-4 text-center">
                        <div className="text-2xl font-bold">{latest.keywords_scanned}</div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Keywords</p>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-2xl font-bold">{latest.matches_found}</div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">New Matches</p>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-2xl font-bold">{(latest.duration_ms ? latest.duration_ms / 1000 : 0).toFixed(1)}s</div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Duration</p>
                    </div>
                </div>

                <div className="p-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Recent Runs</h4>
                    <div className="space-y-3">
                        {runs.slice(0, 5).map((run) => (
                            <div key={run.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{new Date(run.started_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-medium">{run.keywords_scanned} keywords / {run.matches_found} matches</span>
                                    {run.aborted ? (
                                        <Badge
                                            variant="outline"
                                            className={`h-5 px-1.5 text-[10px] ${run.error === 'insufficient_credits' ? 'text-red-600 border-red-200' : 'text-yellow-600 border-yellow-200'}`}
                                        >
                                            {run.error === 'insufficient_credits' ? 'No Credits' : 'Rate Ltd'}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-green-600 border-green-200">OK</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
