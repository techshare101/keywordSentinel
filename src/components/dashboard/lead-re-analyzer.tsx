'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Zap, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface LeadReAnalyzerProps {
    lead: any
    userPlan: string
}

export function LeadReAnalyzer({ lead, userPlan }: LeadReAnalyzerProps) {
    const [open, setOpen] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [analysis, setAnalysis] = useState<string | null>(null)

    const isPremium = userPlan === 'pro' || userPlan === 'team'

    const handleAnalyze = async () => {
        if (!isPremium) return

        setAnalyzing(true)
        try {
            const response = await fetch('/api/leads/re-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze lead')
            }

            setAnalysis(data.analysis)
        } catch (error) {
            console.error('Premium analysis error:', error)
            toast.error('Failed to get premium analysis')
        } finally {
            setAnalyzing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                >
                    <Zap className="h-4 w-4 mr-1" />
                    Analyze
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[80vh] overflow-y-auto mt-20 md:mt-0 mb-20 md:mb-0">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Premium Lead Analysis
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Deep context-aware analysis using our most powerful intelligence layer.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {!isPremium ? (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-6 text-center space-y-4">
                            <Zap className="h-10 w-10 text-amber-500 mx-auto" />
                            <div className="space-y-2">
                                <h3 className="text-white font-bold">Pro Feature</h3>
                                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                    Upgrade to Pro to unlock deep reasoning, budget detection, and technical fit analysis for this lead.
                                </p>
                            </div>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white" asChild>
                                <a href="/pricing">View Pro Plans</a>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {!analysis && !analyzing && (
                                <div className="text-center py-8 space-y-4">
                                    <p className="text-slate-400 text-sm">
                                        Ready for a deep dive? Click below to start the premium analysis.
                                    </p>
                                    <Button
                                        onClick={handleAnalyze}
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Start Premium Analysis
                                    </Button>
                                </div>
                            )}

                            {analyzing && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                                    <p className="text-slate-400 animate-pulse text-sm">
                                        Consulting senior sales intelligence model...
                                    </p>
                                </div>
                            )}

                            {analysis && (
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 prose prose-invert prose-sm max-w-none">
                                    <div className="whitespace-pre-wrap text-slate-200">
                                        {analysis}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isPremium && analysis && (
                    <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-200/70">
                            This analysis is context-specific. Use these insights to craft a highly personalized response.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
