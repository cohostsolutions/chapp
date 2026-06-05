import { useState } from 'react';
import { LeadContextMenu } from './LeadContextMenu';
import {
  CreateCallDialog,
  CreateEmailDialog,
  CreateMeetingDialog,
} from './CreateActivityDialogs';
import { useLeadStatusUpdate } from '@/hooks/useLeadStatusUpdate';
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

export interface LeadQuickActionsProps {
  leadId: string;
  leadName: string;
  onActionSuccess?: () => void;
  children: React.ReactNode;
}

/**
 * Wrapper component that provides all quick action modals and dialogs
 * Attach to any lead item that you want to have context menu actions
 */
export function LeadQuickActions({
  leadId,
  leadName,
  onActionSuccess,
  children,
}: LeadQuickActionsProps) {
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [showWonDialog, setShowWonDialog] = useState(false);
  const [showLostDialog, setShowLostDialog] = useState(false);

  const { updateLeadStatus, isLoading } = useLeadStatusUpdate();

  const handleMarkWon = async () => {
    const success = await updateLeadStatus(leadId, 'converted');
    if (success) {
      setShowWonDialog(false);
      onActionSuccess?.();
    }
  };

  const handleMarkLost = async () => {
    const success = await updateLeadStatus(leadId, 'lost');
    if (success) {
      setShowLostDialog(false);
      onActionSuccess?.();
    }
  };

  return (
    <>
      {/* Context Menu with Quick Actions */}
      <LeadContextMenu
        leadId={leadId}
        leadName={leadName}
        onCreateCall={() => setShowCallDialog(true)}
        onCreateEmail={() => setShowEmailDialog(true)}
        onCreateMeeting={() => setShowMeetingDialog(true)}
        onMarkWon={() => setShowWonDialog(true)}
        onMarkLost={() => setShowLostDialog(true)}
      >
        {children}
      </LeadContextMenu>

      {/* Activity Dialogs */}
      <CreateCallDialog
        leadId={leadId}
        leadName={leadName}
        isOpen={showCallDialog}
        onOpenChange={setShowCallDialog}
        onSuccess={onActionSuccess}
      />

      <CreateEmailDialog
        leadId={leadId}
        leadName={leadName}
        isOpen={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        onSuccess={onActionSuccess}
      />

      <CreateMeetingDialog
        leadId={leadId}
        leadName={leadName}
        isOpen={showMeetingDialog}
        onOpenChange={setShowMeetingDialog}
        onSuccess={onActionSuccess}
      />

      {/* Deal Status Confirmation Dialogs */}
      <AlertDialog open={showWonDialog} onOpenChange={setShowWonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Deal as Won?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {leadName}'s status to "Converted". This action cannot be undone
              from here (you can update it in the lead details).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkWon}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Updating...' : 'Mark as Won'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Deal as Lost?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {leadName}'s status to "Lost". This action cannot be undone from
              here (you can update it in the lead details).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkLost}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Updating...' : 'Mark as Lost'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
