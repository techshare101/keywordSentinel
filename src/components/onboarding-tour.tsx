'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  X, 
  ArrowRight, 
  Search, 
  TrendingUp, 
  Bell, 
  Sparkles,
  Keyboard,
  CheckCircle,
} from 'lucide-react'

interface TourStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  target?: string
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to KeywordSentinel! 🎉',
    description: 'Let\'s take a quick tour to help you get started with monitoring keywords across the web.',
    icon: <Sparkles className="h-6 w-6 text-emerald-400" />,
  },
  {
    id: 'keywords',
    title: 'Add Your Keywords',
    description: 'Start by adding keywords you want to monitor. These can be your brand name, competitors, or topics you care about.',
    icon: <Search className="h-6 w-6 text-blue-400" />,
    target: '/dashboard/keywords',
  },
  {
    id: 'matches',
    title: 'View Your Matches',
    description: 'When we find mentions of your keywords on Reddit, Hacker News, and more, they\'ll appear here with AI summaries.',
    icon: <TrendingUp className="h-6 w-6 text-emerald-400" />,
    target: '/dashboard/matches',
  },
  {
    id: 'alerts',
    title: 'Get Instant Alerts',
    description: 'Set up email, Slack, or Discord notifications to get alerted the moment your keywords are mentioned.',
    icon: <Bell className="h-6 w-6 text-amber-400" />,
    target: '/dashboard/settings',
  },
  {
    id: 'shortcuts',
    title: 'Pro Tip: Keyboard Shortcuts',
    description: 'Press Cmd+K (or Ctrl+K) anytime to open the command palette for quick navigation.',
    icon: <Keyboard className="h-6 w-6 text-purple-400" />,
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'Start adding keywords and we\'ll begin monitoring for you. Happy hunting!',
    icon: <CheckCircle className="h-6 w-6 text-emerald-400" />,
  },
]

export function OnboardingTour() {
  const [showTour, setShowTour] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    checkFirstVisit()
  }, [])

  const checkFirstVisit = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if user has completed onboarding
    const completed = localStorage.getItem(`onboarding_completed_${user.id}`)
    if (!completed) {
      // Small delay to let the page load
      setTimeout(() => setShowTour(true), 1000)
    }
  }

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const handleSkip = () => {
    completeTour()
  }

  const completeTour = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true')
    }
    setShowTour(false)
  }

  if (!showTour) return null

  const step = tourSteps[currentStep]
  const isLastStep = currentStep === tourSteps.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="rounded-full bg-slate-800 p-3">
              {step.icon}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="text-slate-400 hover:text-white -mt-2 -mr-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">{step.title}</h2>
          <p className="text-slate-400 mb-6">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-emerald-500'
                    : index < currentStep
                    ? 'bg-emerald-500/50'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-slate-400 hover:text-white"
            >
              Skip tour
            </Button>
            <Button
              onClick={handleNext}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
