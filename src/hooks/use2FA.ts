import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devError } from '@/lib/logger';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';

interface Setup2FAResponse {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl?: string;
  backupCodes: string[];
}

interface Status2FAResponse {
  enabled: boolean;
  verified_at: string | null;
}

export function use2FA() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const get2FAStatus = useCallback(async (): Promise<Status2FAResponse | null> => {
    setIsLoading(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-2fa', {
        headers,
        body: { action: 'status' }
      });
      
      if (error) throw error;
      return data as Status2FAResponse;
    } catch (err: unknown) {
      devError('Error getting 2FA status:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setup2FA = useCallback(async (): Promise<Setup2FAResponse | null> => {
    setIsLoading(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-2fa', {
        headers,
        body: { action: 'setup' }
      });
      
      if (error) throw error;
      return data as Setup2FAResponse;
    } catch (err: unknown) {
      toast({
        title: 'Setup failed',
        description: err instanceof Error ? err.message : 'Failed to set up 2FA',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const verifySetup = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-2fa', {
        headers,
        body: { action: 'verify-setup', code }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: '2FA Enabled',
          description: 'Two-factor authentication is now active on your account.'
        });
        return true;
      }
      return false;
    } catch (err: unknown) {
      toast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Invalid verification code',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const verify2FA = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-2fa', {
        headers,
        body: { action: 'verify', code }
      });
      
      if (error) throw error;
      return data?.valid || false;
    } catch (err: unknown) {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disable2FA = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-2fa', {
        headers,
        body: { action: 'disable', code }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: '2FA Disabled',
          description: 'Two-factor authentication has been disabled.'
        });
        return true;
      }
      return false;
    } catch (err: unknown) {
      toast({
        title: 'Failed to disable 2FA',
        description: err instanceof Error ? err.message : 'Invalid code',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const regenerateBackupCodes = useCallback(async (code: string): Promise<string[] | null> => {
    setIsLoading(true);
    try {
      const headers = await getSupabaseFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke('manage-2fa', {
        headers,
        body: { action: 'regenerate-backup-codes', code }
      });
      
      if (error) throw error;
      
      if (data?.backupCodes) {
        toast({
          title: 'Backup codes regenerated',
          description: 'Make sure to save your new backup codes.'
        });
        return data.backupCodes;
      }
      return null;
    } catch (err: unknown) {
      toast({
        title: 'Failed to regenerate codes',
        description: err instanceof Error ? err.message : 'Invalid code',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isLoading,
    get2FAStatus,
    setup2FA,
    verifySetup,
    verify2FA,
    disable2FA,
    regenerateBackupCodes
  };
}
