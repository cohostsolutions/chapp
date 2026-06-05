import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { ChevronDown, Loader2, Phone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentPreview, createAttachmentFromUpload, type Attachment } from '@/components/communications/AttachmentPreview';
import { ChatAttachmentUpload } from '@/components/communications/ChatAttachmentUpload';
import { EmojiPicker } from '@/components/communications/EmojiPicker';
import { QuickReplySelector } from '@/components/communications/QuickReplySelector';
import { RichTextToolbar } from '@/components/communications/RichTextToolbar';
import { cn } from '@/lib/utils';
import type { AvailableNumber } from '@/lib/chatConfig';
import type { ChatConversation } from '@/hooks/useChatConversations';

interface QuickReplySelection {
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

interface ChatComposerProps {
  selectedChat: ChatConversation;
  isMobile: boolean;
  useSinglePanelLayout: boolean;
  selectedNumber: AvailableNumber;
  availableNumbers: AvailableNumber[];
  onSelectNumber: (number: AvailableNumber) => void;
  pendingAttachments: Attachment[];
  setPendingAttachments: (attachments: Attachment[]) => void;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  activeFormats: string[];
  organizationId?: string;
  isSending: boolean;
  onFormat: (format: string) => void;
  onQuickReply: (selection: QuickReplySelection) => void;
  onEmojiSelect: (emoji: string) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  messageInput: string;
  onMessageInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyPress: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onSendMessage: () => void;
}

export function ChatComposer({
  selectedChat,
  isMobile,
  useSinglePanelLayout,
  selectedNumber,
  availableNumbers,
  onSelectNumber,
  pendingAttachments,
  setPendingAttachments,
  isInputFocused,
  setIsInputFocused,
  activeFormats,
  organizationId,
  isSending,
  onFormat,
  onQuickReply,
  onEmojiSelect,
  inputRef,
  messageInput,
  onMessageInputChange,
  onKeyPress,
  onInputFocus,
  onInputBlur,
  onSendMessage,
}: ChatComposerProps) {
  return (
    <div className="border-t border-border bg-gradient-to-b from-background via-background to-muted/20 p-2 lg:p-4">
      {selectedChat.channel.toLowerCase() === 'sms' && selectedChat.phone && !useSinglePanelLayout && (
        <div className="flex items-center gap-2 mb-2 lg:mb-3">
          <span className="text-xs lg:text-sm text-muted-foreground">From:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 lg:gap-2 text-xs lg:text-sm h-8">
                <Phone className="w-3 h-3" />
                <span className="hidden sm:inline">{selectedNumber.label}</span>
                <span className="sm:hidden">{selectedNumber.number.slice(-4)}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableNumbers.map((num) => (
                <DropdownMenuItem
                  key={num.id}
                  onClick={() => onSelectNumber(num)}
                  className={cn(selectedNumber.id === num.id && 'bg-secondary')}
                >
                  <div>
                    <p className="font-medium">{num.label}</p>
                    <p className="text-xs text-muted-foreground">{num.number}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isMobile ? (
        <div className="flex flex-col gap-2 rounded-[1.35rem] border border-border/70 bg-background/90 p-2 shadow-sm backdrop-blur-sm">
          {pendingAttachments.length > 0 && (
            <AttachmentPreview
              attachments={pendingAttachments}
              onRemove={(idx) => setPendingAttachments(pendingAttachments.filter((_, index) => index !== idx))}
            />
          )}
          <div className="flex items-end gap-1.5">
            <div className="flex-1 flex flex-col gap-1">
              {!isInputFocused && (
                <div className="flex items-center gap-0.5 overflow-x-auto px-1 pb-1 animate-fade-in [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <RichTextToolbar onFormat={onFormat} activeFormats={activeFormats} disabled={isSending} />
                  <QuickReplySelector
                    organizationId={organizationId}
                    channel={selectedChat.channel}
                    leadData={{
                      name: selectedChat.leadName,
                      email: selectedChat.email,
                      phone: selectedChat.phone,
                    }}
                    onSelect={onQuickReply}
                    disabled={isSending}
                  />
                  <EmojiPicker onEmojiSelect={onEmojiSelect} disabled={isSending} />
                  <ChatAttachmentUpload
                    disabled={isSending}
                    pendingCount={pendingAttachments.length}
                    onAttachmentSelect={(uploaded) => {
                      if (!uploaded || uploaded.length === 0) return;
                      const newAttachments = uploaded.map((attachment) => createAttachmentFromUpload(attachment));
                      setPendingAttachments([...pendingAttachments, ...newAttachments]);
                    }}
                  />
                </div>
              )}
              <Textarea
                ref={inputRef}
                placeholder="Message..."
                value={messageInput}
                onChange={onMessageInputChange}
                onKeyDown={onKeyPress}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                className={cn(
                  'rounded-2xl border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-primary resize-none transition-all duration-200',
                  isInputFocused ? 'min-h-[88px] max-h-[200px]' : 'min-h-[44px] max-h-[88px]'
                )}
                disabled={isSending}
                rows={1}
              />
            </div>
            <Button
              variant="glow"
              onClick={onSendMessage}
              disabled={(!messageInput.trim() && pendingAttachments.length === 0) || isSending}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-2xl"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {isInputFocused && (
            <div className="flex items-center gap-1 px-1 animate-fade-in">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-xl px-2 text-xs text-muted-foreground"
                onClick={() => setIsInputFocused(false)}
              >
                Show tools
              </Button>
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground">{messageInput.length} chars</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {pendingAttachments.length > 0 && (
            <AttachmentPreview
              attachments={pendingAttachments}
              onRemove={(idx) => setPendingAttachments(pendingAttachments.filter((_, index) => index !== idx))}
              className="mb-2"
            />
          )}
          <div className={cn(
            'flex items-end gap-1.5 rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm transition-all duration-200',
            (isInputFocused || messageInput.trim()) && 'ring-1 ring-primary'
          )}>
            {!isInputFocused && !messageInput.trim() && (
              <div className="flex items-center gap-0.5 shrink-0 animate-fade-in">
                <RichTextToolbar onFormat={onFormat} activeFormats={activeFormats} disabled={isSending} compact />
                <div className="w-px h-5 bg-border mx-0.5" />
                <QuickReplySelector
                  organizationId={organizationId}
                  channel={selectedChat.channel}
                  leadData={{
                    name: selectedChat.leadName,
                    email: selectedChat.email,
                    phone: selectedChat.phone,
                  }}
                  onSelect={onQuickReply}
                  disabled={isSending}
                />
                <EmojiPicker onEmojiSelect={onEmojiSelect} disabled={isSending} />
                <ChatAttachmentUpload
                  disabled={isSending}
                  pendingCount={pendingAttachments.length}
                  onAttachmentSelect={(uploaded) => {
                    if (!uploaded || uploaded.length === 0) return;
                    const newAttachments = uploaded.map((attachment) => createAttachmentFromUpload(attachment));
                    setPendingAttachments([...pendingAttachments, ...newAttachments]);
                  }}
                />
              </div>
            )}
            <Textarea
              ref={inputRef}
              placeholder={`Message ${selectedChat.leadName}... (Enter to send)`}
              value={messageInput}
              onChange={onMessageInputChange}
              onKeyDown={onKeyPress}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              className={cn(
                'flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none px-1 py-1.5 transition-all duration-200',
                (isInputFocused || messageInput.trim()) ? 'min-h-[60px] max-h-[120px]' : 'min-h-[36px] max-h-[60px]'
              )}
              disabled={isSending}
              rows={1}
            />
            <Button
              variant="glow"
              onClick={onSendMessage}
              disabled={(!messageInput.trim() && pendingAttachments.length === 0) || isSending}
              size="icon"
              className="shrink-0 h-10 w-10 rounded-xl"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Enter to send • Shift+Enter for new line • via {selectedChat.channel}
          </p>
        </>
      )}
    </div>
  );
}