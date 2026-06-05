import { useState, useEffect, useMemo } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Users as UsersIcon,
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  User,
  Loader2,
  Mail,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  Building2,
  Clock,
  UserPlus,
  Filter,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { UserListSkeleton } from '@/components/shared/skeletons';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

type AppRole = 'super_admin' | 'client_admin' | 'agent' | 'viewer';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  organization_name?: string;
  roles: AppRole[];
  created_at: string;
  is_active: boolean;
}

interface Organization {
  id: string;
  name: string;
}

const roleConfig: Record<AppRole, { label: string; shortLabel: string; icon: typeof Shield; color: string }> = {
  super_admin: { label: 'Super Admin', shortLabel: 'Super', icon: ShieldCheck, color: 'bg-destructive/20 text-destructive border-destructive/30' },
  client_admin: { label: 'Client Admin', shortLabel: 'Admin', icon: Shield, color: 'bg-primary/20 text-primary border-primary/30' },
  agent: { label: 'Agent', shortLabel: 'Agent', icon: User, color: 'bg-secondary text-foreground border-border' },
  viewer: { label: 'Viewer', shortLabel: 'Viewer', icon: User, color: 'bg-muted text-muted-foreground border-border' },
};

type DialogMode = 'create' | 'edit' | 'password' | 'delete' | null;
type StatusFilter = 'all' | 'active' | 'inactive';
type RoleFilter = 'all' | AppRole;

