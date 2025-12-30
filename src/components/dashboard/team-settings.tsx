'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Users, 
  UserPlus, 
  Crown, 
  Shield, 
  User,
  Loader2,
  Trash2,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Team, TeamMember, TeamRole } from '@/types/database'

interface TeamMemberWithUser extends TeamMember {
  users: {
    email: string
    full_name: string | null
  }
}

export function TeamSettings() {
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMemberWithUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('member')
  const [inviting, setInviting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTeamData()
  }, [])

  const fetchTeamData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // Get user's team
    const { data: userData } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', user.id)
      .single()

    if (!userData?.team_id) {
      setLoading(false)
      return
    }

    // Get team details
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', userData.team_id)
      .single()

    if (teamData) {
      setTeam(teamData)
      setIsOwner(teamData.owner_id === user.id)
    }

    // Get team members with user info
    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select(`
        *,
        users:user_id (
          email,
          full_name
        )
      `)
      .eq('team_id', userData.team_id)
      .order('created_at', { ascending: true })

    if (membersError) {
      console.error('Error fetching team members:', membersError)
    }

    if (membersData) {
      setMembers(membersData as TeamMemberWithUser[])
      const currentMember = membersData.find(m => m.user_id === user.id)
      setIsAdmin(currentMember?.role === 'admin' || currentMember?.role === 'owner')
    }

    setLoading(false)
  }

  const inviteMember = async () => {
    if (!team || !inviteEmail.trim()) return
    setInviting(true)

    try {
      // First check if user exists (case-insensitive)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('email', inviteEmail.trim())
        .single()

      if (!existingUser) {
        toast.error('User not found. They need to sign up first.')
        setInviting(false)
        return
      }

      // Check if already a member
      const existingMember = members.find(m => m.user_id === existingUser.id)
      if (existingMember) {
        toast.error('User is already a team member')
        setInviting(false)
        return
      }

      // Add to team
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: existingUser.id,
          role: inviteRole,
          invited_by: currentUserId,
        })

      if (error) {
        console.error('Invite error:', error)
        toast.error('Failed to add team member')
      } else {
        toast.success(`${inviteEmail} added to team as ${inviteRole}`)
        setInviteEmail('')
        setInviteRole('member')
        setDialogOpen(false)
        fetchTeamData()
      }
    } catch (err) {
      console.error('Invite error:', err)
      toast.error('Failed to add team member')
    }

    setInviting(false)
  }

  const updateMemberRole = async (memberId: string, newRole: TeamRole) => {
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (error) {
      toast.error('Failed to update role')
    } else {
      toast.success('Role updated')
      fetchTeamData()
    }
  }

  const removeMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === currentUserId) {
      toast.error("You can't remove yourself")
      return
    }

    const member = members.find(m => m.id === memberId)
    if (member?.role === 'owner') {
      toast.error("Can't remove the team owner")
      return
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      toast.error('Failed to remove member')
    } else {
      toast.success('Member removed')
      fetchTeamData()
    }
  }

  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-emerald-500" />
      default:
        return <User className="h-4 w-4 text-slate-400" />
    }
  }

  const getRoleBadge = (role: TeamRole) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Owner</Badge>
      case 'admin':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Admin</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Member</Badge>
    }
  }

  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        </CardContent>
      </Card>
    )
  }

  if (!team) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="py-8 text-center">
          <p className="text-slate-400">No team found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-white">Team</CardTitle>
          </div>
          {(isOwner || isAdmin) && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Add Team Member</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Add a new member to your team. They must have an existing account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Email Address</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                      <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="admin" className="text-white">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-500" />
                            Admin - Full access
                          </div>
                        </SelectItem>
                        <SelectItem value="member" className="text-white">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            Member - View only
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Admins can manage keywords and settings. Members have read-only access.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="border-slate-700 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={inviteMember}
                    disabled={inviting || !inviteEmail.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Member
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <CardDescription className="text-slate-400">
          {team.name} • {members.length} member{members.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
                  {getRoleIcon(member.role)}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {member.users?.full_name || member.users?.email?.split('@')[0] || 'Unknown'}
                    {member.user_id === currentUserId && (
                      <span className="text-slate-500 text-sm ml-2">(you)</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-400">{member.users?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(isOwner || isAdmin) && member.role !== 'owner' && member.user_id !== currentUserId ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(v) => updateMemberRole(member.id, v as TeamRole)}
                    >
                      <SelectTrigger className="w-[110px] border-slate-700 bg-slate-800 text-white h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="admin" className="text-white">Admin</SelectItem>
                        <SelectItem value="member" className="text-white">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(member.id, member.user_id)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  getRoleBadge(member.role)
                )}
              </div>
            </div>
          ))}
        </div>

        {members.length === 1 && (
          <div className="mt-4 p-4 rounded-lg bg-slate-800/30 border border-dashed border-slate-700">
            <p className="text-sm text-slate-400 text-center">
              You're the only team member. Add colleagues to collaborate on keyword monitoring.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
