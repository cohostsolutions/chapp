import { useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { LeadQuickPreview, LeadPreviewData } from './LeadQuickPreview';
import { LeadInfoDialog, LeadInfo } from '@/components/LeadInfoDialog';
import { cn } from '@/lib/utils';

interface ClickableLeadNameProps {
  lead: LeadPreviewData;
  className?: string;
  showHoverCard?: boolean;
  onCall?: () => void;
  onMessage?: () => void;
  onUpdate?: (lead: LeadInfo) => void;
}

export function ClickableLeadName({ 
  lead, 
  className, 
  showHoverCard = true,
  onCall,
  onMessage,
  onUpdate
}: ClickableLeadNameProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogOpen(true);
  };

  const leadInfo: LeadInfo = {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    source: lead.source,
    created_at: lead.created_at,
  };

  const nameButton = (
    <button
      onClick={handleClick}
      className={cn(
        "font-medium text-foreground hover:text-primary hover:underline transition-colors cursor-pointer text-left",
        className
      )}
    >
      {lead.name}
    </button>
  );

  if (!showHoverCard) {
    return (
      <>
        {nameButton}
        <LeadInfoDialog
          lead={dialogOpen ? leadInfo : null}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCall={onCall ? () => onCall() : undefined}
          onChat={onMessage}
          onUpdate={onUpdate}
        />
      </>
    );
  }

  return (
    <>
      <HoverCard openDelay={300} closeDelay={100}>
        <HoverCardTrigger asChild>
          {nameButton}
        </HoverCardTrigger>
        <HoverCardContent 
          side="right" 
          align="start" 
          className="p-0 w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <LeadQuickPreview
            lead={lead}
            onViewDetails={() => setDialogOpen(true)}
            onCall={onCall}
            onMessage={onMessage}
          />
        </HoverCardContent>
      </HoverCard>

      <LeadInfoDialog
        lead={dialogOpen ? leadInfo : null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCall={onCall ? () => onCall() : undefined}
        onChat={onMessage}
        onUpdate={onUpdate}
      />
    </>
  );
}
