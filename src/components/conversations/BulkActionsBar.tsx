import { useState } from 'react';
import { devError } from '@/lib/logger';
import { Archive, Bot, X, Loader2, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BulkActionsBarProps {
  selectedIds: string[];
  selectedLeadIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function BulkActionsBar({
  selectedIds,
  selectedLeadIds,
  onClearSelection,
  onActionComplete,
}: BulkActionsBarProps) {
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isHandingBack, setIsHandingBack] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showHandbackDialog, setShowHandbackDialog] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleBulkArchive = async () => {
    setIsArchiving(true);
    try {
      const uniqueLeadIds = [...new Set(selectedLeadIds.filter(Boolean))];
      if (uniqueLeadIds.length === 0) {
        throw new Error('No linked leads available for archiving');
      }

      const { error } = await supabase
        .from('ai_conversations')
        .update({ status: 'archived' })
        .in('lead_id', uniqueLeadIds);

      if (error) throw error;

      toast({
        title: 'Conversations Archived',
        description: `${uniqueLeadIds.length} conversation(s) have been archived.`,
      });

      onClearSelection();
      onActionComplete();
    } catch (error) {
      devError('Bulk archive error:', error);
      toast({
        title: 'Archive Failed',
        description: error instanceof Error ? error.message : 'Failed to archive conversations',
        variant: 'destructive',
      });
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handleBulkHandback = async () => {
    setIsHandingBack(true);
    try {
      // Filter to only unique lead IDs
      const uniqueLeadIds = [...new Set(selectedLeadIds.filter(Boolean))];
      
      let successCount = 0;
      let failCount = 0;

      for (const leadId of uniqueLeadIds) {
        try {
          const { error } = await supabase.functions.invoke('agent-handback', {
            body: { leadId },
          });
          if (error) throw error;
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Handed Back to AI',
          description: `${successCount} conversation(s) handed back to AI.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
        });
      }

      onClearSelection();
      onActionComplete();
    } catch (error) {
      devError('Bulk handback error:', error);
      toast({
        title: 'Handback Failed',
        description: 'Failed to hand back conversations',
        variant: 'destructive',
      });
    } finally {
      setIsHandingBack(false);
      setShowHandbackDialog(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3 animate-in slide-in-from-bottom-4 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <CheckSquare className="h-4 w-4 text-primary" />
          <Badge variant="secondary" className="font-semibold text-xs sm:text-sm px-1.5 sm:px-2">
            {selectedIds.length}
          </Badge>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchiveDialog(true)}
            disabled={isArchiving || isHandingBack}
            className="gap-1 sm:gap-1.5 h-8 px-2 sm:px-3 text-xs"
          >
            {isArchiving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Archive</span>
          </Button>

          {selectedLeadIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHandbackDialog(true)}
              disabled={isArchiving || isHandingBack}
              className="gap-1 sm:gap-1.5 h-8 px-2 sm:px-3 text-xs border-primary text-primary hover:bg-primary/10"
            >
              {isHandingBack ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Hand to AI</span>
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 w-8 p-0 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.length} Conversation(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived conversations will be hidden from the main view but can be filtered to view later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Handback Confirmation Dialog */}
      <AlertDialog open={showHandbackDialog} onOpenChange={setShowHandbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hand Back {selectedLeadIds.length} Lead(s) to AI?</AlertDialogTitle>
            <AlertDialogDescription>
              The AI will resume managing these conversations and send a handback message to each lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkHandback} disabled={isHandingBack}>
              {isHandingBack ? 'Handing Back...' : 'Confirm Handback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
