import { useState, useEffect } from 'react';
import { Building2, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  ai_agent_type: string;
}

interface OrganizationFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showLabel?: boolean;
}

export function OrganizationFilter({ 
  value, 
  onChange, 
  className,
  showLabel = false 
}: OrganizationFilterProps) {
  const { isSuperAdmin } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchOrganizations();
    }
  }, [isSuperAdmin]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, ai_agent_type')
        .eq('is_archived', false)
        .order('name');
      
      if (!error && data) {
        setOrganizations(data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Only show for super admins
  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Filter className="w-4 h-4" />
          Organization:
        </span>
      )}
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={loading ? 'Loading...' : 'All Organizations'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              All Organizations
            </span>
          </SelectItem>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {org.name}
                <Badge variant="outline" className="ml-1 text-xs">
                  {org.ai_agent_type}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Badge component for displaying organization on data rows
interface OrganizationBadgeProps {
  organizationId: string | null;
  organizationName?: string | null;
  className?: string;
}

export function OrganizationBadge({ 
  organizationId, 
  organizationName,
  className 
}: OrganizationBadgeProps) {
  const { isSuperAdmin } = useAuth();
  const [name, setName] = useState<string | null>(organizationName || null);
  
  useEffect(() => {
    if (isSuperAdmin && organizationId && !organizationName) {
      // Fetch org name if not provided
      supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setName(data.name);
        });
    }
  }, [organizationId, organizationName, isSuperAdmin]);

  // Only show for super admins
  if (!isSuperAdmin || !organizationId) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'bg-primary/10 text-primary border-primary/30 gap-1 text-xs',
        className
      )}
    >
      <Building2 className="w-3 h-3" />
      {name || 'Loading...'}
    </Badge>
  );
}
