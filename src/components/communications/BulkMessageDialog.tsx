import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useBulkMessageDraft } from '@/hooks/useBulkMessageDraft';
import { MessagePreviewDialog } from './MessagePreviewDialog';
import { Search, AlertTriangle, Send } from 'lucide-react';

export interface BulkMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Array<{ id: string; name: string; phone?: string; email?: string; channel?: string }>;
  onSendMessages: (recipients: string[], message: string, channel?: string, subject?: string) => Promise<void>;
}

const MAX_RECIPIENTS = 100;
const PLATFORM_LIMITS: Record<string, number> = {
  whatsapp: 256, // WhatsApp Business API limit
  sms: 160,
  email: 500,
};

/**
 * Dialog for sending bulk messages to multiple leads
 * Includes draft management, preview, and recipient selection
 */
export function BulkMessageDialog({
  isOpen,
  onOpenChange,
  leads,
  onSendMessages,
}: BulkMessageDialogProps) {
  const { toast } = useToast();
  const { saveDraft, deleteDraft, getRecentDraft } = useBulkMessageDraft();

  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [messageContent, setMessageContent] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('sms');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Get effective limit based on channel
  const recipientLimit = useMemo(() => {
    return PLATFORM_LIMITS[selectedChannel] || MAX_RECIPIENTS;
  }, [selectedChannel]);

  // Filtered leads based on search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone?.includes(searchQuery) ||
        l.email?.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  // Load recent draft on open
  useEffect(() => {
    if (isOpen) {
      const recent = getRecentDraft();
      if (recent && recent.content) {
        setMessageContent(recent.content);
        setSelectedLeads(new Set(recent.recipients));
        if (recent.channel) setSelectedChannel(recent.channel);
        if (recent.subject) setMessageSubject(recent.subject);
      }
    }
  }, [isOpen, getRecentDraft]);

  const handleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  const handleToggleLead = (leadId: string) => {
    if (selectedLeads.size >= recipientLimit && !selectedLeads.has(leadId)) {
      toast({
        title: 'Recipient limit reached',
        description: `Maximum ${recipientLimit} recipients for ${selectedChannel}`,
        variant: 'destructive',
      });
      return;
    }
    const next = new Set(selectedLeads);
    if (next.has(leadId)) {
      next.delete(leadId);
    } else {
      next.add(leadId);
    }
    setSelectedLeads(next);
  };

  const handleSendMessages = async () => {
    if (selectedLeads.size === 0) {
      toast({
        title: 'No recipients selected',
        description: 'Please select at least one lead',
        variant: 'destructive',
      });
      return;
    }

    if (!messageContent.trim()) {
      toast({
        title: 'Empty message',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      await onSendMessages(Array.from(selectedLeads), messageContent, selectedChannel, messageSubject);
      // Clear draft after successful send
      deleteDraft(`draft-${selectedLeads.size}`);
      // Reset form
      setSelectedLeads(new Set());
      setMessageContent('');
      setMessageSubject('');
      setSelectedChannel('sms');
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Failed to send messages',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const hasUnsavedChanges =
    selectedLeads.size > 0 || messageContent.trim().length > 0;

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmExit = () => {
    // Save draft before closing
    if (messageContent.trim() || selectedLeads.size > 0) {
      saveDraft(Array.from(selectedLeads), messageContent, {
        subject: messageSubject,
        channel: selectedChannel,
      });
      toast({
        title: 'Draft saved',
        description: 'Your message draft has been saved locally',
      });
    }
    setShowUnsavedWarning(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Bulk Message</DialogTitle>
            <DialogDescription>
              Send a message to multiple leads. Maximum {recipientLimit} recipients for{' '}
              {selectedChannel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Channel Selection */}
            <div className="space-y-2">
              <Label htmlFor="channel">Communication Channel</Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">📱 SMS</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject (for email) */}
            {selectedChannel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="Message subject..."
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                />
              </div>
            )}

            {/* Message Content */}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className="min-h-24"
              />
              <p className="text-xs text-slate-500">
                {messageContent.length} characters
              </p>
            </div>

            {/* Recipient Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Recipients ({selectedLeads.size}/{recipientLimit})</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedLeads.size === leads.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {selectedLeads.size >= recipientLimit && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-md flex gap-2 text-sm text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Recipient limit reached. Unselect leads to add more.</span>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-8"
                />
              </div>

              {/* Leads List */}
              <ScrollArea className="h-[300px] border rounded-md p-3 space-y-2">
                {filteredLeads.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No leads found
                  </p>
                ) : (
                  filteredLeads.map((lead) => (
                    <label
                      key={lead.id}
                      className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={() => handleToggleLead(lead.id)}
                        disabled={
                          selectedLeads.size >= recipientLimit &&
                          !selectedLeads.has(lead.id)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-xs text-slate-500">
                          {lead.phone || lead.email || 'No contact info'}
                        </p>
                      </div>
                      {lead.channel && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {lead.channel}
                        </Badge>
                      )}
                    </label>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCloseDialog}>
              {hasUnsavedChanges ? 'Save Draft & Close' : 'Close'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={selectedLeads.size === 0 || !messageContent.trim()}
            >
              Preview
            </Button>
            <Button
              onClick={handleSendMessages}
              disabled={
                selectedLeads.size === 0 ||
                !messageContent.trim() ||
                isSending
              }
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send Messages'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Warning */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Draft</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save your draft before
              exiting?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={handleConfirmExit}>
            Save & Exit
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={() => {
              setShowUnsavedWarning(false);
              setSelectedLeads(new Set());
              setMessageContent('');
              setMessageSubject('');
              onOpenChange(false);
            }}
          >
            Discard
          </AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message Preview */}
      <MessagePreviewDialog
        isOpen={showPreview}
        onOpenChange={setShowPreview}
        recipients={Array.from(selectedLeads).map(
          (id) => leads.find((l) => l.id === id)!
        )}
        message={messageContent}
        subject={messageSubject}
        channel={selectedChannel}
      />
    </>
  );
}
