'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Radar, X, Zap, Crown, Building2, Sparkles } from 'lucide-react'
import { PLANS, type PlanId } from '@/lib/plans'

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'pro', 'business']

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightPlan = searchParams.get('highlight')

  const handleSubscribe = async (plan: string) => {
    if (plan === 'free') {
      router.push('/signup')
      return
    }

    setLoading(plan)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Checkout error:', data.error)
        if (response.status === 401) {
          router.push('/signup?plan=' + plan)
        } else {
          alert(data.error || 'Failed to start checkout')
        }
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'starter': return Zap
      case 'pro': return Crown
      case 'business': return Building2
      default: return Sparkles
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] selection:bg-emerald-500/30">
      {/* Premium Background Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
              <Radar className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">KeywordSentinel</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-4 py-20">
        <div className="text-center mb-20 space-y-4">
          <Badge variant="outline" className="px-4 py-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/5 backdrop-blur-sm mb-4">
            Monetization-Ready Monitoring
          </Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">
            Stop monitoring keywords.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500">
              Start catching buyers.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            KeywordSentinel detects real-time buyer intent across the web — and tells you exactly when someone is ready to buy.
          </p>
        </div>

        {/* Pricing Grid - 4 Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId]
            const isPro = planId === 'pro'
            const isHighlighted = highlightPlan === planId || (!highlightPlan && isPro)
            const Icon = getPlanIcon(planId)

            return (
              <Card 
                key={planId}
                className={`flex flex-col transition-all duration-300 ${
                  isHighlighted 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03] ring-1 ring-emerald-500/30 scale-[1.02] shadow-2xl shadow-emerald-500/10' 
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${isHighlighted ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                      <Icon className={`h-4 w-4 ${isHighlighted ? 'text-emerald-400' : 'text-slate-400'}`} />
                    </div>
                    <CardTitle className="text-white text-lg">{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white tracking-tight">${plan.price}</span>
                    <span className="text-slate-500 text-sm">/mo</span>
                  </div>
                  <CardDescription className="text-slate-500 text-xs mt-2">
                    {planId === 'free' && 'Get started for free'}
                    {planId === 'starter' && 'For solo founders'}
                    {planId === 'pro' && 'For growing teams'}
                    {planId === 'business' && 'For agencies & enterprises'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => {
                      const isDisabled = feature.includes('❌')
                      const isHot = feature.includes('🔥')
                      return (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          {isDisabled ? (
                            <>
                              <X className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                              <span className="text-slate-600">{feature.replace('❌ ', '')}</span>
                            </>
                          ) : (
                            <>
                              <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isHot ? 'text-orange-500' : 'text-emerald-500'}`} />
                              <span className={isHot ? 'font-semibold text-white' : 'text-slate-400'}>{feature}</span>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
                <CardFooter className="pt-4">
                  <Button
                    className={`w-full h-11 font-medium ${
                      isHighlighted
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                    onClick={() => handleSubscribe(planId)}
                    disabled={loading === planId}
                  >
                    {loading === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : planId === 'free' ? (
                      'Start Free'
                    ) : (
                      `Get ${plan.name}`
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-12 max-w-3xl mx-auto">
          <Card className="border-white/5 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-xl">
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Need Enterprise?</h3>
                <p className="text-slate-400 text-sm">
                  Custom limits, dedicated support, SLA, and white-glove onboarding for large teams.
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10 whitespace-nowrap"
                onClick={() => window.location.href = 'mailto:enterprise@keywordsentinel.ai'}
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Trust/Footer */}
        <div className="mt-24 max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center border-t border-white/5 pt-12">
          <div>
            <div className="text-white font-semibold mb-1">Cancel Anytime</div>
            <div className="text-xs text-slate-500">No lock-in contracts</div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">Secure Payments</div>
            <div className="text-xs text-slate-500">Powered by Stripe</div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">Instant Activation</div>
            <div className="text-xs text-slate-500">Unlock intent leads now</div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">7-Day Guarantee</div>
            <div className="text-xs text-slate-500">100% money back</div>
          </div>
        </div>

        <div className="mt-16 text-center text-slate-500 text-sm">
          You only pay to unlock real buyer intent. Start small, grow with us.
        </div>
      </main>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}
