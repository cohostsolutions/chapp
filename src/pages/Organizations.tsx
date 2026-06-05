import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Plus, 
  Users, 
  Search,
  MoreVertical,
  Settings,
  UserPlus,
  Eye,
  Shield,
  UserCog,
  Loader2,
  Bot,
  Trash2,
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  ShoppingBag,
  BedDouble,
  UserCheck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Navigate, useNavigate } from 'react-router-dom';
import { AddOrganizationDialog } from '@/components/AddOrganizationDialog';
import { AddMemberDialog } from '@/components/AddMemberDialog';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  ai_agent_type?: 'jay' | 'may' | 'cece';
  is_archived?: boolean;
  memberCount?: number;
  primaryCount?: number; // Leads for Jay, Orders for May, Bookings for Cece
}

interface OrganizationSnapshotRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  ai_agent_type: 'jay' | 'may' | 'cece' | null;
  is_archived: boolean | null;
  member_count: number | null;
  primary_count: number | null;
}

const aiAgentLabels: Record<string, { name: string; color: string }> = {
  jay: { name: 'Jay', color: 'bg-primary/20 text-primary border-primary/30' },
  may: { name: 'May', color: 'bg-warning/20 text-warning border-warning/30' },
  cece: { name: 'Cece', color: 'bg-info/20 text-info border-info/30' },
};

