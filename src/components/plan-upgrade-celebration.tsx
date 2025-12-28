'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Sparkles, Zap, Crown, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import confetti from 'canvas-confetti'

interface PlanUpgradeCelebrationProps {
  isOpen: boolean
  onClose: () => void
  planName: string
  keywordLimit: number
  features: string[]
}

export function PlanUpgradeCelebration({
  isOpen,
  onClose,
  planName,
  keywordLimit,
  features
}: PlanUpgradeCelebrationProps) {
  const [showFeatures, setShowFeatures] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      const duration = 3000
      const end = Date.now() + duration

      const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b']

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      // Show features after a delay
      setTimeout(() => setShowFeatures(true), 500)
    } else {
      setShowFeatures(false)
    }
  }, [isOpen])

  const getPlanIcon = () => {
    switch (planName.toLowerCase()) {
      case 'starter': return Zap
      case 'pro': return Crown
      case 'business': return Building2
      default: return Sparkles
    }
  }

  const PlanIcon = getPlanIcon()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative max-w-md w-full mx-4 bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-slate-800 overflow-hidden"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-500/20 blur-3xl" />
            
            <div className="relative p-8">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 10 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center"
              >
                <PlanIcon className="w-10 h-10 text-white" />
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-white text-center mb-2"
              >
                Welcome to {planName}! 🎉
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-slate-400 text-center mb-6"
              >
                Your monitoring is now live with {keywordLimit} keywords
              </motion.p>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: showFeatures ? 1 : 0 }}
                className="space-y-3 mb-8"
              >
                {features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center gap-3 text-slate-300"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span>{feature}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button
                  onClick={onClose}
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-medium rounded-xl"
                >
                  Start Monitoring →
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
