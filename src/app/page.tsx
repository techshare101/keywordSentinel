import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Radar,
  Search,
  Bell,
  Zap,
  TrendingUp,
  Shield,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Globe,
  Sparkles,
} from 'lucide-react'

const features = [
  {
    icon: Search,
    title: 'Always-On Monitoring',
    description: 'Track keywords 24/7 across Reddit, Hacker News, Product Hunt, Google News, and more.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Summaries',
    description: 'Get instant context on why each mention matters, with sentiment analysis and suggested actions.',
  },
  {
    icon: Bell,
    title: 'Instant Alerts',
    description: 'Receive real-time notifications via email, Slack, or Discord the moment your keywords are mentioned.',
  },
  {
    icon: TrendingUp,
    title: 'Lead Scoring',
    description: 'AI identifies high-value opportunities like buyers asking for solutions or competitor complaints.',
  },
  {
    icon: Shield,
    title: 'Competitor Tracking',
    description: 'Monitor competitor mentions, sentiment, and feature requests to stay ahead.',
  },
  {
    icon: Globe,
    title: 'Multi-Source Coverage',
    description: 'One dashboard for all your monitoring needs. No more manual searching across platforms.',
  },
]

const sources = [
  { name: 'Reddit', emoji: '🔴' },
  { name: 'Hacker News', emoji: '🟠' },
  { name: 'Product Hunt', emoji: '🟣' },
  { name: 'Google News', emoji: '📰' },
  { name: 'Twitter/X', emoji: '🐦' },
]

const pricing = [
  {
    name: 'Starter',
    price: '$19',
    period: '/month',
    description: 'For solo founders getting started',
    features: ['7 keywords', '15 scans per day', 'Email alerts', 'Daily digest', '🔥 Hot Lead detection', 'Basic AI summaries'],
    cta: 'Start 7-Day Trial',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For serious monitoring',
    features: ['15 keywords', '15-minute scans', 'Slack & Discord alerts', 'Competitor tracking', 'Advanced lead scoring', 'Priority support'],
    cta: 'Start Pro Trial',
    popular: true,
  },
  {
    name: 'Business',
    price: '$99',
    period: '/month',
    description: 'For teams and agencies',
    features: ['25 keywords', '5-minute scans', 'All alert channels', 'Team access (10 seats)', 'API & Webhooks', 'White-label reports'],
    cta: 'Start Business Trial',
    popular: false,
  },
]

const testimonials = [
  {
    quote: "KeywordSentinel helped us catch 3 enterprise leads in the first week. The AI summaries saved us hours of manual review.",
    author: "Sarah Chen",
    role: "Founder, SaaSMetrics",
  },
  {
    quote: "Finally, a monitoring tool that actually tells me what to do with each mention. Game changer for our sales team.",
    author: "Marcus Johnson",
    role: "Head of Growth, TechFlow",
  },
  {
    quote: "We track competitor mentions and pain points. It's like having a research team working 24/7.",
    author: "Emily Rodriguez",
    role: "Product Manager, CloudBase",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500">
                <Radar className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">KeywordSentinel</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm text-slate-400 hover:text-white transition-colors">Testimonials</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white">
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
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-6 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
            <Sparkles className="mr-1 h-3 w-3" />
            AI-Powered Keyword Monitoring
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Know When Anyone Mentions
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              What Matters to You
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Monitor Reddit, Hacker News, Product Hunt, and more. Get instant AI-powered alerts 
            with context, sentiment, and suggested actions.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/signup">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 h-14">
                Start 7-Day Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 text-lg px-8 h-14">
                View Pricing
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              7-day free trial
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Setup in 2 minutes
            </div>
          </div>
        </div>
      </section>

      {/* Sources Section */}
      <section className="py-12 border-y border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-slate-500 mb-6">MONITORING SOURCES</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {sources.map((source) => (
              <div key={source.name} className="flex items-center gap-2 text-slate-400">
                <span className="text-2xl">{source.emoji}</span>
                <span className="font-medium">{source.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-800 text-slate-300 border-slate-700">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need to Stay Informed
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Stop manually searching. Let AI do the heavy lifting while you focus on what matters.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-800 text-slate-300 border-slate-700">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              From Keyword to Opportunity in 3 Steps
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Add Your Keywords</h3>
              <p className="text-slate-400">
                Enter keywords, competitor names, or pain points you want to track.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-emerald-400">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">We Scan 24/7</h3>
              <p className="text-slate-400">
                Our system monitors Reddit, HN, Product Hunt, and news sources continuously.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-emerald-400">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Get AI Insights</h3>
              <p className="text-slate-400">
                Receive instant alerts with summaries, sentiment, and recommended actions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-800 text-slate-300 border-slate-700">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-400">
              Start with a 7-day free trial. No credit card required.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-xl border ${
                  plan.popular
                    ? 'border-emerald-500 bg-gradient-to-b from-emerald-500/10 to-transparent'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white border-0">
                    Most Popular
                  </Badge>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400">{plan.period}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-slate-800 text-slate-300 border-slate-700">Testimonials</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Loved by Founders & Teams
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="p-6 rounded-xl border border-slate-800 bg-slate-900/50"
              >
                <MessageSquare className="h-8 w-8 text-emerald-500/50 mb-4" />
                <p className="text-slate-300 mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <p className="font-medium text-white">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Never Miss a Mention?
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Join hundreds of founders and teams who use KeywordSentinel to catch buyers before competitors do.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 h-14">
              Start Your 7-Day Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <Radar className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">KeywordSentinel</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-sm text-slate-500">
              © 2024 KeywordSentinel. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
