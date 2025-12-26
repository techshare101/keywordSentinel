'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Loader2, Radar } from 'lucide-react'

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const plan = searchParams.get('plan') || 'pro'

  useEffect(() => {
    // Give time for webhook to process
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-slate-800 bg-slate-900">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Radar className="h-12 w-12 text-emerald-500" />
          </div>
          {loading ? (
            <>
              <Loader2 className="h-16 w-16 text-emerald-500 animate-spin mx-auto mb-4" />
              <CardTitle className="text-white text-2xl">Processing your subscription...</CardTitle>
              <CardDescription className="text-slate-400">
                Please wait while we set up your account.
              </CardDescription>
            </>
          ) : (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <CardTitle className="text-white text-2xl">Welcome to {plan.charAt(0).toUpperCase() + plan.slice(1)}!</CardTitle>
              <CardDescription className="text-slate-400">
                Your subscription is now active. You have access to all {plan} features.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <>
              <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300">
                <p className="font-medium text-white mb-2">What's next?</p>
                <ul className="space-y-1">
                  <li>• Add more keywords to monitor</li>
                  <li>• Set up Slack or Discord alerts</li>
                  <li>• Configure your notification preferences</li>
                </ul>
              </div>
              <Link href="/dashboard" className="block">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Go to Dashboard
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
