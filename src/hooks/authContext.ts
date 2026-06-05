import { createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'super_admin' | 'client_admin' | 'agent' | 'viewer';
export type AiAgentType = 'cece';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
}

export interface LockoutStatus {
  is_locked: boolean;
  failed_attempts: number;
  max_attempts: number;
  lockout_until: string | null;
  remaining_attempts: number;
}

export interface OrgFeatures {
  workflows_enabled: boolean;
  communications_enabled: boolean;
  social_feed_enabled: boolean;
}

export type SignInResult = 
  | { error: null }
  | { error: Error; lockoutStatus?: LockoutStatus };

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  aiAgentType: AiAgentType | null;
  orgFeatures: OrgFeatures | null;
  refreshProfile: () => Promise<Profile | null>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  clearImpersonation: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isSuperAdmin: boolean;
  isClientAdmin: boolean;
  isAgent: boolean;
  checkLockout: (email: string) => Promise<LockoutStatus | null>;
  impersonatedRole: AppRole | null;
  setImpersonatedRole: (role: AppRole | null) => Promise<void>;
  effectiveRoles: AppRole[];
  effectiveIsSuperAdmin: boolean;
  effectiveIsClientAdmin: boolean;
  effectiveIsAgent: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
