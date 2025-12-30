'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Radar, Zap, Crown, Building2 } from 'lucide-react'
import { PLANS, type PlanId } from '@/lib/plans'

const PLAN_ORDER: PlanId[] = ['starter', 'pro', 'business']

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null)
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightPlan = searchParams.get('highlight')

  const handleSubscribe = async (plan: string) => {
    if (plan === 'enterprise') {
      setShowEnterpriseModal(true)
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

  return (
    <div className="min-h-screen bg-[#0a0f1a] selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-[#0a0f1a]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
              <Radar className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">KeywordSentinel</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-white">Pricing</Link>
            <Link href="#testimonials" className="hover:text-white transition-colors">Testimonials</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge variant="outline" className="px-3 py-1 border-slate-700 text-slate-400 bg-slate-800/50 mb-6">
            Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-400">
            Start free. Upgrade when you need more power.
          </p>
        </div>

        {/* Pricing Grid - 3 Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId]
            const isPro = planId === 'pro'
            const isHighlighted = highlightPlan === planId || (!highlightPlan && isPro)

            return (
              <Card 
                key={planId}
                className={`relative flex flex-col bg-[#0f1629] border-slate-800 rounded-2xl overflow-hidden ${
                  isHighlighted ? 'ring-1 ring-emerald-500/50' : ''
                }`}
              >
                {isPro && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-b-lg">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pt-8 pb-4 text-center">
                  <CardTitle className="text-xl text-white mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  <CardDescription className="text-slate-500 text-sm mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 px-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => {
                      const isHot = feature.includes('🔥')
                      return (
                        <li key={feature} className="flex items-center gap-3 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className={isHot ? 'text-white font-medium' : 'text-slate-300'}>
                            {feature}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
                <CardFooter className="p-6 pt-4">
                  <Button
                    className={`w-full h-11 rounded-lg font-medium ${
                      isPro
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                    onClick={() => handleSubscribe(planId)}
                    disabled={loading === planId}
                  >
                    {loading === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : planId === 'starter' ? (
                      'Start 7-Day Free Trial'
                    ) : planId === 'pro' ? (
                      'Get Pro'
                    ) : (
                      'Get Business'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Enterprise Section */}
        <div className="mt-12 max-w-5xl mx-auto">
          <Card className="bg-[#0f1629] border-slate-800 rounded-2xl">
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Building2 className="h-8 w-8 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Enterprise</h3>
                  <p className="text-slate-400 text-sm">
                    Unlimited keywords, custom integrations, SLA, SSO, and dedicated support.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 px-8"
                onClick={() => setShowEnterpriseModal(true)}
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Trust Badges */}
        <div className="mt-20 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
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
            <div className="text-xs text-slate-500">Start monitoring now</div>
          </div>
          <div>
            <div className="text-white font-semibold mb-1">7-Day Guarantee</div>
            <div className="text-xs text-slate-500">100% money back</div>
          </div>
        </div>
      </main>

      {/* Enterprise Modal */}
      {showEnterpriseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-900 border-slate-800 max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-white text-center">Enterprise Inquiry</CardTitle>
              <CardDescription className="text-slate-400 text-center">
                Contact our team for custom enterprise solutions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                <p className="text-slate-300 mb-4">
                  For enterprise onboarding, custom integrations, and volume pricing, please reach out to our sales team.
                </p>
                <a 
                  href="mailto:enterprise@keywordsentinel.ai"
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  enterprise@keywordsentinel.ai
                </a>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 border-slate-700 text-slate-300"
                onClick={() => setShowEnterpriseModal(false)}
              >
                Close
              </Button>
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => window.location.href = 'mailto:enterprise@keywordsentinel.ai'}
              >
                Email Sales
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}
