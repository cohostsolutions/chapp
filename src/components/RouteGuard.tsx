import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

type AppRole = 'super_admin' | 'client_admin' | 'agent' | 'viewer';

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
}

export function RouteGuard({ children, allowedRoles, redirectTo = '/dashboard' }: RouteGuardProps) {
  const { user, loading, effectiveRoles, effectiveIsSuperAdmin, isSuperAdmin, impersonatedRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const hasShownToast = useRef(false);

  // Reset toast flag when location changes
  useEffect(() => {
    hasShownToast.current = false;
  }, [location.pathname]);

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to auth
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // Super admins who are NOT impersonating can access everything
    if (isSuperAdmin && !impersonatedRole) return;

    // Wait for roles to be loaded - if effectiveRoles is empty, roles are still being fetched
    // Don't show access denied until we're sure roles have loaded
    if (effectiveRoles.length === 0) return;

    // Check if user has any of the allowed roles (using effective roles for impersonation)
    const hasAccess = allowedRoles.some(role => effectiveRoles.includes(role));
    
    if (!hasAccess && !hasShownToast.current) {
      hasShownToast.current = true;
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, effectiveRoles, isSuperAdmin, impersonatedRole, allowedRoles, navigate, redirectTo, toast, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Super admin (not impersonating) always has access
  if (isSuperAdmin && !impersonatedRole) {
    return <>{children}</>;
  }

  // Check role access using effective roles
  const hasAccess = allowedRoles.some(role => effectiveRoles.includes(role));
  
  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
