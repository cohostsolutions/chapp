/**
 * Audit Logging Utilities
 * 
 * Provides centralized audit logging for compliance and security auditing.
 * All sensitive operations should be logged:
 * - User role changes
 * - Data deletions and exports
 * - Organization settings changes
 * - Administrative actions
 * - Failed authentication attempts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRequiredSupabaseConfig } from './env';
import { logError } from './logger';

// Initialize lazily to avoid errors in test environments
let supabaseAuditInstance: SupabaseClient<any, any, any> | null = null;

function getSupabaseClient(): SupabaseClient<any, any, any> {
  if (!supabaseAuditInstance) {
    const { url, publishableKey } = getRequiredSupabaseConfig();
    supabaseAuditInstance = createClient<any, any, any>(
      url,
      publishableKey
    );
  }
  return supabaseAuditInstance;
}

/**
 * Audit log entry types with strict action validation
 */
export type AuditAction =
  | 'role_change'
  | 'data_delete'
  | 'data_export'
  | 'settings_update'
  | 'user_invite'
  | 'user_revoke'
  | 'organization_create'
  | 'organization_update'
  | 'password_reset'
  | 'mfa_enable'
  | 'mfa_disable'
  | 'api_key_create'
  | 'api_key_revoke'
  | 'data_hard_delete'
  | 'data_anonymize'
  | 'bulk_import';

export interface AuditLog {
  id?: string;
  user_id: string;
  organization_id: string;
  action: AuditAction;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  description?: string;
  created_at?: string;
}

export interface AuditLogQueryResult {
  id: string;
  user_id: string;
  user_email: string;
  action: AuditAction;
  table_name?: string;
  description: string;
  created_at: string;
  total_count: number;
}

/**
 * Central audit logger for all system operations
 * 
 * Example:
 * ```typescript
 * await auditLogger.logRoleChange(userId, orgId, 'user@example.com', 'user', 'admin');
 * await auditLogger.logDataExport(userId, orgId, 'leads', 150, 'CSV export of active leads');
 * ```
 */
