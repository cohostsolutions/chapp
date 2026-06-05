import { Badge } from '@/components/ui/badge';
import { useLeadOfferingCount } from '@/hooks/useLeadOfferingCounts';
import { Briefcase, Loader2 } from 'lucide-react';

export interface OfferingCountBadgeProps {
  leadId: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Display badge showing number of linked offerings for a lead
 */
export function OfferingCountBadge({
  leadId,
  className = '',
  showIcon = true,
}: OfferingCountBadgeProps) {
  const { data, isLoading } = useLeadOfferingCount(leadId);

  if (isLoading) {
    return (
      <Badge variant="secondary" className={className}>
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Loading...
      </Badge>
    );
  }

  if (!data || data.count === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {showIcon && <Briefcase className="w-3 h-3" />}
      {data.count} offering{data.count !== 1 ? 's' : ''}
    </Badge>
  );
}

/**
 * Variant that shows tooltip with offering names
 */
export function OfferingCountBadgeWithTooltip({
  leadId,
  className = '',
  showIcon = true,
}: OfferingCountBadgeProps) {
  const { data, isLoading } = useLeadOfferingCount(leadId);

  if (isLoading || !data || data.count === 0) {
    return null;
  }

  return (
    <div title={data.offerings.map((o) => o.name).join(', ')}>
      <Badge variant="outline" className={`gap-1 cursor-help ${className}`}>
        {showIcon && <Briefcase className="w-3 h-3" />}
        {data.count}
      </Badge>
    </div>
  );
}
