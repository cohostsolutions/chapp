import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Sparkles } from 'lucide-react';
import { LeadTemperatureBadge } from '@/components/LeadTemperatureBadge';
import { ClickableLeadName } from '@/components/LeadInfoDialog';
import { cn } from '@/lib/utils';

function LeadTableSkeleton({ rows = 5, showAgent = true, showSummary = true, showActions = true }: {
  rows?: number;
  showAgent?: boolean;
  showSummary?: boolean;
  showActions?: boolean;
}) {
  const columnCount = 4 + (showAgent ? 1 : 0) + (showSummary ? 1 : 0) + (showActions ? 1 : 0);
  
  return (
    <>
      {/* Mobile Skeleton */}
      <div className="lg:hidden space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="bg-secondary/30">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-4 text-left"><Skeleton className="h-3 w-12" /></th>
              <th className="py-3 px-4 text-left"><Skeleton className="h-3 w-12" /></th>
              <th className="py-3 px-4 text-left"><Skeleton className="h-3 w-10" /></th>
              <th className="py-3 px-4 text-left"><Skeleton className="h-3 w-12" /></th>
              {showAgent && <th className="py-3 px-4 text-left"><Skeleton className="h-3 w-12" /></th>}
              {showSummary && <th className="py-3 px-4 text-left"><Skeleton className="h-3 w-16" /></th>}
              {showActions && <th className="py-3 px-4 text-right"><Skeleton className="h-3 w-12 ml-auto" /></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-36" />
                </td>
                <td className="py-3 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                <td className="py-3 px-4"><Skeleton className="h-5 w-14 rounded-full" /></td>
                <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                {showAgent && <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>}
                {showSummary && <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>}
                {showActions && <td className="py-3 px-4 text-right"><Skeleton className="h-8 w-8 ml-auto" /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  status: string;
  source?: string | null;
  notes?: string | null;
  lead_temperature?: 'cold' | 'warm' | 'hot' | null;
  assigned_agent?: {
    id: string;
    full_name?: string | null;
    email?: string;
  } | null;
}

interface LeadTableProps {
  leads: Lead[];
  isLoading?: boolean;
  showAgent?: boolean;
  showSummary?: boolean;
  showActions?: boolean;
  onLeadClick?: (lead: Lead) => void;
  onGenerateSummary?: (lead: Lead) => void;
  generatingSummaryId?: string | null;
  emptyMessage?: string;
  loadingRows?: number;
}

const statusColors: Record<string, string> = {
  new: 'bg-primary/20 text-primary border-primary/30',
  contacted: 'bg-warning/20 text-warning border-warning/30',
  qualified: 'bg-success/20 text-success border-success/30',
  converted: 'bg-success/20 text-success border-success/30',
  lost: 'bg-destructive/20 text-destructive border-destructive/30',
};

export function LeadTable({
  leads,
  isLoading = false,
  showAgent = true,
  showSummary = true,
  showActions = true,
  onLeadClick,
  onGenerateSummary,
  generatingSummaryId,
  emptyMessage = 'No leads found',
  loadingRows = 5,
}: LeadTableProps) {
  if (isLoading) {
    return (
      <LeadTableSkeleton 
        rows={loadingRows} 
        showAgent={showAgent} 
        showSummary={showSummary} 
        showActions={showActions && !!onGenerateSummary} 
      />
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
    );
  }

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="lg:hidden space-y-3">
        {leads.map((lead) => (
          <Card key={lead.id} className="bg-secondary/30">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <ClickableLeadName 
                    lead={{
                      id: lead.id,
                      name: lead.name,
                      email: lead.email || undefined,
                      status: lead.status,
                      source: lead.source || undefined,
                    }} 
                    onSelect={() => onLeadClick?.(lead)} 
                  />
                  {lead.email && (
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <LeadTemperatureBadge temperature={lead.lead_temperature ?? null} size="sm" />
                  <Badge variant="outline" className={cn("text-xs", statusColors[lead.status])}>
                    {lead.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  Source: {lead.source || 'Unknown'}
                </span>
              </div>
              {showSummary && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {lead.notes || 'No notes'}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden lg:block overflow-x-auto" role="region" aria-label="Leads table">
        <table className="w-full" role="grid" aria-label="Leads data">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <abbr title="Temperature">Temp</abbr>
              </th>
              <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Source
              </th>
              {showAgent && (
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Agent
                </th>
              )}
              {showSummary && (
                <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Summary
                </th>
              )}
              {showActions && onGenerateSummary && (
                <th scope="col" className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <span className="sr-only">Actions</span>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-secondary/30 transition-colors">
                <td className="py-3 px-4">
                  <ClickableLeadName 
                    lead={{
                      id: lead.id,
                      name: lead.name,
                      email: lead.email || undefined,
                      status: lead.status,
                      source: lead.source || undefined,
                    }} 
                    onSelect={() => onLeadClick?.(lead)} 
                  />
                  {lead.email && (
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Badge variant="outline" className={statusColors[lead.status]}>
                    {lead.status}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <LeadTemperatureBadge temperature={lead.lead_temperature ?? null} />
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {lead.source || 'Unknown'}
                </td>
                {showAgent && (
                  <td className="py-3 px-4">
                    <span className="text-sm text-muted-foreground">
                      {lead.assigned_agent?.full_name || 'Unassigned'}
                    </span>
                  </td>
                )}
                {showSummary && (
                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-sm text-muted-foreground truncate">
                      {lead.notes || 'No summary'}
                    </p>
                  </td>
                )}
                {showActions && onGenerateSummary && (
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onGenerateSummary(lead)}
                      disabled={generatingSummaryId === lead.id}
                      aria-label={`Generate AI summary for ${lead.name}`}
                    >
                      {generatingSummaryId === lead.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          <span className="sr-only">Generating summary...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" aria-hidden="true" />
                          <span className="sr-only">Generate summary</span>
                        </>
                      )}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
