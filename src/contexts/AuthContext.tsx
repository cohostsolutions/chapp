import { startNonBlockingRLSAudit } from '@/lib/rlsAuditManager';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { devLog, devError } from '@/lib/logger';
import { AuthContext, type AppRole, type AiAgentType, type OrgFeatures, type LockoutStatus, type AuthContextType, type Profile } from '@/hooks/authContext';

// Session timeout: 3 hours of inactivity (in milliseconds)
const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000;

// IMPORTANT: This bypass flag should NEVER be true in production builds
// Controlled via env for local debugging only (VITE_DEV_BYPASS_AUTH='true')
const DEV_BYPASS_AUTH = Boolean(import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true');

// Build-time safety check
if (DEV_BYPASS_AUTH && import.meta.env.PROD) {
  console.error('CRITICAL: DEV_BYPASS_AUTH is enabled in production! This is a security vulnerability.');
}

const IMPERSONATION_KEY = 'alcor_crm_impersonated_role';
const LAST_ACTIVITY_KEY = 'alcor_crm_last_activity';

// Helper to clear all stale auth data from storage
const clearStaleAuthData = () => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      localStorage.removeItem(key);
    }
  }
  localStorage.removeItem(IMPERSONATION_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  sessionStorage.removeItem('current_session_token');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(!DEV_BYPASS_AUTH);
  const [aiAgentType, setAiAgentType] = useState<AiAgentType | null>(null);
  const [orgFeatures, setOrgFeatures] = useState<OrgFeatures | null>(null);
  const [impersonatedRole, setImpersonatedRoleState] = useState<AppRole | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadOrganizationContext = useCallback(async (organizationId: string | null) => {
    if (!organizationId) {
      setAiAgentType(null);
      setOrgFeatures(null);
      return;
    }

    const { data: orgData } = await supabase
      .from('organizations')
      .select('ai_agent_type, workflows_enabled, communications_enabled, social_feed_enabled')
      .eq('id', organizationId)
      .single();

    if (!orgData) {
      setAiAgentType(null);
      setOrgFeatures(null);
      return;
    }

    setAiAgentType(orgData.ai_agent_type as AiAgentType);
    setOrgFeatures({
      workflows_enabled: orgData.workflows_enabled ?? false,
      communications_enabled: orgData.communications_enabled ?? false,
      social_feed_enabled: orgData.social_feed_enabled ?? false,
    });
  }, []);

  // Internal helper to clear impersonation state (used during auth events)
  const clearImpersonationState = () => {
    localStorage.removeItem(IMPERSONATION_KEY);
    setImpersonatedRoleState(null);
  };

  // Handle setting impersonated role with localStorage persistence AND database sync
  const setImpersonatedRole = async (role: AppRole | null) => {
    if (role) {
      localStorage.setItem(IMPERSONATION_KEY, role);
    } else {
      localStorage.removeItem(IMPERSONATION_KEY);
    }
    setImpersonatedRoleState(role);
    
    // Sync to database for RLS policies to respect impersonation
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ impersonated_role: role })
          .eq('id', user.id);

        const { data: refreshedProfile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

        await loadOrganizationContext(refreshedProfile?.organization_id ?? null);
      } catch (err) {
        devError('Failed to sync impersonated role to database:', err);
      }
    }
  };

  // Load impersonated role from localStorage ONLY after we know the user is a super_admin
  // Also sync with database to ensure RLS policies work correctly on page refresh
  useEffect(() => {
    if (!loading && roles.includes('super_admin')) {
      const stored = localStorage.getItem(IMPERSONATION_KEY);
      if (stored && ['super_admin', 'client_admin', 'agent'].includes(stored)) {
        // Set state immediately for UI
        setImpersonatedRoleState(stored as AppRole);
        // Sync to database for RLS (the database might have been cleared on signout)
        if (user) {
          supabase
            .from('profiles')
            .update({ impersonated_role: stored as AppRole })
            .eq('id', user.id)
            .then((result) => {
              if (result.error) {
                devError('Failed to sync impersonation:', result.error);
              } else {
                devLog('Synced impersonation from localStorage to database');
              }
            });
        }
      }
    } else if (!loading && !roles.includes('super_admin')) {
      // Clear any stale impersonation data for non-super-admins
      localStorage.removeItem(IMPERSONATION_KEY);
      setImpersonatedRoleState(null);
    }
  }, [loading, roles, user]);

  // Inactivity timeout: Log out users after 3 hours of no activity
  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    
    // Update last activity timestamp
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    
    // Clear existing timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    // Set new timeout
    inactivityTimeoutRef.current = setTimeout(async () => {
      devLog('Session expired due to inactivity');
      await supabase.auth.signOut();
    }, SESSION_TIMEOUT_MS);
  }, [user]);

  // Check for session expiry on mount and set up activity listeners
  useEffect(() => {
    if (!user) return;

    // Check if session should have expired while tab was inactive
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed >= SESSION_TIMEOUT_MS) {
        devLog('Session expired while inactive');
        supabase.auth.signOut();
        return;
      }
    }

    // Initialize the timer
    resetInactivityTimer();

    // Activity events to track
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetInactivityTimer]);

  // DEV BYPASS: Skip auth and use mock super_admin user
  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      setUser({ id: 'dev-user-id', email: 'dev@example.com' } as User);
      setProfile({
        id: 'dev-user-id',
        email: 'dev@example.com',
        full_name: 'Dev User (Auth Bypassed)',
        avatar_url: null,
        organization_id: '213429eb-8e61-40a2-a5e9-9678337e4506', // Default org
      });
      setRoles(['super_admin']);
      setAiAgentType('jay');
      setOrgFeatures({ workflows_enabled: true, communications_enabled: true, social_feed_enabled: true });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip real auth when bypassing
    if (DEV_BYPASS_AUTH) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle token refresh errors by clearing stale session
        if (event === 'TOKEN_REFRESHED' && !session) {
          devLog('Token refresh failed, clearing session');
          clearStaleAuthData();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          clearImpersonationState();
          setLoading(false);
          return;
        }

        // Handle sign out event
        if (event === 'SIGNED_OUT') {
          clearStaleAuthData();
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          clearImpersonationState();
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          clearImpersonationState();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      // If there's an error getting session, clear stale data
      if (error) {
        devLog('Session error, clearing stale data:', error.message);
        clearStaleAuthData();
        setLoading(false);
        return;
      }

      // If no session but we had stale data in storage, clear it
      if (!session) {
        clearStaleAuthData();
        setLoading(false);
        return;
      }

      // Validate the session with the backend (getSession can return stale local storage data)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        devLog('Stale session detected, clearing auth data:', userError?.message);
        clearStaleAuthData();
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
        clearImpersonationState();
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session.user);
      fetchUserData(session.user.id);
      startNonBlockingRLSAudit(3000);
    }).catch((err) => {
      devError('Failed to get session:', err);
      clearStaleAuthData();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId)
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
        await loadOrganizationContext(profileResult.data.organization_id);
      } else {
        setAiAgentType(null);
        setOrgFeatures(null);
      }

      if (rolesResult.data) {
        setRoles(rolesResult.data.map(r => r.role as AppRole));
      }
    } catch (error) {
      devError('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data as Profile);
        await loadOrganizationContext(data.organization_id);
      } else {
        setAiAgentType(null);
        setOrgFeatures(null);
      }

      return (data as Profile) || null;
    } catch (err) {
      devError('Failed to refresh profile:', err);
      return null;
    }
  };

  const checkLockout = async (email: string): Promise<LockoutStatus | null> => {
    try {
      const { data, error } = await supabase.rpc('check_account_lockout', { p_email: email });
      if (error) {
        devError('Error checking lockout:', error);
        return null;
      }
      return data as unknown as LockoutStatus;
    } catch (err) {
      devError('Lockout check failed:', err);
      return null;
    }
  };

  const recordLoginAttempt = async (email: string, wasSuccessful: boolean) => {
    try {
      await supabase.rpc('record_login_attempt', { 
        p_email: email, 
        p_was_successful: wasSuccessful 
      });
    } catch (err) {
      devError('Failed to record login attempt:', err);
    }
  };

  const triggerLoginAlert = async (email: string) => {
    try {
      // Fire and forget - don't block login flow
      supabase.functions.invoke('login-alert', {
        body: { email }
      }).catch(err => devError('Login alert failed:', err));
    } catch (err) {
      devError('Failed to trigger login alert:', err);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: null } | { error: Error; lockoutStatus?: LockoutStatus }> => {
    // Check lockout status before attempting login
    const lockoutStatus = await checkLockout(email);
    
    if (lockoutStatus?.is_locked) {
      const lockoutUntil = lockoutStatus.lockout_until 
        ? new Date(lockoutStatus.lockout_until).toLocaleTimeString() 
        : 'a few minutes';
      return { 
        error: new Error(`Account temporarily locked due to too many failed attempts. Please try again after ${lockoutUntil}.`),
        lockoutStatus 
      };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    // Record the attempt
    await recordLoginAttempt(email, !error);
    
    // If login failed, trigger alert check (async, non-blocking)
    if (error) {
      triggerLoginAlert(email);
      const updatedLockout = await checkLockout(email);
      return { 
        error: error as Error, 
        lockoutStatus: updatedLockout || undefined 
      };
    }
    
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Mark current session as inactive
    const sessionToken = sessionStorage.getItem('current_session_token');
    if (sessionToken && user) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionToken);
      sessionStorage.removeItem('current_session_token');
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setAiAgentType(null);
    setOrgFeatures(null);
    clearImpersonationState();
  };

  // Actual role checks (based on user_roles table)
  const hasRole = (role: AppRole) => roles.includes(role);
  const isSuperAdmin = hasRole('super_admin');
  const isClientAdmin = hasRole('client_admin');
  const isAgent = hasRole('agent');

  // Effective role checks (respects impersonation)
  // When impersonating, use the impersonated role instead of actual roles
  const effectiveRoles = impersonatedRole ? [impersonatedRole] : roles;
  const effectiveIsSuperAdmin = impersonatedRole ? false : isSuperAdmin;
  const effectiveIsClientAdmin = impersonatedRole ? impersonatedRole === 'client_admin' : isClientAdmin;
  const effectiveIsAgent = impersonatedRole ? impersonatedRole === 'agent' : isAgent;

  // Clear impersonation and return to super admin view
  const clearImpersonation = async () => {
    await setImpersonatedRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      loading,
      aiAgentType,
      orgFeatures,
      refreshProfile,
      signIn,
      signUp,
      signOut,
      hasRole,
      isSuperAdmin,
      isClientAdmin,
      isAgent,
      checkLockout,
      clearImpersonation,
      impersonatedRole,
      setImpersonatedRole,
      effectiveRoles,
      effectiveIsSuperAdmin,
      effectiveIsClientAdmin,
      effectiveIsAgent,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth is now exported from hooks/authContext to satisfy react-refresh rule.
export { useAuth } from '@/hooks/authContext';
