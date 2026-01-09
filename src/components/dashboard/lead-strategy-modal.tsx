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
import { Target, Loader2, ShieldAlert, Compass, Lightbulb, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import type { StrategicAdvice } from '@/lib/services/agents/strategist'

interface LeadStrategyModalProps {
    lead: any
    userPlan: string
}

export function LeadStrategyModal({ lead, userPlan }: LeadStrategyModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [strategy, setStrategy] = useState<StrategicAdvice | null>(null)

    const isPremium = ['pro', 'business', 'enterprise', 'team'].includes(userPlan)

    const fetchStrategy = async () => {
        if (!isPremium) return

        setLoading(true)
        try {
            const response = await fetch('/api/leads/strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Agent failed to respond')
            }

            setStrategy(data.strategy)
        } catch (error) {
            console.error('Agent error:', error)
            toast.error('The Strategist agent is currently unavailable.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => !strategy && fetchStrategy()}
                    className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                >
                    <Target className="h-4 w-4 mr-1" />
                    Strategy
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Target className="h-5 w-5 text-emerald-500" />
                        Lead Strategist Agent
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Powered by OpenAI Reasoning. Tactical advice for high-stakes conversion.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {!isPremium ? (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-6 text-center space-y-4">
                            <Target className="h-10 w-10 text-emerald-500 mx-auto" />
                            <div className="space-y-2">
                                <h3 className="text-white font-bold">Team Feature</h3>
                                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                    Get a dedicated AI strategist for your leads. Upgrade to a Team plan to unlock agent-driven conversion tactics.
                                </p>
                            </div>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                                <a href="/pricing">Talk to Sales</a>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {loading && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                    <p className="text-slate-400 animate-pulse text-sm">
                                        Brainstorming conversion tactics...
                                    </p>
                                </div>
                            )}

                            {strategy && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    {/* Summary */}
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Compass className="h-3 w-3" /> Core Insight
                                        </h4>
                                        <p className="text-slate-200 text-sm italic">"{strategy.summary}"</p>
                                    </div>

                                    {/* Angle & Entry */}
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <h4 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                                <Lightbulb className="h-3 w-3 text-amber-400" /> Best Angle
                                            </h4>
                                            <div className="text-sm text-slate-300 bg-slate-800/30 p-3 rounded border border-slate-800">
                                                {strategy.suggested_angle}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                                <MessageSquare className="h-3 w-3 text-blue-400" /> Entry Point
                                            </h4>
                                            <div className="text-sm text-slate-300 bg-slate-800/30 p-3 rounded border border-slate-800">
                                                {strategy.entry_point}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Danger Zones */}
                                    <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/20">
                                        <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <ShieldAlert className="h-3 w-3" /> Danger Zones
                                        </h4>
                                        <ul className="space-y-1">
                                            {strategy.danger_zones.map((zone, i) => (
                                                <li key={i} className="text-xs text-red-200/70 flex items-start gap-2">
                                                    <span className="text-red-500 mt-0.5">•</span> {zone}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
