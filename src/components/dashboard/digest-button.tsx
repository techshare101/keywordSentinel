'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface DigestButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function DigestButton({ variant = 'outline', size = 'default', className }: DigestButtonProps) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSendDigest = async () => {
    setSending(true)
    
    try {
      const response = await fetch('/api/digest', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send digest')
      }

      if (data.success) {
        setSent(true)
        toast.success('Weekly digest sent!', {
          description: `Summary of ${data.digest.totalMatches} matches sent to your email`,
        })
        setTimeout(() => setSent(false), 3000)
      } else {
        toast.info('No digest to send', {
          description: data.message || 'No matches found for the past week',
        })
      }
    } catch (error) {
      console.error('Digest error:', error)
      toast.error('Failed to send digest', {
        description: (error as Error).message,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSendDigest}
      disabled={sending}
      className={className}
    >
      {sent ? (
        <>
          <Check className="mr-2 h-4 w-4 text-emerald-500" />
          Sent!
        </>
      ) : sending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <Mail className="mr-2 h-4 w-4" />
          Send Digest
        </>
      )}
    </Button>
  )
}
