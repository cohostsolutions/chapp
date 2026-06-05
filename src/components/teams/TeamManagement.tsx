import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Crown,
  AlertCircle,
  Loader2,
  UserPlus,
  UserMinus,
} from 'lucide-react';

interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  team_lead_id: string | null;
  created_at: string;
  updated_at: string;
  team_lead?: {
    full_name: string | null;
    email: string;
  };
  member_count?: number;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'member' | 'lead';
  joined_at: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

const NO_TEAM_LEAD_VALUE = '__none__';

export function TeamManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, effectiveIsSuperAdmin, effectiveIsClientAdmin } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');

  // Form state
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamLeadId, setTeamLeadId] = useState<string>('');

  const canManageTeams = effectiveIsSuperAdmin || effectiveIsClientAdmin;

  const syncTeamLeadMembership = async (teamId: string, nextLeadId: string | null) => {
    const { data: existingMembers, error: membersError } = await supabase
      .from('team_members')
      .select('id, user_id, role')
      .eq('team_id', teamId);

    if (membersError) throw membersError;

    if ((existingMembers || []).some((member) => member.role === 'lead')) {
      const { error: demoteError } = await supabase
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', teamId)
        .eq('role', 'lead');

      if (demoteError) throw demoteError;
    }

    if (nextLeadId) {
      const existingLeadMember = (existingMembers || []).find((member) => member.user_id === nextLeadId);

      if (existingLeadMember) {
        const { error: promoteError } = await supabase
          .from('team_members')
          .update({ role: 'lead' })
          .eq('id', existingLeadMember.id);

        if (promoteError) throw promoteError;
      } else {
        const { error: insertLeadError } = await supabase
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: nextLeadId,
            role: 'lead',
          });

        if (insertLeadError) throw insertLeadError;
      }
    }

    const { error: teamError } = await supabase
      .from('teams')
      .update({ team_lead_id: nextLeadId })
      .eq('id', teamId);

    if (teamError) throw teamError;
  };

  // Fetch teams
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_lead:team_lead_id(full_name, email)
        `)
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;

      // Get member counts
      const teamsWithCounts = await Promise.all(
        (data || []).map(async (team) => {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);

          return { ...team, member_count: count || 0 };
        })
      );

      return teamsWithCounts as Team[];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch team members for selected team
  const { data: teamMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return [];

      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:user_id(full_name, email)
        `)
        .eq('team_id', selectedTeam.id)
        .order('role', { ascending: false });

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!selectedTeam?.id && isMembersDialogOpen,
  });

  // Fetch available users for team assignment
  const { data: availableUsers } = useQuery({
    queryKey: ['available-users', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('organization_id', profile.organization_id)
        .order('full_name');

      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!profile?.organization_id,
  });

  const availableUsersForSelectedTeam = useMemo(() => {
    const existingMemberIds = new Set((teamMembers || []).map((member) => member.user_id));
    return (availableUsers || []).filter((user) => !existingMemberIds.has(user.id));
  }, [availableUsers, teamMembers]);

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (teamData: { name: string; description: string; team_lead_id?: string }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('teams')
        .insert({
          organization_id: profile.organization_id,
          name: teamData.name,
          description: teamData.description,
          team_lead_id: null,
        })
        .select()
        .single();

      if (error) throw error;

      await syncTeamLeadMembership(data.id, teamData.team_lead_id || null);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Team created',
        description: 'The team has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async (teamData: { id: string; name: string; description: string; team_lead_id?: string }) => {
      const { data, error } = await supabase
        .from('teams')
        .update({
          name: teamData.name,
          description: teamData.description,
        })
        .eq('id', teamData.id)
        .select()
        .single();

      if (error) throw error;

      await syncTeamLeadMembership(teamData.id, teamData.team_lead_id || null);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsEditDialogOpen(false);
      setSelectedTeam(null);
      resetForm();
      toast({
        title: 'Team updated',
        description: 'The team has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await archiveRecoverableRecordDeletion('teams', teamId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({
        title: 'Team deleted',
        description: `The team can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: userId,
          role: 'member',
        });

      if (error) throw error;
    },
    onSuccess: async () => {
      setNewMemberId('');
      await queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Member added', description: 'The user has been added to the team.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (member: TeamMember) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      if (member.role === 'lead' && selectedTeam) {
        await syncTeamLeadMembership(selectedTeam.id, null);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Member removed', description: 'The user has been removed from the team.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const assignLeadMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string | null }) => {
      await syncTeamLeadMembership(teamId, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Lead updated', description: 'Team leadership has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setTeamName('');
    setTeamDescription('');
    setTeamLeadId('');
  };

  const handleAddMember = () => {
    if (!selectedTeam || !newMemberId) {
      return;
    }

    addMemberMutation.mutate({ teamId: selectedTeam.id, userId: newMemberId });
  };

  const handleCreateTeam = () => {
    if (!teamName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Team name is required',
        variant: 'destructive',
      });
      return;
    }

    createTeamMutation.mutate({
      name: teamName,
      description: teamDescription,
      team_lead_id: teamLeadId || undefined,
    });
  };

  const handleEditTeam = () => {
    if (!selectedTeam || !teamName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Team name is required',
        variant: 'destructive',
      });
      return;
    }

    updateTeamMutation.mutate({
      id: selectedTeam.id,
      name: teamName,
      description: teamDescription,
      team_lead_id: teamLeadId || undefined,
    });
  };

  const openEditDialog = (team: Team) => {
    setSelectedTeam(team);
    setTeamName(team.name);
    setTeamDescription(team.description || '');
    setTeamLeadId(team.team_lead_id || '');
    setIsEditDialogOpen(true);
  };

  const openMembersDialog = (team: Team) => {
    setSelectedTeam(team);
    setNewMemberId('');
    setIsMembersDialogOpen(true);
  };

  const handleDeleteTeam = (team: Team) => {
    if (confirmRecoverableDeletion(`team "${team.name}"`)) {
      deleteTeamMutation.mutate(team.id);
    }
  };

  if (!canManageTeams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You don't have permission to manage teams. Contact your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Management</h2>
          <p className="text-muted-foreground">
            Organize your agents into teams with dedicated team leads
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a new team and assign a team lead
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="e.g., Sales Team, Support Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">Description</Label>
                <Textarea
                  id="team-description"
                  placeholder="What does this team do?"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-lead">Team Lead (Optional)</Label>
                <Select
                  value={teamLeadId || NO_TEAM_LEAD_VALUE}
                  onValueChange={(value) => setTeamLeadId(value === NO_TEAM_LEAD_VALUE ? '' : value)}
                >
                  <SelectTrigger id="team-lead">
                    <SelectValue placeholder="Select team lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM_LEAD_VALUE}>No team lead</SelectItem>
                    {availableUsers?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teams List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Teams
          </CardTitle>
          <CardDescription>
            {teams?.length || 0} team(s) in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : teams && teams.length > 0 ? (
            <div className="space-y-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{team.name}</h3>
                      <Badge variant="secondary">
                        {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                      </Badge>
                    </div>
                    {team.description && (
                      <p className="text-sm text-muted-foreground">{team.description}</p>
                    )}
                    {team.team_lead && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Crown className="w-3 h-3" />
                        <span>
                          Lead: {team.team_lead.full_name || team.team_lead.email}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMembersDialog(team)}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Members
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(team)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTeam(team)}
                      disabled={deleteTeamMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No teams created yet</p>
              <p className="text-sm">Create your first team to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team information and leadership
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-description">Description</Label>
              <Textarea
                id="edit-team-description"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-lead">Team Lead</Label>
              <Select
                value={teamLeadId || NO_TEAM_LEAD_VALUE}
                onValueChange={(value) => setTeamLeadId(value === NO_TEAM_LEAD_VALUE ? '' : value)}
              >
                <SelectTrigger id="edit-team-lead">
                  <SelectValue placeholder="Select team lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM_LEAD_VALUE}>No team lead</SelectItem>
                  {availableUsers?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTeam} disabled={updateTeamMutation.isPending}>
              {updateTeamMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Members Dialog */}
      <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTeam?.name} - Members</DialogTitle>
            <DialogDescription>
              Manage team membership and keep the team lead aligned with actual membership.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <Label htmlFor="team-member-add">Add team member</Label>
              <p className="text-xs text-muted-foreground">Add users to the team before promoting them to lead.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={newMemberId} onValueChange={setNewMemberId}>
                <SelectTrigger id="team-member-add" className="flex-1">
                  <SelectValue placeholder="Select a user to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsersForSelectedTeam.length > 0 ? availableUsersForSelectedTeam.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  )) : (
                    <SelectItem value="__no_users__" disabled>All organization users are already members</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember} disabled={!newMemberId || addMemberMutation.isPending}>
                {addMemberMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Add Member
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[400px] pr-4">
            {membersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : teamMembers && teamMembers.length > 0 ? (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div>
                      <p className="font-medium">
                        {member.profile.full_name || member.profile.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.profile.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'lead' ? 'default' : 'secondary'}>
                        {member.role === 'lead' ? (
                          <><Crown className="w-3 h-3 mr-1" />Lead</>
                        ) : (
                          'Member'
                        )}
                      </Badge>
                      {member.role !== 'lead' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectedTeam && assignLeadMutation.mutate({ teamId: selectedTeam.id, userId: member.user_id })}
                          disabled={assignLeadMutation.isPending}
                        >
                          <Crown className="w-4 h-4 mr-1" />
                          Make Lead
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectedTeam && assignLeadMutation.mutate({ teamId: selectedTeam.id, userId: null })}
                          disabled={assignLeadMutation.isPending}
                        >
                          Remove Lead
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeMemberMutation.mutate(member)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <UserMinus className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No members in this team yet</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
