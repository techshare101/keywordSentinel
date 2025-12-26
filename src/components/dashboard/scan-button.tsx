'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ScanButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function ScanButton({ variant = 'default', size = 'default', className }: ScanButtonProps) {
  const [scanning, setScanning] = useState(false)
  const router = useRouter()

  const handleScan = async () => {
    setScanning(true)
    
    try {
      const response = await fetch('/api/scan/user', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed')
      }
      
      if (data.matchesFound > 0) {
        toast.success(`Found ${data.matchesFound} new match${data.matchesFound > 1 ? 'es' : ''}!`, {
          description: `Scanned ${data.keywordsScanned} keyword${data.keywordsScanned > 1 ? 's' : ''}`,
        })
        router.refresh()
      } else {
        toast.info('Scan complete', {
          description: 'No new matches found',
        })
      }
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('Scan failed', {
        description: (error as Error).message,
      })
    } finally {
      setScanning(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleScan}
      disabled={scanning}
      className={className}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
      {scanning ? 'Scanning...' : 'Scan Now'}
    </Button>
  )
}
