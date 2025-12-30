'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Mail, Shield, Zap } from 'lucide-react'

// Founder emails that can see this component
const FOUNDER_EMAILS = [
  'support@metalmindtech.com',
  // Add other founder emails here
]

interface FounderTestAlertProps {
  userEmail: string | null
}

export function FounderTestAlert({ userEmail }: FounderTestAlertProps) {
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  // Only show for founders
  if (!userEmail || !FOUNDER_EMAILS.includes(userEmail.toLowerCase())) {
    return null
  }

  const sendTestAlert = async () => {
    setSending(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated')
        return
      }

      const response = await fetch('/api/test-alert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Test alert sent! Check your email.', {
          description: `Sent to ${data.email}`
        })
      } else {
        toast.error(data.error || 'Failed to send test alert', {
          description: data.hint || data.details
        })
      }
    } catch (error) {
      console.error('Test alert error:', error)
      toast.error('Failed to send test alert')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-white">Founder Tools</CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          Admin-only features for testing and debugging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-800/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-white">Send Test Alert</span>
            </div>
            <p className="text-sm text-slate-400">
              Send a test HOT lead email to verify Resend is working
            </p>
          </div>
          <Button
            onClick={sendTestAlert}
            disabled={sending}
            variant="outline"
            className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>
        </div>
        
        <p className="text-xs text-slate-500">
          🔒 This section is only visible to founders. Test alerts don't affect metrics or scan data.
        </p>
      </CardContent>
    </Card>
  )
}
