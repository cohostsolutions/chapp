import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useCallback } from 'react';

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  device_type: string | null;
  ip_address: string | null;
  user_agent: string | null;
  location: string | null;
  is_active: boolean;
  last_activity_at: string;
  expires_at: string;
  created_at: string;
}

export type UserSessionWithProfile = UserSession & {
  profiles: { email: string | null; full_name: string | null } | null;
};

// Helper to detect device type from user agent
function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return 'Tablet';
    return 'Mobile';
  }
  if (/mac|macintosh/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Desktop';
}

// Helper to get browser name from user agent
function getBrowserName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/opera|opr/i.test(ua)) return 'Opera';
  return 'Browser';
}

// Generate a unique session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Get client IP (approximate)
async function getClientIP(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

export function useSessionManagement() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Track session on login
  const trackSession = useCallback(async () => {
    if (!user || !session) return;

    const userAgent = navigator.userAgent;
    const deviceType = detectDeviceType(userAgent);
    const browserName = getBrowserName(userAgent);
    const sessionToken = generateSessionToken();
    const ipAddress = await getClientIP();

    // Check if we already have a session for this browser session
    const existingSessionToken = sessionStorage.getItem('current_session_token');
    
    if (existingSessionToken) {
      // Update last activity for existing session
      await supabase
        .from('user_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('session_token', existingSessionToken)
        .eq('user_id', user.id);
      return;
    }

    // Create new session record
    const { error } = await supabase.from('user_sessions').insert({
      user_id: user.id,
      session_token: sessionToken,
      device_type: `${deviceType} - ${browserName}`,
      ip_address: ipAddress,
      user_agent: userAgent,
      location: Intl.DateTimeFormat().resolvedOptions().timeZone,
      is_active: true,
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    });

    if (!error) {
      sessionStorage.setItem('current_session_token', sessionToken);
    }
  }, [user, session]);

  // Update activity periodically
  const updateActivity = useCallback(async () => {
    const sessionToken = sessionStorage.getItem('current_session_token');
    if (!sessionToken || !user) return;

    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('session_token', sessionToken)
        .eq('user_id', user.id);
    } catch {
      // Non-critical update; silently ignore
    }
  }, [user]);

  // Track session on mount
  useEffect(() => {
    if (user && session) {
      trackSession();
    }
  }, [user, session, trackSession]);

  // Update activity every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(updateActivity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, updateActivity]);

  // Fetch all sessions for current user
  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['user-sessions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      return data as UserSession[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  // Revoke a specific session
  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast({ title: 'Session revoked successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to revoke session', variant: 'destructive' });
    },
  });

  // Revoke all other sessions
  const revokeAllOtherSessions = useMutation({
    mutationFn: async () => {
      const currentToken = sessionStorage.getItem('current_session_token');
      
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', user?.id)
        .neq('session_token', currentToken || '');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast({ title: 'All other sessions have been revoked' });
    },
    onError: () => {
      toast({ title: 'Failed to revoke sessions', variant: 'destructive' });
    },
  });

  // Clean up session on logout
  const endCurrentSession = useCallback(async () => {
    const sessionToken = sessionStorage.getItem('current_session_token');
    if (!sessionToken || !user) return;

    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('session_token', sessionToken);

    sessionStorage.removeItem('current_session_token');
  }, [user]);

  const currentSessionToken = sessionStorage.getItem('current_session_token');

  return {
    sessions,
    isLoading,
    refetch,
    revokeSession: revokeSession.mutate,
    revokeAllOtherSessions: revokeAllOtherSessions.mutate,
    isRevoking: revokeSession.isPending || revokeAllOtherSessions.isPending,
    endCurrentSession,
    currentSessionToken,
  };
}

// Hook to fetch all sessions for admin view
export function useAllUserSessions() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery<UserSessionWithProfile[]>({
    queryKey: ['all-user-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          profiles:user_id (email, full_name)
        `)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UserSessionWithProfile[];
    },
    enabled: !!user && isSuperAdmin,
    staleTime: 60 * 1000,
  });

  const revokeUserSessions = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('revoke-session', {
        body: { userId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-sessions'] });
      toast({ title: 'All sessions for this user have been revoked' });
    },
    onError: () => {
      toast({ title: 'Failed to revoke sessions', variant: 'destructive' });
    },
  });

  return {
    sessions,
    isLoading,
    revokeUserSessions: revokeUserSessions.mutate,
    isRevoking: revokeUserSessions.isPending,
  };
}
