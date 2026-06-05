/**
 * Data Retention & Privacy Utilities
 * 
 * Provides functions for GDPR compliance:
 * - Soft deletes (data archiving)
 * - Hard deletes (permanent removal for "right to be forgotten")
 * - Data anonymization
 * - Retention policy management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuditLogger } from './auditLogger';
import { getRequiredSupabaseConfig } from './env';
import { devError } from './logger';

// Initialize lazily
let supabaseRetentionInstance: SupabaseClient<any, any, any> | null = null;

function getSupabaseClient(): SupabaseClient<any, any, any> {
  if (!supabaseRetentionInstance) {
    const { url, publishableKey } = getRequiredSupabaseConfig();
    supabaseRetentionInstance = createClient<any, any, any>(
      url,
      publishableKey
    );
  }
  return supabaseRetentionInstance;
}

/**
 * Deletion request types
 */
export type DeletionReason = 
  | 'user_requested'
  | 'data_retention_expired'
  | 'gdpr_right_to_forget'
  | 'account_closure'
  | 'policy_violation'
  | 'administrative';

export interface SoftDeleteRecord {
  table_name: string;
  record_id: string;
  deleted_at: string;
  deletion_reason: DeletionReason;
}

export interface PrivacyPolicy {
  data_retention_days: number; // How long to keep inactive data
  hard_delete_after_days: number; // When to permanently remove deleted data
  anonymize_pii: boolean; // Whether to anonymize PII on soft delete
  audit_retention_months: number; // How long to keep audit logs
}

const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  data_retention_days: 365, // 1 year
  hard_delete_after_days: 90, // 90 days after soft delete
  anonymize_pii: true,
  audit_retention_months: 24 // 2 years for compliance
};

/**
 * Soft delete a lead and anonymize PII
 * Data remains in database but marked as deleted and hidden from queries
 */
export async function softDeleteLead(
  leadId: string,
  organizationId: string,
  userId: string,
  reason: DeletionReason = 'user_requested'
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    // Get current lead data before deletion
    const { data: leadData, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchError || !leadData) {
      devError('Failed to fetch lead for deletion:', fetchError);
      return false;
    }

    // Soft delete: mark as deleted and anonymize PII
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        deletion_reason: reason,
        // Anonymize personally identifiable information
        email: null,
        phone: null,
        name: null,
        company: null,
        address: null,
        city: null,
        state: null,
        postal_code: null
      })
      .eq('id', leadId)
      .eq('organization_id', organizationId);

    if (updateError) {
      devError('Failed to soft delete lead:', updateError);
      return false;
    }

    // Log the deletion for compliance
    await AuditLogger.logDataDeletion(
      userId,
      organizationId,
      'leads',
      leadId,
      {
        email: leadData.email,
        name: leadData.name,
        phone: leadData.phone,
        company: leadData.company
      },
      reason
    );

    return true;
  } catch (err) {
    devError('Error in softDeleteLead:', err);
    return false;
  }
}

/**
 * Soft delete multiple records at once
 */
export async function softDeleteRecords(
  tableName: string,
  recordIds: string[],
  organizationId: string,
  userId: string,
  reason: DeletionReason = 'user_requested'
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Map table names to PII fields
  const piiFields: Record<string, string[]> = {
    leads: ['email', 'phone', 'name', 'company', 'address'],
    conversations: ['user_message', 'participant_email'],
    contacts: ['email', 'phone', 'name', 'address']
  };

  try {
    const supabase = getSupabaseClient();
    const fieldsToNull = piiFields[tableName] || [];
    const updateData: Record<string, any> = {
      deleted_at: new Date().toISOString(),
      deletion_reason: reason
    };

    // Set PII fields to null
    fieldsToNull.forEach(field => {
      updateData[field] = null;
    });

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('organization_id', organizationId)
      .in('id', recordIds);

    if (error) {
      devError(`Failed to soft delete from ${tableName}:`, error);
      failed = recordIds.length;
      return { success, failed };
    }

    success = recordIds.length;

    // Log bulk deletion
    await AuditLogger.logBulkImport(
      userId,
      organizationId,
      tableName,
      recordIds.length,
      `Soft deleted ${recordIds.length} ${tableName} records`
    );

    return { success, failed };
  } catch (err) {
    devError('Error in softDeleteRecords:', err);
    return { success, failed: recordIds.length };
  }
}

/**
 * Hard delete a record (permanent removal)
 * Requires admin approval and is fully audited
 */
