import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminSecurityMetrics {
  totalAuditLogs: number;
  failedLogins24h: number;
  successfulLogins24h: number;
  overdueSecrets: number;
  recentUserActions: number;
  totalOrganizations: number;
  totalUsers: number;
}

export interface AdminPlatformMetrics {
  openTickets: number;
  totalTeamChats: number;
  trainingSessions: number;
  totalLeads: number;
  recentTickets: Array<{ id: string; subject: string; priority: string; status: string; created_at: string }>;
}

export interface AdminAuditLog {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface AdminLoginAttempt {
  id: string;
  attempted_at: string;
  was_successful: boolean;
  email?: string;
  ip_address?: string;
}

export interface AdminSecretRotation {
  id: string;
  secret_name: string;
  last_rotated_at: string | null;
  rotation_interval_days: number;
  [key: string]: unknown;
}

export interface AdminDashboardSnapshot {
  metrics: AdminSecurityMetrics | null;
  auditLogs: AdminAuditLog[];
  loginAttempts: AdminLoginAttempt[];
  secretRotations: AdminSecretRotation[];
  platformMetrics: AdminPlatformMetrics | null;
}

export function useAdminDashboardSnapshot(enabled: boolean = true) {
  return useQuery({
    queryKey: ['admin-dashboard-snapshot'],
    enabled,
    queryFn: async (): Promise<AdminDashboardSnapshot> => {
      const { data, error } = await supabase.rpc('get_admin_dashboard_snapshot');

      if (error) throw error;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid admin dashboard payload');
      }

      const snapshot = data as {
        metrics?: AdminSecurityMetrics;
        auditLogs?: AdminAuditLog[];
        loginAttempts?: AdminLoginAttempt[];
        secretRotations?: AdminSecretRotation[];
        platformMetrics?: AdminPlatformMetrics;
      };

      return {
        metrics: snapshot.metrics || null,
        auditLogs: Array.isArray(snapshot.auditLogs) ? snapshot.auditLogs : [],
        loginAttempts: Array.isArray(snapshot.loginAttempts) ? snapshot.loginAttempts : [],
        secretRotations: Array.isArray(snapshot.secretRotations) ? snapshot.secretRotations : [],
        platformMetrics: snapshot.platformMetrics || null,
      };
    },
    staleTime: 60000,
  });
}