import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devWarn } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import type { PermissionSet, UserPermission, AppRole } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// NOTE: The permission_sets and user_permissions tables do not exist yet.
// This implementation uses role-based permissions from the existing user_roles table.

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

// Default permissions by role (includes viewer role for read-only access)
export const DEFAULT_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete'] },
  ],
  client_admin: [
    { resource: 'leads', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'orders', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'agents', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'workflows', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'documents', actions: ['create', 'read', 'update', 'delete'] },
  ],
  agent: [
    { resource: 'leads', actions: ['read', 'update'] },
    { resource: 'orders', actions: ['create', 'read', 'update'] },
    { resource: 'conversations', actions: ['create', 'read', 'update'] },
    { resource: 'documents', actions: ['read'] },
  ],
  viewer: [
    { resource: 'leads', actions: ['read'] },
    { resource: 'orders', actions: ['read'] },
    { resource: 'bookings', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'documents', actions: ['read'] },
    { resource: 'conversations', actions: ['read'] },
  ],
};

export function usePermissionSets(organizationId: string) {
  return useQuery({
    queryKey: ['permission-sets', organizationId],
    queryFn: async () => {
      // Permission sets table not yet implemented
      devWarn('permission_sets table not yet implemented');
      return [] as PermissionSet[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      // User permissions table not yet implemented - use role-based permissions
      devWarn('user_permissions table not yet implemented');
      return [] as UserPermission[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePermissionSet(organizationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (permissionSet: Partial<PermissionSet>) => {
      // Permission sets table not yet implemented
      devWarn('permission_sets table not yet implemented');
      throw new Error('Custom permission sets feature coming soon');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-sets', organizationId] });
      toast({
        title: 'Permission set created',
        description: 'New permission set has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create permission set',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAssignPermission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (permission: Partial<UserPermission>) => {
      // User permissions table not yet implemented
      devWarn('user_permissions table not yet implemented');
      throw new Error('Custom permissions feature coming soon');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({
        title: 'Permission assigned',
        description: 'User permissions have been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to assign permission',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Helper function to check if user has permission
export function hasPermission(
  userRole: AppRole,
  userPermissions: UserPermission[],
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete'
): boolean {
  // Super admin has all permissions
  if (userRole === 'super_admin') return true;

  // Check default role permissions
  const defaultPerms = DEFAULT_PERMISSIONS[userRole] || [];
  const hasDefault = defaultPerms.some(
    (p) => (p.resource === resource || p.resource === '*') && p.actions.includes(action)
  );

  if (hasDefault) return true;

  // Check custom assigned permissions (when implemented)
  const customPerms = userPermissions
    .filter((up) => up.resource_type === resource)
    .map((up) => (up.permission_set_id as unknown as PermissionSet)?.permissions || {});

  return customPerms.some((perms: Record<string, string[]>) => 
    perms[resource]?.includes(action)
  );
}

// Hook to use permission checking
export function useHasPermission() {
  const { data: profile } = useQuery({
    queryKey: ['current-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const { data: permissions = [] } = useUserPermissions(profile?.id || '');

  return (resource: string, action: 'create' | 'read' | 'update' | 'delete') => {
    if (!profile || !userRoles?.length) return false;
    const role = userRoles[0]?.role as AppRole;
    return hasPermission(role, permissions, resource, action);
  };
}
