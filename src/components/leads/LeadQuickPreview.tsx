import { Phone, Mail, Tag, Calendar, MessageSquare, ShoppingBag, BedDouble } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LeadTemperatureBadge } from '@/components/LeadTemperatureBadge';

export interface LeadPreviewData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  source?: string | null;
  lead_temperature?: 'hot' | 'warm' | 'cold' | null;
  created_at?: string;
  // Optional counts for associated data
  bookingsCount?: number;
  ordersCount?: number;
  conversationsCount?: number;
}

interface LeadQuickPreviewProps {
  lead: LeadPreviewData;
  onViewDetails: () => void;
  onCall?: () => void;
  onMessage?: () => void;
}

const statusColors: Record<string, string> = {
  new: 'bg-primary/20 text-primary border-primary/30',
  contacted: 'bg-warning/20 text-warning border-warning/30',
  qualified: 'bg-success/20 text-success border-success/30',
  converted: 'bg-success/20 text-success border-success/30',
  lost: 'bg-destructive/20 text-destructive border-destructive/30',
};

export function LeadQuickPreview({ lead, onViewDetails, onCall, onMessage }: LeadQuickPreviewProps) {
  return (
    <div className="w-72 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-foreground truncate">{lead.name}</h4>
          {lead.status && (
            <Badge variant="outline" className={`mt-1 text-xs ${statusColors[lead.status] || 'bg-muted'}`}>
              {lead.status}
            </Badge>
          )}
        </div>
        <LeadTemperatureBadge temperature={lead.lead_temperature || null} size="sm" />
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 text-sm">
        {lead.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.source && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span>{lead.source}</span>
          </div>
        )}
        {lead.created_at && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Added {format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>

      {/* Associated Data Counts */}
      {(lead.bookingsCount !== undefined || lead.ordersCount !== undefined || lead.conversationsCount !== undefined) && (
        <>
          <Separator />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {lead.bookingsCount !== undefined && lead.bookingsCount > 0 && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                {lead.bookingsCount} booking{lead.bookingsCount !== 1 ? 's' : ''}
              </span>
            )}
            {lead.ordersCount !== undefined && lead.ordersCount > 0 && (
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                {lead.ordersCount} order{lead.ordersCount !== 1 ? 's' : ''}
              </span>
            )}
            {lead.conversationsCount !== undefined && lead.conversationsCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {lead.conversationsCount} chat{lead.conversationsCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <Separator />
      <div className="flex items-center gap-2">
        <Button 
          variant="default" 
          size="sm" 
          className="flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
        >
          View Full Details
        </Button>
        {lead.phone && onCall && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCall();
            }}
          >
            <Phone className="h-3.5 w-3.5" />
          </Button>
        )}
        {onMessage && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMessage();
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
