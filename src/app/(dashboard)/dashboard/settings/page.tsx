'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Mail, 
  MessageSquare, 
  Bell,
  Loader2,
  Save,
  User,
  Shield,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserSettings, User as UserType } from '@/types/database'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserType | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [fullName, setFullName] = useState('')
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [slackWebhook, setSlackWebhook] = useState('')
  const [discordWebhook, setDiscordWebhook] = useState('')
  const [alertFrequency, setAlertFrequency] = useState<'instant' | 'hourly' | 'daily'>('instant')
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, settingsRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
    ])

    if (profileRes.data) {
      setProfile(profileRes.data)
      setFullName(profileRes.data.full_name || '')
    }

    if (settingsRes.data) {
      setSettings(settingsRes.data)
      setEmailAlerts(settingsRes.data.email_alerts)
      setSlackWebhook(settingsRes.data.slack_webhook || '')
      setDiscordWebhook(settingsRes.data.discord_webhook || '')
      setAlertFrequency(settingsRes.data.alert_frequency as 'instant' | 'hourly' | 'daily')
    }

    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', user.id)

    if (error) {
      toast.error('Failed to save profile')
    } else {
      toast.success('Profile saved')
    }
    setSaving(false)
  }

  const saveNotifications = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_settings')
      .update({
        email_alerts: emailAlerts,
        slack_webhook: slackWebhook || null,
        discord_webhook: discordWebhook || null,
        alert_frequency: alertFrequency,
      })
      .eq('user_id', user.id)

    if (error) {
      toast.error('Failed to save settings')
    } else {
      toast.success('Notification settings saved')
    }
    setSaving(false)
  }

  const planDetails = {
    free: { name: 'Free', keywords: 3, interval: '60 min', price: '$0' },
    pro: { name: 'Pro', keywords: 50, interval: '15 min', price: '$19/mo' },
    team: { name: 'Team', keywords: 200, interval: '5 min', price: '$49/mo' },
    enterprise: { name: 'Enterprise', keywords: 'Unlimited', interval: '1 min', price: 'Custom' },
  }

  const currentPlan = profile?.plan || 'free'
  const plan = planDetails[currentPlan as keyof typeof planDetails]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">
          Manage your account and notification preferences.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-white">Profile</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border-slate-700 bg-slate-800 text-white max-w-md"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Email</Label>
            <Input
              value={profile?.email || ''}
              disabled
              className="border-slate-700 bg-slate-800/50 text-slate-400 max-w-md"
            />
            <p className="text-xs text-slate-500">Email cannot be changed</p>
          </div>
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-white">Notifications</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Configure how you receive alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <Label className="text-slate-300">Email Alerts</Label>
              </div>
              <p className="text-sm text-slate-500">
                Receive email notifications for new matches
              </p>
            </div>
            <Switch
              checked={emailAlerts}
              onCheckedChange={setEmailAlerts}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <Label className="text-slate-300">Weekly Digest</Label>
              </div>
              <p className="text-sm text-slate-500">
                Receive a weekly summary with top opportunities and insights
              </p>
            </div>
            <Switch
              checked={weeklyDigest}
              onCheckedChange={setWeeklyDigest}
            />
          </div>

          <Separator className="bg-slate-800" />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <Label className="text-slate-300">Slack Webhook URL</Label>
            </div>
            <Input
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
              className="border-slate-700 bg-slate-800 text-white"
            />
            <p className="text-xs text-slate-500">
              Optional: Add a Slack webhook to receive alerts in your workspace
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-400" />
              <Label className="text-slate-300">Discord Webhook URL</Label>
            </div>
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
              className="border-slate-700 bg-slate-800 text-white"
            />
            <p className="text-xs text-slate-500">
              Optional: Add a Discord webhook to receive alerts in your server
            </p>
          </div>

          <Separator className="bg-slate-800" />

          <div className="space-y-2">
            <Label className="text-slate-300">Alert Frequency</Label>
            <Select value={alertFrequency} onValueChange={(v) => setAlertFrequency(v as any)}>
              <SelectTrigger className="w-[200px] border-slate-700 bg-slate-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="instant" className="text-white">Instant</SelectItem>
                <SelectItem value="hourly" className="text-white">Hourly Digest</SelectItem>
                <SelectItem value="daily" className="text-white">Daily Digest</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              How often you want to receive alert notifications
            </p>
          </div>

          <Button
            onClick={saveNotifications}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Notifications
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-white">Subscription</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Your current plan and usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{plan.name} Plan</h3>
                <p className="text-sm text-slate-400">{plan.price}</p>
              </div>
              {currentPlan !== 'enterprise' && (
                <Link href="/pricing">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Upgrade
                  </Button>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Keywords</p>
                <p className="text-white font-medium">{plan.keywords}</p>
              </div>
              <div>
                <p className="text-slate-500">Scan Interval</p>
                <p className="text-white font-medium">{plan.interval}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