export default function Organizations() {
  const { isSuperAdmin, profile, refreshProfile, setImpersonatedRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewAsDialogOpen, setViewAsDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [viewAsRole, setViewAsRole] = useState<'client_admin' | 'agent' | null>(null);
  const [switching, setSwitching] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [associatedData, setAssociatedData] = useState<{ leads: number; profiles: number; bookings: number; orders: number } | null>(null);
  const [checkingData, setCheckingData] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data: orgs, error } = await supabase.rpc('get_organizations_snapshot');

      if (error) throw error;

      setOrganizations(
        ((orgs as OrganizationSnapshotRow[] | null) || []).map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          created_at: org.created_at,
          ai_agent_type: org.ai_agent_type ?? 'jay',
          is_archived: org.is_archived ?? false,
          memberCount: org.member_count ?? 0,
          primaryCount: org.primary_count ?? 0,
        }))
      );
    } catch (error) {
      devError('Error fetching organizations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewAs = (org: Organization, role: 'client_admin' | 'agent') => {
    setSelectedOrg(org);
    setViewAsRole(role);
    setViewAsDialogOpen(true);
  };

  const confirmViewAs = async () => {
    if (!selectedOrg || !viewAsRole || !profile) return;
    
    setSwitching(true);
    try {
      // Temporarily update the user's profile to view as the selected org
      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: selectedOrg.id })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();

      // Set the impersonated role in context (persisted to localStorage AND database)
      await setImpersonatedRole(viewAsRole);

      toast({
        title: `Viewing as ${viewAsRole === 'client_admin' ? 'Client Admin' : 'Agent'}`,
        description: `Now viewing ${selectedOrg.name}. Go to Settings to switch back.`,
      });

      setViewAsDialogOpen(false);
      navigate('/dashboard');
    } catch (error) {
      devError('Error switching view:', error);
      toast({
        title: "Error",
        description: "Failed to switch organization view",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  const handleOrganizationAdded = (org: unknown) => {
    fetchOrganizations();
  };

  const handleAddMember = (org: Organization) => {
    setSelectedOrg(org);
    setMemberDialogOpen(true);
  };

  const handleDeleteOrg = async (org: Organization) => {
    setSelectedOrg(org);
    setCheckingData(true);
    setDeleteDialogOpen(true);
    
    // Check for associated data
    const [leadsResult, profilesResult, bookingsResult, ordersResult] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      supabase.from('profiles_safe').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
    ]);
    
    setAssociatedData({
      leads: leadsResult.count || 0,
      profiles: profilesResult.count || 0,
      bookings: bookingsResult.count || 0,
      orders: ordersResult.count || 0,
    });
    setCheckingData(false);
  };

  const confirmDelete = async () => {
    if (!selectedOrg) return;
    
    setDeleting(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();

      // ✅ SECURE: Use Edge Function with server-side role verification
      const { data, error } = await supabase.functions.invoke('delete-organization', {
        headers,
        body: { organizationId: selectedOrg.id }
      });

      if (error) throw error;

      toast({
        title: 'Organization deleted',
        description: `${selectedOrg.name} and all associated data have been deleted. ${data?.summary ? `Deleted: ${data.summary.leads_deleted || 0} leads, ${data.summary.bookings_deleted || 0} bookings, ${data.summary.orders_deleted || 0} orders.` : ''}`,
      });

      setDeleteDialogOpen(false);
      setSelectedOrg(null);
      fetchOrganizations();
    } catch (error: unknown) {
      devError('Error deleting organization:', error);
      const msg = error instanceof Error ? error.message : 'Failed to delete organization.';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveOrg = async (org: Organization) => {
    setArchiving(true);
    try {
      const newArchivedState = !org.is_archived;
      const { error } = await supabase
        .from('organizations')
        .update({ is_archived: newArchivedState })
        .eq('id', org.id);

      if (error) throw error;

      toast({
        title: newArchivedState ? 'Organization archived' : 'Organization restored',
        description: `${org.name} has been ${newArchivedState ? 'archived' : 'restored'} successfully.`,
      });

      fetchOrganizations();
    } catch (error: unknown) {
      devError('Error archiving organization:', error);
      const msg = error instanceof Error ? error.message : 'Failed to update organization.';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setArchiving(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchiveFilter = showArchived ? org.is_archived : !org.is_archived;
    return matchesSearch && matchesArchiveFilter;
  });

  const archivedCount = organizations.filter(org => org.is_archived).length;
  const activeCount = organizations.filter(org => !org.is_archived).length;

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground mt-1">Manage client accounts and tenants</p>
        </div>
        <Button variant="glow" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={!showArchived ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchived(false)}
                className="flex-1 sm:flex-none"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Active ({activeCount})
              </Button>
              <Button
                variant={showArchived ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchived(true)}
                className="flex-1 sm:flex-none"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archived ({archivedCount})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredOrgs.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No organizations yet</h3>
            <p className="text-muted-foreground mb-4">Create your first organization to get started</p>
            <Button variant="glow" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Organization
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrgs.map((org, index) => (
            <Card 
              key={org.id}
              className="glass hover:border-primary/50 transition-all duration-200 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{org.name}</h3>
                      <p className="text-sm text-muted-foreground">/{org.slug}</p>
                    </div>
                  </div>
                  {/* Desktop: clickable menu trigger */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Organization actions for ${org.name}`}>
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>View As</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewAs(org, 'client_admin')}>
                        <Shield className="w-4 h-4 mr-2" />
                        Client Admin View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewAs(org, 'agent')}>
                        <UserCog className="w-4 h-4 mr-2" />
                        Agent View
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/organizations/${org.id}/settings`)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddMember(org)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Member
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/asset-migration?from=${org.id}`)}>
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        Migrate Assets
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleArchiveOrg(org)}
                        disabled={archiving}
                      >
                        {org.is_archived ? (
                          <>
                            <ArchiveRestore className="w-4 h-4 mr-2" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteOrg(org)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Members</span>
                    </div>
                    <p className="text-xl font-bold mt-1 text-foreground">{org.memberCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {org.ai_agent_type === 'may' ? (
                        <ShoppingBag className="w-4 h-4" />
                      ) : org.ai_agent_type === 'cece' ? (
                        <BedDouble className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                      <span className="text-xs">
                        {org.ai_agent_type === 'may' ? 'Orders' : org.ai_agent_type === 'cece' ? 'Bookings' : 'Leads'}
                      </span>
                    </div>
                    <p className="text-xl font-bold mt-1 text-foreground">{org.primaryCount}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={aiAgentLabels[org.ai_agent_type || 'jay'].color}>
                      <Bot className="w-3 h-3 mr-1" />
                      {aiAgentLabels[org.ai_agent_type || 'jay'].name}
                    </Badge>
                    {org.is_archived ? (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
                        Archived
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Mobile action buttons - only these are clickable on mobile */}
                <div className="mt-4 flex gap-2 md:hidden">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleViewAs(org, 'client_admin')}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleAddMember(org)}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Member
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/organizations/${org.id}/settings`)}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Organization Dialog */}
      <AddOrganizationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onOrganizationAdded={handleOrganizationAdded}
      />

      {/* View As Confirmation Dialog */}
      <Dialog open={viewAsDialogOpen} onOpenChange={setViewAsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              View Organization As {viewAsRole === 'client_admin' ? 'Client Admin' : 'Agent'}
            </DialogTitle>
            <DialogDescription>
              You will be switched to view <strong>{selectedOrg?.name}</strong> as a {viewAsRole === 'client_admin' ? 'Client Admin' : 'Agent'}. 
              This will temporarily change your organization context.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-sm text-warning">
              To switch back to Super Admin view, go to Settings and select "Return to Super Admin View".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="glow" onClick={confirmViewAs} disabled={switching}>
              {switching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Confirm Switch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      {selectedOrg && (
        <AddMemberDialog
          open={memberDialogOpen}
          onOpenChange={setMemberDialogOpen}
          organizationId={selectedOrg.id}
          organizationName={selectedOrg.name}
          onMemberAdded={fetchOrganizations}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setAssociatedData(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedOrg?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {checkingData ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Checking associated data...</span>
            </div>
          ) : associatedData && (associatedData.leads > 0 || associatedData.profiles > 0 || associatedData.bookings > 0 || associatedData.orders > 0) ? (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
              <p className="text-sm font-medium text-destructive">
                Warning: This organization has associated data that will be permanently deleted:
              </p>
              <ul className="text-sm text-destructive/80 space-y-1 ml-4 list-disc">
                {associatedData.leads > 0 && <li>{associatedData.leads} lead(s)</li>}
                {associatedData.profiles > 0 && <li>{associatedData.profiles} user(s)/profile(s)</li>}
                {associatedData.bookings > 0 && <li>{associatedData.bookings} booking(s)</li>}
                {associatedData.orders > 0 && <li>{associatedData.orders} order(s)</li>}
              </ul>
              <p className="text-xs text-destructive/70 mt-2">
                Consider archiving this organization instead to preserve the data.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                No associated data found. This organization can be safely deleted.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting || checkingData}>
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