export class AuditLogger {
  /**
   * Log a user role change
   */
  static async logRoleChange(
    userId: string,
    organizationId: string,
    userEmail: string,
    oldRole: string,
    newRole: string
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc('log_role_change', {
        p_user_id: userId,
        p_organization_id: organizationId
      });

      if (error) {
        logError(error, 'Failed to log role change');
        return null;
      }

      return {
        user_id: userId,
        organization_id: organizationId,
        action: 'role_change',
        table_name: 'profiles',
        record_id: userId,
        old_values: { role: oldRole, email: userEmail },
        new_values: { role: newRole, email: userEmail },
        description: `User ${userEmail} role changed from ${oldRole} to ${newRole}`
      };
    } catch (err) {
      logError(err, 'Error in logRoleChange');
      return null;
    }
  }

  /**
   * Log a data export operation
   */
  static async logDataExport(
    userId: string,
    organizationId: string,
    tableName: string,
    recordCount: number,
    description?: string
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      await supabase.rpc('log_data_export', {
        p_user_id: userId,
        p_organization_id: organizationId,
        p_table_name: tableName,
        p_record_count: recordCount,
        p_description: description
      });

      return {
        user_id: userId,
        organization_id: organizationId,
        action: 'data_export',
        table_name: tableName,
        new_values: { record_count: recordCount, export_type: 'csv' },
        description: description || `Exported ${recordCount} records from ${tableName} table`
      };
    } catch (err) {
      logError(err, 'Error in logDataExport');
      return null;
    }
  }

  /**
   * Log a data deletion (soft delete)
   */
  static async logDataDeletion(
    userId: string,
    organizationId: string,
    tableName: string,
    recordId: string,
    oldValues: Record<string, any>,
    reason: string = 'user_requested'
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      await supabase.rpc('log_data_deletion', {
        p_user_id: userId,
        p_organization_id: organizationId,
        p_table_name: tableName,
        p_record_id: recordId,
        p_old_values: oldValues,
        p_reason: reason
      });

      return {
        user_id: userId,
        organization_id: organizationId,
        action: 'data_delete',
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues,
        new_values: { deleted_at: new Date().toISOString(), reason },
        description: `Record ${recordId} soft-deleted from ${tableName} table (${reason})`
      };
    } catch (err) {
      logError(err, 'Error in logDataDeletion');
      return null;
    }
  }

  /**
   * Log a settings update
   */
  static async logSettingsUpdate(
    userId: string,
    organizationId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    description?: string
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      await supabase.rpc('log_settings_update', {
        p_user_id: userId,
        p_organization_id: organizationId,
        p_old_values: oldValues,
        p_new_values: newValues,
        p_description: description
      });

      return {
        user_id: userId,
        organization_id: organizationId,
        action: 'settings_update',
        table_name: 'organizations',
        old_values: oldValues,
        new_values: newValues,
        description: description || 'Organization settings updated'
      };
    } catch (err) {
      logError(err, 'Error in logSettingsUpdate');
      return null;
    }
  }

  /**
   * Log a hard delete operation (remove data permanently)
   */
  static async logHardDelete(
    userId: string,
    organizationId: string,
    tableName: string,
    recordCount: number,
    reason: string,
    affectedRecords?: string[]
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        organization_id: organizationId,
        action: 'data_hard_delete',
        table_name: tableName,
        new_values: {
          record_count: recordCount,
          reason,
          affected_records: affectedRecords
        },
        description: `Hard deleted ${recordCount} records from ${tableName} table (${reason})`
      });

      if (error) {
        logError(error, 'Failed to log hard delete');
        return null;
      }

      return {
        user_id: userId,
        organization_id: organizationId,
        action: 'data_hard_delete',
        table_name: tableName,
        new_values: {
          record_count: recordCount,
          reason,
          affected_records: affectedRecords
        }
      };
    } catch (err) {
      logError(err, 'Error in logHardDelete');
      return null;
    }
  }

  /**
   * Log a bulk import operation
   */
  static async logBulkImport(
    userId: string,
    organizationId: string,
    tableName: string,
    recordCount: number,
    source: string
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        organization_id: organizationId,
        action: 'bulk_import',
        table_name: tableName,
        new_values: { record_count: recordCount, source },
        description: `Bulk imported ${recordCount} records from ${source} into ${tableName} table`
      });

      if (error) {
        logError(error, 'Failed to log bulk import');
        return null;
      }

      return {
        user_id: userId,
        organization_id: organizationId,
        action: 'bulk_import',
        table_name: tableName,
        new_values: { record_count: recordCount, source }
      };
    } catch (err) {
      logError(err, 'Error in logBulkImport');
      return null;
    }
  }

  /**
   * Log MFA enable/disable
   */
  static async logMFAToggle(
    userId: string,
    organizationId: string,
    enabled: boolean
  ): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseClient();
      const action = enabled ? 'mfa_enable' : 'mfa_disable';
      const { data, error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        organization_id: organizationId,
        action,
        table_name: 'profiles',
        record_id: userId,
        new_values: { mfa_enabled: enabled },
        description: `Multi-factor authentication ${enabled ? 'enabled' : 'disabled'}`
      });

      if (error) {
        logError(error, `Failed to log MFA ${action}`);
        return null;
      }

      return {
        user_id: userId,
        organization_id: organizationId,
        action: action as AuditAction,
        table_name: 'profiles'
      };
    } catch (err) {
      logError(err, 'Error in logMFAToggle');
      return null;
    }
  }
}

/**
 * Retrieve audit logs with pagination and filtering
 */
export async function getAuditLogs(
  organizationId: string,
  action?: AuditAction,
  limit: number = 50,
  offset: number = 0
): Promise<AuditLogQueryResult[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_audit_logs', {
      p_organization_id: organizationId,
      p_action: action,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      logError(error, 'Failed to retrieve audit logs');
      return [];
    }

    return data || [];
  } catch (err) {
    logError(err, 'Error in getAuditLogs');
    return [];
  }
}

/**
 * Export audit logs to CSV for compliance reporting
 */
export async function exportAuditLogs(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logError(error, 'Failed to export audit logs');
      return null;
    }

    // Convert to CSV
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row)
        .map(val => {
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(',')
    );

    return [headers, ...rows].join('\n');
  } catch (err) {
    logError(err, 'Error in exportAuditLogs');
    return null;
  }
}

/**
 * Get audit log summary statistics
 */
export async function getAuditSummary(
  organizationId: string,
  days: number = 30
): Promise<Record<string, number> | null> {
  try {
    const supabase = getSupabaseClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('audit_logs')
      .select('action')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      logError(error, 'Failed to get audit summary');
      return null;
    }

    // Count by action
    const summary: Record<string, number> = {};
    data?.forEach(log => {
      summary[log.action] = (summary[log.action] || 0) + 1;
    });

    return summary;
  } catch (err) {
    logError(err, 'Error in getAuditSummary');
    return null;
  }
}
