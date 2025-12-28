'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PLANS, type PlanId } from '@/lib/plans'
import { Zap, Check, Loader2, Crown, Rocket } from 'lucide-react'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
  suggestedPlan?: PlanId
  currentPlan?: PlanId
}

export function UpgradeModal({
  open,
  onOpenChange,
  reason,
  suggestedPlan = 'pro',
  currentPlan = 'starter',
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const plan = PLANS[suggestedPlan]
  const planIcon = suggestedPlan === 'business' ? Crown : suggestedPlan === 'pro' ? Zap : Rocket

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: suggestedPlan }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/signup?plan=${suggestedPlan}`)
        } else {
          alert(data.error || 'Failed to start checkout')
        }
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            {suggestedPlan === 'business' ? (
              <Crown className="h-6 w-6 text-emerald-400" />
            ) : suggestedPlan === 'pro' ? (
              <Zap className="h-6 w-6 text-emerald-400" />
            ) : (
              <Rocket className="h-6 w-6 text-emerald-400" />
            )}
          </div>
          <DialogTitle className="text-center text-xl text-white">
            Upgrade to {plan.name}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {reason || `Unlock powerful features with ${plan.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-lg bg-slate-800/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">Monthly</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">${plan.price}</span>
              <span className="text-slate-500">/mo</span>
            </div>
          </div>

          <ul className="space-y-2">
            {plan.features.slice(0, 5).map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Upgrade to {plan.name}
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/pricing')}
            className="text-slate-400 hover:text-white"
          >
            Compare all plans
          </Button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-2">
          Cancel anytime • 7-day money-back guarantee
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function useUpgradeModal() {
  const [modalState, setModalState] = useState<{
    open: boolean
    reason?: string
    suggestedPlan?: PlanId
  }>({ open: false })

  const showUpgradeModal = (reason?: string, suggestedPlan?: PlanId) => {
    setModalState({ open: true, reason, suggestedPlan })
  }

  const hideUpgradeModal = () => {
    setModalState({ open: false })
  }

  const UpgradeModalComponent = () => (
    <UpgradeModal
      open={modalState.open}
      onOpenChange={(open) => setModalState(prev => ({ ...prev, open }))}
      reason={modalState.reason}
      suggestedPlan={modalState.suggestedPlan}
    />
  )

  return { showUpgradeModal, hideUpgradeModal, UpgradeModalComponent }
}
