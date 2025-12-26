'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2, Radar } from 'lucide-react'
import { PLANS } from '@/lib/stripe'

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

      if (data.url) {
        window.location.href = data.url
      } else {
        // User not logged in, redirect to signup
        router.push('/signup?plan=' + plan)
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Radar className="h-8 w-8 text-emerald-500" />
            <span className="text-xl font-bold text-white">KeywordSentinel</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start free, upgrade when you need more. All plans include AI-powered summaries and instant alerts.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="border-slate-800 bg-slate-900 relative">
            <CardHeader>
              <CardTitle className="text-white">{PLANS.free.name}</CardTitle>
              <CardDescription className="text-slate-400">
                Perfect for getting started
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-slate-400">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PLANS.free.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-slate-800 hover:bg-slate-700 text-white"
                onClick={() => handleSubscribe('free')}
                disabled={loading === 'free'}
              >
                {loading === 'free' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Get Started Free'
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className="border-emerald-500/50 bg-slate-900 relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white">
              Most Popular
            </Badge>
            <CardHeader>
              <CardTitle className="text-white">{PLANS.pro.name}</CardTitle>
              <CardDescription className="text-slate-400">
                For serious keyword monitoring
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">${PLANS.pro.price}</span>
                <span className="text-slate-400">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PLANS.pro.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleSubscribe('pro')}
                disabled={loading === 'pro'}
              >
                {loading === 'pro' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Subscribe to Pro'
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Team Plan */}
          <Card className="border-slate-800 bg-slate-900 relative">
            <CardHeader>
              <CardTitle className="text-white">{PLANS.team.name}</CardTitle>
              <CardDescription className="text-slate-400">
                For teams and agencies
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">${PLANS.team.price}</span>
                <span className="text-slate-400">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PLANS.team.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-slate-800 hover:bg-slate-700 text-white"
                onClick={() => handleSubscribe('team')}
                disabled={loading === 'team'}
              >
                {loading === 'team' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Subscribe to Team'
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <p className="text-slate-400">
            All plans include a 7-day money-back guarantee. Cancel anytime.
          </p>
        </div>
      </main>
    </div>
  )
}
