import { useState, useCallback } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Phone, Mail, Calendar, CheckCircle, XCircle } from 'lucide-react';

export interface LeadContextMenuProps {
  leadId: string;
  leadName: string;
  onCreateCall?: (leadId: string) => void;
  onCreateEmail?: (leadId: string) => void;
  onCreateMeeting?: (leadId: string) => void;
  onMarkWon?: (leadId: string) => void;
  onMarkLost?: (leadId: string) => void;
  children: React.ReactNode;
}

/**
 * Context menu for sales leads with quick actions
 * Right-click to: create call, email, meeting, or mark won/lost
 */
export function LeadContextMenu({
  leadId,
  leadName,
  onCreateCall,
  onCreateEmail,
  onCreateMeeting,
  onMarkWon,
  onMarkLost,
  children,
}: LeadContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {/* Communication Actions */}
        <ContextMenuItem onClick={() => onCreateCall?.(leadId)} className="gap-2">
          <Phone className="w-4 h-4" />
          <span>Create Call</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onCreateEmail?.(leadId)} className="gap-2">
          <Mail className="w-4 h-4" />
          <span>Create Email</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘E</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onCreateMeeting?.(leadId)} className="gap-2">
          <Calendar className="w-4 h-4" />
          <span>Schedule Meeting</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘M</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Deal Status Actions */}
        <ContextMenuItem 
          onClick={() => onMarkWon?.(leadId)} 
          className="gap-2 text-green-600"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Mark as Won</span>
        </ContextMenuItem>

        <ContextMenuItem 
          onClick={() => onMarkLost?.(leadId)} 
          className="gap-2 text-red-600"
        >
          <XCircle className="w-4 h-4" />
          <span>Mark as Lost</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
