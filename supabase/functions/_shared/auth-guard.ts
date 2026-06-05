import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Authentication and authorization guard for edge functions
 * Provides consistent tenant isolation and permission checks
 */

export interface AuthContext {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    organization_id: string | null;
  } | null;
  roles: Array<{ role: string }>;
  isSuperAdmin: boolean;
  organizationId: string | null;
}

export interface AuthGuardOptions {
  requireOrganization?: boolean;
  allowSuperAdminOverride?: boolean;
}

/**
 * Verify authentication and fetch user context
 * Returns null if authentication fails
 */
export async function verifyAuth(
  authHeader: string | null,
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseServiceKey: string
): Promise<AuthContext | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    console.error('Authentication failed:', authError?.message);
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id),
  ]);

  const isSuperAdmin = roles?.some((r: { role: string }) => r.role === 'super_admin') ?? false;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    roles: roles || [],
    isSuperAdmin,
    organizationId: profile?.organization_id || null,
  };
}

/**
 * Enforce organization access control
 * Returns the organization ID the user is authorized to use
 * Throws if unauthorized
 */
export function enforceOrganizationAccess(
  authContext: AuthContext,
  requestedOrgId: string | null | undefined,
  options: AuthGuardOptions = {}
): string {
  const { requireOrganization = true, allowSuperAdminOverride = true } = options;

  // Super admins can override if allowed
  if (authContext.isSuperAdmin && allowSuperAdminOverride && requestedOrgId) {
    return requestedOrgId;
  }

  // Non-super-admins must have an organization
  if (!authContext.organizationId) {
    if (requireOrganization) {
      throw new Error('User has no organization');
    }
    if (requestedOrgId) {
      throw new Error('Forbidden: user cannot specify organization');
    }
  }

  // Non-super-admins cannot access other organizations
  if (!authContext.isSuperAdmin && requestedOrgId && requestedOrgId !== authContext.organizationId) {
    throw new Error('Forbidden: organization mismatch');
  }

  // Default to user's organization
  return authContext.organizationId || requestedOrgId || '';
}

/**
 * Verify that a resource belongs to the authorized organization
 */
export function verifyResourceOwnership(
  authContext: AuthContext,
  resourceOrgId: string | null,
  authorizedOrgId: string
): void {
  // Super admins can access any resource
  if (authContext.isSuperAdmin) {
    return;
  }

  // Resource must belong to the authorized org
  if (resourceOrgId && resourceOrgId !== authorizedOrgId) {
    throw new Error('Forbidden: resource belongs to another organization');
  }
}

/**
 * Create error response for authentication failures
 */
export function createAuthErrorResponse(
  error: Error | string,
  corsHeaders: Record<string, string>
): Response {
  const message = typeof error === 'string' ? error : error.message;
  
  let status = 500;
  if (message.includes('Unauthorized') || message.includes('Authentication')) {
    status = 401;
  } else if (message.includes('Forbidden') || message.includes('organization')) {
    status = 403;
  } else if (message.includes('not found') || message.includes('User has no')) {
    status = 400;
  }

  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
