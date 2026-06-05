import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface MessagePreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Array<{ id: string; name: string; phone?: string; email?: string }>;
  message: string;
  subject?: string;
  channel: string;
}

/**
 * Dialog to preview bulk message before sending
 * Shows message content and complete recipient list
 */
export function MessagePreviewDialog({
  isOpen,
  onOpenChange,
  recipients,
  message,
  subject,
  channel,
}: MessagePreviewDialogProps) {
  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'email':
        return '📧';
      case 'whatsapp':
        return '💬';
      case 'sms':
        return '📱';
      default:
        return '💬';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Preview</DialogTitle>
          <DialogDescription>
            Review your message and {recipients.length} recipient(s) before sending
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel Info */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{getChannelIcon(channel)}</span>
            <Badge variant="secondary" className="capitalize">
              {channel}
            </Badge>
            <span className="text-sm text-slate-600">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-900">Message</h3>
            {subject && (
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Subject:</p>
                <p className="font-medium text-sm">{subject}</p>
              </div>
            )}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 min-h-[100px]">
              <p className="text-sm text-slate-900 whitespace-pre-wrap">
                {message}
              </p>
            </div>
          </div>

          {/* Recipients List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-slate-900">Recipients</h3>
            <ScrollArea className="h-[300px] border rounded-lg p-3">
              <div className="space-y-2">
                {recipients.map((recipient, idx) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{recipient.name}</p>
                      <p className="text-xs text-slate-600">
                        {recipient.phone || recipient.email || 'No contact info'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 ml-2">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Summary */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              ✓ Ready to send message to <strong>{recipients.length}</strong> recipient
              {recipients.length !== 1 ? 's' : ''} via <strong>{channel}</strong>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
