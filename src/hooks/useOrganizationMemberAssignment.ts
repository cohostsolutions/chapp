import { useCallback, useState } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export interface AvailableOrganizationUser {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
}

export const MEMBER_ROLE_OPTIONS = [
  { value: 'client_admin', label: 'Client Admin', description: 'Full access to organization' },
  { value: 'agent', label: 'Agent', description: 'Can manage leads and conversations' },
] as const;

export const AGENT_SUB_ROLE_OPTIONS = ['Sales', 'Technicians', 'Others'] as const;

type MemberRole = (typeof MEMBER_ROLE_OPTIONS)[number]['value'];

interface AssignOrganizationMemberInput {
  organizationId: string;
  userId: string;
  role: MemberRole;
  subRole?: string | null;
}

export function useOrganizationMemberAssignment() {
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAssigningMember, setIsAssigningMember] = useState(false);

  const fetchAvailableUsers = useCallback(async (): Promise<AvailableOrganizationUser[]> => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles_safe')
        .select('id, email, full_name, organization_id')
        .is('organization_id', null)
        .order('email');

      if (error) throw error;
      return (data || []) as AvailableOrganizationUser[];
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const assignMemberToOrganization = useCallback(async ({
    organizationId,
    userId,
    role,
    subRole,
  }: AssignOrganizationMemberInput) => {
    setIsAssigningMember(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: organizationId })
        .eq('id', userId);

      if (profileError) throw profileError;

      const userRoleData: {
        user_id: string;
        role: MemberRole;
        sub_role?: string | null;
      } = {
        user_id: userId,
        role,
      };

      if (subRole) {
        userRoleData.sub_role = subRole;
      }

      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert(userRoleData, {
          onConflict: 'user_id,role',
          ignoreDuplicates: false,
        });

      if (roleError) {
        const { error: rollbackError } = await supabase
          .from('profiles')
          .update({ organization_id: null })
          .eq('id', userId);

        if (rollbackError) {
          devError('Failed to roll back organization member assignment:', rollbackError);
        }

        throw roleError;
      }
    } finally {
      setIsAssigningMember(false);
    }
  }, []);

  return {
    isLoadingUsers,
    isAssigningMember,
    fetchAvailableUsers,
    assignMemberToOrganization,
  };
}