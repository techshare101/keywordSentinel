'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function SignalMapTestPage() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const testAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      setResult({ step: 'auth', user: user?.email, userId: user?.id })
      setError('')
    } catch (err: any) {
      setError('Auth failed: ' + err.message)
    }
  }

  const testDatabase = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('signal_reports')
        .select('id, status')
        .limit(1)
      
      if (error) throw error
      setResult({ step: 'database', message: 'Database accessible', sample: data })
      setError('')
    } catch (err: any) {
      setError('Database failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const testAPI = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/signal-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icp_description: 'Test ICP for debugging',
          seed_domains: ['example.com']
        })
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${data.error || 'Unknown error'}`)
      }

      setResult({ step: 'api', message: 'API working', report: data.report })
      setError('')
    } catch (err: any) {
      setError('API failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Signal Map Diagnostic</h1>
      
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Step 1: Auth</h2>
          <Button onClick={testAuth} disabled={loading}>
            Test Authentication
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Step 2: Database</h2>
          <Button onClick={testDatabase} disabled={loading}>
            Test Database Access
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Step 3: API</h2>
          <Button onClick={testAPI} disabled={loading}>
            Test Signal Map API
          </Button>
        </Card>
      </div>

      {error && (
        <Card className="p-6 border-red-500 bg-red-950/20">
          <h3 className="font-semibold text-red-400 mb-2">Error</h3>
          <pre className="text-sm whitespace-pre-wrap">{error}</pre>
        </Card>
      )}

      {result && (
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Result: {result.step}</h3>
          <pre className="text-sm whitespace-pre-wrap bg-slate-900 p-4 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