export async function hardDeleteRecord(
  tableName: string,
  recordId: string,
  organizationId: string,
  userId: string,
  adminApprovalId: string,
  reason: string = 'gdpr_right_to_forget'
): Promise<boolean> {
  try {
    // Get record data before deletion for audit log
    const supabase = getSupabaseClient();
    const { data: record, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .single();

    if (fetchError) {
      devError(`Failed to fetch record from ${tableName}:`, fetchError);
      return false;
    }

    // Delete the record
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', recordId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      devError(`Failed to hard delete from ${tableName}:`, deleteError);
      return false;
    }

    // Log hard delete with approval reference
    await AuditLogger.logHardDelete(
      userId,
      organizationId,
      tableName,
      1,
      `${reason} (Approved by: ${adminApprovalId})`,
      [recordId]
    );

    return true;
  } catch (err) {
    devError('Error in hardDeleteRecord:', err);
    return false;
  }
}

/**
 * Anonymize a user's data (for GDPR right to be forgotten)
 * Creates hashed versions of identifying data
 */
export async function anonymizeUserData(
  userId: string,
  organizationId: string,
  approverUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = getSupabaseClient();
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { success: false, message: 'User not found' };
    }

    // Anonymize fields
    const anonymizedData = {
      email: `deleted-${Date.now()}@anonymized.local`,
      first_name: 'Anonymized',
      last_name: 'User',
      phone: null,
      address: null,
      city: null,
      postal_code: null
    };

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(anonymizedData)
      .eq('id', userId);

    if (updateError) {
      return { success: false, message: 'Failed to anonymize profile' };
    }

    // Soft delete all user's data
    const tables = ['leads', 'conversations', 'contacts', 'notes'];

    for (const table of tables) {
      await softDeleteRecords(
        table,
        [userId], // This assumes these tables have a user_id field
        organizationId,
        approverUserId,
        'gdpr_right_to_forget'
      );
    }

    // Log anonymization
    await AuditLogger.logDataDeletion(
      approverUserId,
      organizationId,
      'profiles',
      userId,
      { email: profile.email, first_name: profile.first_name },
      'data_anonymize'
    );

    return { success: true, message: 'User data anonymized successfully' };
  } catch (err) {
    devError('Error in anonymizeUserData:', err);
    return { success: false, message: 'Anonymization failed' };
  }
}

/**
 * Get records eligible for hard deletion (soft deleted > X days ago)
 */
export async function getHardDeleteCandidates(
  tableName: string,
  organizationId: string,
  daysOld: number = 90
): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .eq('organization_id', organizationId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate.toISOString());

    if (error) {
      devError(`Failed to get hard delete candidates from ${tableName}:`, error);
      return [];
    }

    return (data || []).map(record => record.id);
  } catch (err) {
    devError('Error in getHardDeleteCandidates:', err);
    return [];
  }
}

/**
 * Hard delete records that meet retention policy
 * Should be run as scheduled job
 */
export async function enforceRetentionPolicy(
  organizationId: string,
  adminUserId: string,
  policy: PrivacyPolicy = DEFAULT_PRIVACY_POLICY
): Promise<{ deleted: number; error: number }> {
  let deleted = 0;
  let error = 0;

  const tables = ['leads', 'conversations', 'contacts', 'notes'];

  for (const table of tables) {
    const candidates = await getHardDeleteCandidates(
      table,
      organizationId,
      policy.hard_delete_after_days
    );

    for (const recordId of candidates) {
      const success = await hardDeleteRecord(
        table,
        recordId,
        organizationId,
        adminUserId,
        adminUserId,
        `Automatic hard delete per retention policy (${policy.hard_delete_after_days} days)`
      );

      if (success) {
        deleted++;
      } else {
        error++;
      }
    }
  }

  return { deleted, error };
}

/**
 * Export all user data (GDPR Data Portability)
 * Returns a JSON structure with all user data
 */
export async function exportUserData(
  userId: string,
  organizationId: string
): Promise<Record<string, any> | null> {
  try {
    const supabase = getSupabaseClient();
    const userDataExport: Record<string, any> = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      organization_id: organizationId,
      data: {}
    };

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Get leads
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('created_by', userId)
      .eq('organization_id', organizationId);

    // Get conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    // Assemble export
    userDataExport.data = {
      profile,
      leads: leads || [],
      conversations: conversations || []
    };

    // Log the export
    await AuditLogger.logDataExport(
      userId,
      organizationId,
      'user_data_export',
      1,
      `GDPR data portability export for user ${userId}`
    );

    return userDataExport;
  } catch (err) {
    devError('Error in exportUserData:', err);
    return null;
  }
}

/**
 * Get data retention policy for organization
 */
export function getDefaultRetentionPolicy(): PrivacyPolicy {
  return DEFAULT_PRIVACY_POLICY;
}

/**
 * Calculate when a soft-deleted record will be hard deleted
 */
export function getHardDeleteDate(
  softDeletedAt: string,
  policy: PrivacyPolicy = DEFAULT_PRIVACY_POLICY
): Date {
  const date = new Date(softDeletedAt);
  date.setDate(date.getDate() + policy.hard_delete_after_days);
  return date;
}