export function UserManagementTab() {
  const { profile, user, effectiveIsSuperAdmin, effectiveIsClientAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<AppRole>('agent');
  const [formOrgId, setFormOrgId] = useState<string>('');
  
  const { toast } = useToast();

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.is_active).length;
    const inactive = total - active;
    const superAdmins = users.filter(u => u.roles.includes('super_admin')).length;
    const clientAdmins = users.filter(u => u.roles.includes('client_admin')).length;
    const agents = users.filter(u => u.roles.includes('agent') || u.roles.length === 0).length;
    const noOrg = users.filter(u => !u.organization_id && !u.roles.includes('super_admin')).length;
    
    return { total, active, inactive, superAdmins, clientAdmins, agents, noOrg };
  }, [users]);

  useEffect(() => {
    fetchUsers();
    if (effectiveIsSuperAdmin) {
      fetchOrganizations();
    }
  }, [effectiveIsSuperAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let profilesQuery = supabase.from('profiles_safe').select('*');
      
      if (effectiveIsClientAdmin && !effectiveIsSuperAdmin && profile?.organization_id) {
        profilesQuery = profilesQuery.eq('organization_id', profile.organization_id);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      const { data: orgs } = await supabase.from('organizations').select('id, name');
      const orgMap = new Map(orgs?.map(o => [o.id, o.name]) || []);

      const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        organization_id: p.organization_id,
        organization_name: p.organization_id ? orgMap.get(p.organization_id) : undefined,
        roles: (roles || []).filter(r => r.user_id === p.id).map(r => r.role as AppRole),
        created_at: p.created_at,
        is_active: p.is_active ?? true,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      devError('Error fetching users:', error);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase.from('organizations').select('id, name');
    if (!error && data) setOrganizations(data);
  };

  const openCreateDialog = () => {
    setSelectedUser(null);
    setFormEmail('');
    setFormPassword('');
    setFormFullName('');
    setFormRole('agent');
    setFormOrgId('');
    setDialogMode('create');
  };

  const openEditDialog = (userToEdit: UserWithRole) => {
    setSelectedUser(userToEdit);
    setFormFullName(userToEdit.full_name || '');
    setFormRole(userToEdit.roles[0] || 'agent');
    setFormOrgId(userToEdit.organization_id || '');
    setDialogMode('edit');
  };

  const openPasswordDialog = (userToEdit: UserWithRole) => {
    setSelectedUser(userToEdit);
    setFormPassword('');
    setDialogMode('password');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedUser(null);
    setFormEmail('');
    setFormPassword('');
    setFormFullName('');
    setFormRole('agent');
    setFormOrgId('');
  };

  const handleCreate = async () => {
    if (!formEmail || !formPassword || !formRole) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();

      const response = await supabase.functions.invoke('manage-user', {
        headers,
        body: {
          action: 'create',
          email: formEmail,
          password: formPassword,
          fullName: formFullName,
          role: formRole,
          organizationId: formOrgId || (effectiveIsClientAdmin ? profile?.organization_id : null),
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({ title: 'User created', description: `Successfully created user ${formEmail}` });
      closeDialog();
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create user', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const normalizedFullName = formFullName.trim();
      const normalizedOrganizationId = !effectiveIsSuperAdmin
        ? undefined
        : formRole === 'super_admin'
          ? null
          : formOrgId || null;

      const response = await supabase.functions.invoke('manage-user', {
        headers,
        body: {
          action: 'update',
          userId: selectedUser.id,
          fullName: normalizedFullName,
          role: formRole,
          organizationId: normalizedOrganizationId,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({ title: 'User updated', description: 'User details have been updated' });
      closeDialog();
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update user', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !formPassword) {
      toast({ title: 'Missing password', description: 'Please enter a new password', variant: 'destructive' });
      return;
    }

    if (formPassword.length < 8) {
      toast({ title: 'Invalid password', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();

      const response = await supabase.functions.invoke('manage-user', {
        headers,
        body: {
          action: 'reset_password',
          userId: selectedUser.id,
          newPassword: formPassword,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({ title: 'Password reset', description: 'Password has been updated successfully' });
      closeDialog();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to reset password', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleActive = async (userToToggle: UserWithRole) => {
    const newStatus = !userToToggle.is_active;
    
    try {
      const headers = await getSupabaseFunctionAuthHeaders();

      const response = await supabase.functions.invoke('manage-user', {
        headers,
        body: {
          action: 'toggle_active',
          userId: userToToggle.id,
          isActive: newStatus,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({ 
        title: newStatus ? 'User activated' : 'User deactivated', 
        description: `${userToToggle.email} has been ${newStatus ? 'activated' : 'deactivated'}` 
      });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update user status', variant: 'destructive' });
    }
  };

  const openDeleteDialog = (userToDelete: UserWithRole) => {
    setSelectedUser(userToDelete);
    setDialogMode('delete');
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();

      const response = await supabase.functions.invoke('manage-user', {
        headers,
        body: {
          action: 'delete',
          userId: selectedUser.id,
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({ 
        title: 'User deleted', 
        description: `${selectedUser.email} has been permanently deleted` 
      });
      closeDialog();
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete user', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrg = orgFilter === 'all' || u.organization_id === orgFilter;
      const matchesRole = roleFilter === 'all' || u.roles.includes(roleFilter);
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && u.is_active) || 
        (statusFilter === 'inactive' && !u.is_active);
      return matchesSearch && matchesOrg && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, orgFilter, roleFilter, statusFilter]);

  const availableRoles: AppRole[] = effectiveIsSuperAdmin 
    ? ['super_admin', 'client_admin', 'agent']
    : ['agent'];

  const hasActiveFilters = searchTerm || orgFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setOrgFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <UsersIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">User Management</h2>
              <p className="text-sm text-muted-foreground hidden sm:block">
                {effectiveIsSuperAdmin ? 'Manage all CRM users and their roles' : 'Manage users in your organization'}
              </p>
            </div>
          </div>
          <Button variant="glow" onClick={openCreateDialog} className="w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="glass">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-xl sm:text-2xl font-bold text-success">{stats.active}</p>
                </div>
                <div className="p-2 rounded-lg bg-success/10">
                  <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                  <p className="text-xl sm:text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          {effectiveIsSuperAdmin && stats.noOrg > 0 ? (
            <Card className="glass border-warning/30">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">No Org</p>
                    <p className="text-xl sm:text-2xl font-bold text-warning">{stats.noOrg}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warning/10">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Admins</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">{stats.superAdmins + stats.clientAdmins}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="glass">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                  <SelectTrigger className="w-[130px]">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="client_admin">Client Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {effectiveIsSuperAdmin && (
                  <Select value={orgFilter} onValueChange={setOrgFilter}>
                    <SelectTrigger className="w-[160px]">
                      <Building2 className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="All Orgs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Showing {filteredUsers.length} of {users.length} users
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <SectionErrorBoundary name="Users List">
        {loading ? (
          <UserListSkeleton count={5} />
        ) : filteredUsers.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-8 sm:p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              {hasActiveFilters ? (
                <>
                  <h3 className="font-semibold text-foreground mb-1">No users match your filters</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-foreground mb-1">No users yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first user to get started
                  </p>
                  <Button variant="glow" onClick={openCreateDialog}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredUsers.map((u, index) => {
              const primaryRole = u.roles[0] || 'agent';
              const config = roleConfig[primaryRole];
              const Icon = config.icon;
              const isCurrentUser = u.id === user?.id;
              
              return (
                <Card 
                  key={u.id} 
                  className={cn(
                    "glass hover:border-primary/50 transition-all duration-200 animate-slide-up",
                    !u.is_active && "opacity-60 border-muted"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <CardContent className="p-3 sm:p-4">
                    {/* Mobile Layout */}
                    <div className="flex flex-col gap-3 sm:hidden">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                            u.is_active ? 'bg-gradient-primary' : 'bg-muted'
                          )}>
                            <Icon className={cn(
                              "w-4 h-4",
                              u.is_active ? 'text-primary-foreground' : 'text-muted-foreground'
                            )} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-semibold text-foreground text-sm truncate max-w-[120px]">
                                {u.full_name || 'Unnamed'}
                              </h3>
                              {isCurrentUser && (
                                <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-[10px] px-1 py-0">
                                  You
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className={cn(config.color, "text-[10px] px-1.5 py-0 mt-0.5")}>
                              {config.shortLabel}
                            </Badge>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(u)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPasswordDialog(u)}>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isCurrentUser && (
                              <DropdownMenuItem 
                                onClick={() => handleToggleActive(u)}
                                className={u.is_active ? 'text-warning' : 'text-success'}
                              >
                                {u.is_active ? (
                                  <><UserX className="w-4 h-4 mr-2" />Deactivate</>
                                ) : (
                                  <><UserCheck className="w-4 h-4 mr-2" />Activate</>
                                )}
                              </DropdownMenuItem>
                            )}
                            {!isCurrentUser && (
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(u)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground pl-12">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {u.organization_name && (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              <span className="truncate max-w-[100px]">{u.organization_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{getRelativeTime(u.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      {!u.is_active && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground self-start ml-12 text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          u.is_active ? 'bg-gradient-primary' : 'bg-muted'
                        )}>
                          <Icon className={cn(
                            "w-5 h-5",
                            u.is_active ? 'text-primary-foreground' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">
                              {u.full_name || 'Unnamed User'}
                            </h3>
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                            {!u.is_active && (
                              <Badge variant="outline" className="bg-muted text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                            {isCurrentUser && (
                              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3" />
                              <span>{u.email}</span>
                            </div>
                            {u.organization_name && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3 h-3" />
                                <span>{u.organization_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>Joined {getRelativeTime(u.created_at)}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(u)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPasswordDialog(u)}>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isCurrentUser && (
                              <DropdownMenuItem 
                                onClick={() => handleToggleActive(u)}
                                className={u.is_active ? 'text-warning' : 'text-success'}
                              >
                                {u.is_active ? (
                                  <><UserX className="w-4 h-4 mr-2" />Deactivate</>
                                ) : (
                                  <><UserCheck className="w-4 h-4 mr-2" />Activate</>
                                )}
                              </DropdownMenuItem>
                            )}
                            {!isCurrentUser && (
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(u)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SectionErrorBoundary>

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogMode === 'create' || dialogMode === 'edit'} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                {dialogMode === 'create' ? (
                  <UserPlus className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <Pencil className="w-4 h-4 text-primary-foreground" />
                )}
              </div>
              <div>
                <DialogTitle>{dialogMode === 'create' ? 'Add New User' : 'Edit User'}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {dialogMode === 'create' 
                    ? 'Create a new user account'
                    : `Editing ${selectedUser?.full_name || selectedUser?.email}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {dialogMode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>
            )}
            {dialogMode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => {
                    const RoleIcon = roleConfig[role].icon;
                    return (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <RoleIcon className="w-3 h-3" />
                          {roleConfig[role].label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {effectiveIsSuperAdmin && (formRole === 'client_admin' || formRole === 'agent') && (
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Select value={formOrgId || '__none__'} onValueChange={(v) => setFormOrgId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <Building2 className="w-3 h-3 mr-2" />
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No organization</SelectItem>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeDialog} className="w-full sm:w-auto">Cancel</Button>
            <Button 
              variant="glow" 
              onClick={dialogMode === 'create' ? handleCreate : handleUpdate} 
              disabled={processing}
              className="w-full sm:w-auto"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialogMode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={dialogMode === 'password'} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20">
                <KeyRound className="w-4 h-4 text-warning" />
              </div>
              <div>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {selectedUser?.full_name || selectedUser?.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">Password must be at least 8 characters</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeDialog} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="glow" onClick={handleResetPassword} disabled={processing} className="w-full sm:w-auto">
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-destructive">Delete User</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  This action cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-foreground">
              Are you sure you want to permanently delete <span className="font-semibold">{selectedUser?.full_name || selectedUser?.email}</span>?
            </p>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                This will permanently remove the user and all associated data. Consider deactivating the user instead if you may need to restore access later.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeDialog} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={processing} className="w-full sm:w-auto">
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
