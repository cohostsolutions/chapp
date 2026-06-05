import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Shield, UserCog, User, Building2, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function RoleBadge() {
  const { isSuperAdmin, isClientAdmin, profile, effectiveRoles } = useAuth();
  const [orgName, setOrgName] = useState<string | null>(null);

  // Check if user is a viewer
  const isViewer = effectiveRoles.includes('viewer');

  useEffect(() => {
    if (profile?.organization_id) {
      supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setOrgName(data.name);
        });
    } else {
      setOrgName(null);
    }
  }, [profile?.organization_id]);

  if (isSuperAdmin) {
    return (
      <div className="flex items-center gap-2">
        {orgName ? (
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 gap-1">
            <Building2 className="w-3 h-3" />
            <span className="hidden sm:inline">Viewing:</span> {orgName}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 gap-1">
            <Shield className="w-3 h-3" />
            <span className="hidden sm:inline">Super Admin</span>
            <span className="sm:hidden">Admin</span>
          </Badge>
        )}
      </div>
    );
  }

  if (isClientAdmin) {
    return (
      <Badge variant="outline" className="bg-success/20 text-success border-success/30 gap-1">
        <UserCog className="w-3 h-3" />
        <span className="hidden sm:inline">Client Admin</span>
        <span className="sm:hidden">Admin</span>
      </Badge>
    );
  }

  if (isViewer) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
        <Eye className="w-3 h-3" />
        <span className="hidden sm:inline">Viewer</span>
        <span className="sm:hidden">View</span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-secondary text-muted-foreground border-border gap-1">
      <User className="w-3 h-3" />
      <span className="hidden sm:inline">Agent</span>
    </Badge>
  );
}
