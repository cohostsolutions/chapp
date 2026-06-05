import { useCallback } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for logging access to sensitive lead contact information.
 * Tracks when users view lead email/phone for security audit purposes.
 */
export function useContactAccessLogging() {
  const { user } = useAuth();

  const logContactAccess = useCallback(async (leadId: string, leadName: string) => {
    if (!user?.id) return;

    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'view_contact_info',
        resource_type: 'lead',
        resource_id: leadId,
        details: {
          lead_name: leadName,
          accessed_fields: ['email', 'phone'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Silent fail - don't block UI for audit logging failures
      devError('Failed to log contact access:', error);
    }
  }, [user?.id]);

  return { logContactAccess };
}
