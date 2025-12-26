'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Radar } from 'lucide-react'
import { PLANS } from '@/lib/plans'

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

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

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {/* Free Plan */}
          <Card className="border-white/5 bg-white/[0.02] backdrop-blur-xl flex flex-col hover:border-white/10 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {PLANS.free.name}
              </CardTitle>
              <CardDescription className="text-slate-500">
                For exploring the signal
              </CardDescription>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-white tracking-tight">$0</span>
                <span className="text-slate-500">/month</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-4">
                {PLANS.free.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-400 text-sm">
                    {feature.includes('❌') ? (
                      <span className="text-slate-600 line-through">{feature.replace('❌ ', '')}</span>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
                        <span>{feature}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-xs text-slate-500 text-center italic">
                Great for discovering what people talk about. Upgrade when you want to act.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                onClick={() => handleSubscribe('free')}
                disabled={loading === 'free'}
              >
                Start Free
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className="border-emerald-500/20 bg-emerald-500/[0.03] backdrop-blur-2xl relative flex flex-col scale-105 shadow-2xl shadow-emerald-500/5 ring-1 ring-emerald-500/30">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
              Unlock 🔥 Hot Leads
            </div>
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>{PLANS.pro.name}</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/20">
                  Most Popular
                </Badge>
              </CardTitle>
              <CardDescription className="text-emerald-100/50">
                ⚡ Most founders upgrade here
              </CardDescription>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-white tracking-tight">${PLANS.pro.price}</span>
                <span className="text-emerald-100/40">/month</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-4">
                {PLANS.pro.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-300 text-sm">
                    <Check className={`h-4 w-4 mt-0.5 ${feature.includes('🔥') ? 'text-orange-500' : 'text-emerald-500'}`} />
                    <span className={feature.includes('🔥') ? 'font-bold text-white' : ''}>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 h-12 text-lg font-semibold"
                onClick={() => handleSubscribe('pro')}
                disabled={loading === 'pro'}
              >
                {loading === 'pro' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Unlock Hot Leads'
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Team Plan */}
          <Card className="border-white/5 bg-white/[0.02] backdrop-blur-xl flex flex-col hover:border-white/10 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white">{PLANS.team.name}</CardTitle>
              <CardDescription className="text-slate-500">
                Built for agencies & teams
              </CardDescription>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-white tracking-tight">${PLANS.team.price}</span>
                <span className="text-slate-500">/month</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-4">
                {PLANS.team.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-400 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                onClick={() => handleSubscribe('team')}
                disabled={loading === 'team'}
              >
                Upgrade to Team
              </Button>
            </CardFooter>
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
