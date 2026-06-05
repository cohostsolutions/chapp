import { useState, useEffect, useRef, useCallback } from 'react';
import { devError, devWarn } from '@/lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  UserCheck,
  Loader2,
  MessageSquare,
  Send,
  Phone,
  Mail,
  Bot,
  User,
  Check,
  CheckCheck,
  Clock,
  X,
  Volume2,
  CheckCircle2,
  Facebook,
  Instagram,
  ChevronDown,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCommunications, useSendSMS, useSendWhatsApp, useSendSocialMessage, useSendEmail, useInitiateCall, useMessageTemplates, useRealtimeCommunications, useMarkCommunicationsAsRead } from '@/hooks/useCommunications';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import type { CommunicationType } from '@/types/database';
import { QuickReplySelector } from '@/components/communications/QuickReplySelector';
import { ChatAttachmentUpload } from '@/components/communications/ChatAttachmentUpload';
import { AttachmentPreview, type Attachment, createAttachmentFromUpload } from '@/components/communications/AttachmentPreview';

// Notification sound URL
const NOTIFICATION_SOUND_URL = '/notification.mp3';

interface TakeoverChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
  organizationId: string;
  conversationId?: string;
  externalSenderId?: string | null;
  platform?: string;
  onTakeover?: () => void;
}

export function TakeoverChatDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
  leadEmail,
  organizationId,
  conversationId,
  externalSenderId,
  platform: conversationPlatform,
  onTakeover,
}: TakeoverChatDialogProps) {
  const { toast } = useToast();
  const { phonePlaceholder } = useOrganizationPhone();
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [isHandingBack, setIsHandingBack] = useState(false);
  const [hasTakenOver, setHasTakenOver] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<CommunicationType>('sms');
  const [message, setMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [phoneNumber, setPhoneNumber] = useState(leadPhone || '');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  
  // Refs for auto-scroll
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const activityScrollRef = useRef<HTMLDivElement>(null);
  const channelScrollRef = useRef<HTMLDivElement>(null);

  const getHistoryViewport = useCallback(() => {
    const root = aiScrollRef.current;
    return (root?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ?? null;
  }, []);

  const scrollHistoryToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const viewport = getHistoryViewport();
    if (!viewport) return;

    // Two RAFs ensures layout + scrollHeight are settled (Radix + flex layout)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      });
    });
  }, [getHistoryViewport]);

  const [showHistoryScrollToBottom, setShowHistoryScrollToBottom] = useState(false);
  // Track previous message counts for notifications
  const prevAiMessagesCount = useRef(0);
  const prevCommsCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notificationPermissionAskedRef = useRef(false);
  const canUseBrowserNotifications = typeof window !== 'undefined' && 'Notification' in window;

  // Ask for notification permission once so we can surface system notifications when the tab is backgrounded
  useEffect(() => {
    if (!canUseBrowserNotifications) return;
    setNotificationPermission(Notification.permission);
    if (Notification.permission === 'default' && !notificationPermissionAskedRef.current) {
      notificationPermissionAskedRef.current = true;
      Notification.requestPermission().then((perm) => setNotificationPermission(perm));
    }
  }, [canUseBrowserNotifications]);

  const notify = (title: string, description: string) => {
    if (canUseBrowserNotifications && notificationPermission === 'granted') {
      try {
        new Notification(title, { body: description, tag: leadId });
      } catch (err) {
        devWarn('Notification error', err);
      }
    }
    if (open) {
      toast({ title, description });
    }
  };

  // Fetch AI conversation messages - pass leadId to get full conversation history including communications
  const { messages: aiMessages, isLoading: isLoadingAIMessages } = useConversationMessages(conversationId || null, leadId);

  // Fetch communications with realtime updates
  const { data: communications, isLoading: isLoadingComms } = useCommunications(leadId, organizationId);
  useRealtimeCommunications(organizationId); // Enable realtime updates for communications
  const { data: templates } = useMessageTemplates(organizationId, activeTab);
  const sendSMS = useSendSMS();
  const sendWhatsApp = useSendWhatsApp();
  const sendSocialMessage = useSendSocialMessage();
  const sendEmail = useSendEmail();
  const initiateCall = useInitiateCall();
  const markAsRead = useMarkCommunicationsAsRead();

  useEffect(() => {
    if (!open) return;

    setPhoneNumber(leadPhone || '');
    setEmailSubject(`Re: Conversation with ${leadName}`);

    const normalizedPlatform = (conversationPlatform || '').toLowerCase();
    if (['sms', 'whatsapp', 'messenger', 'instagram', 'email'].includes(normalizedPlatform)) {
      setActiveTab(normalizedPlatform as CommunicationType);
    }
  }, [conversationPlatform, leadName, leadPhone, open]);
  
  // Track which communications have been marked as read
  const markedAsReadRef = useRef<Set<string>>(new Set());
  
  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    return () => {
      audioRef.current = null;
    };
  }, []);
  
  // Auto-scroll and notify for new AI messages
  useEffect(() => {
    if (isLoadingAIMessages || aiMessages.length === 0) return;

    const isNew = prevAiMessagesCount.current > 0 && aiMessages.length > prevAiMessagesCount.current;
    if (isNew) {
      const latestMessage = aiMessages[aiMessages.length - 1];
      const description = latestMessage.role === 'user'
        ? `${leadName}: ${latestMessage.content.substring(0, 50)}${latestMessage.content.length > 50 ? '...' : ''}`
        : `AI replied to ${leadName}`;

      if (open) {
        audioRef.current?.play().catch(() => {});
        toast({ title: "New AI Message", description });
      }

      // Fire browser/system notification when permission is granted (works even if tab is backgrounded)
      notify('New AI Message', description);
    }

    prevAiMessagesCount.current = aiMessages.length;

    if (open) {
      scrollHistoryToBottom('auto');
    }
  }, [aiMessages, isLoadingAIMessages, leadName, notify, open, scrollHistoryToBottom, toast]);

  // Ensure History snaps to bottom on open (even when data is cached)
  useEffect(() => {
    if (!open) return;
    if (isLoadingAIMessages || aiMessages.length === 0) return;
    scrollHistoryToBottom('auto');
  }, [open, isLoadingAIMessages, aiMessages.length, scrollHistoryToBottom]);

  // Show a "scroll to latest" button when the user scrolls up in the History panel
  useEffect(() => {
    if (!open) return;

    const viewport = getHistoryViewport();
    if (!viewport) return;

    let rafId = 0;
    const update = () => {
      const thresholdPx = 24;
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowHistoryScrollToBottom(distanceFromBottom > thresholdPx);
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    // Measure after layout settles
    requestAnimationFrame(() => requestAnimationFrame(update));

    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [open, aiMessages.length, getHistoryViewport]);

  // Auto-scroll and notify for new communications
  useEffect(() => {
    if (isLoadingComms || !communications || communications.length === 0) return;

    // Check if new communications arrived (not initial load)
    if (prevCommsCount.current > 0 && communications.length > prevCommsCount.current) {
      const latestComm = communications
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      // Only notify for inbound messages
      if (latestComm.direction === 'inbound') {
        // Play notification sound
        if (open) {
          audioRef.current?.play().catch(() => {});
        }
        
        const description = `From ${leadName}: ${(latestComm.content || latestComm.subject || '').substring(0, 50)}...`;
        notify(`New ${latestComm.channel.toUpperCase()} Message`, description);
      }
    }
    prevCommsCount.current = communications.length;
    
    // Auto-scroll activity timeline to top (newest first)
    if (activityScrollRef.current) {
      const scrollContainer = activityScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
    
    // Auto-scroll channel messages to bottom
    if (channelScrollRef.current) {
      const scrollContainer = channelScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [communications, isLoadingComms, leadName, notify, open]);
  
  // Mark inbound communications as read when dialog is open and communications are loaded
  useEffect(() => {
    if (!open || isLoadingComms || !communications || communications.length === 0) return;
    
    // Find inbound communications that haven't been marked as read yet
    const unreadInbound = communications.filter(
      comm => comm.direction === 'inbound' && 
              comm.status !== 'read' && 
              !markedAsReadRef.current.has(comm.id)
    );
    
    if (unreadInbound.length > 0) {
      const idsToMark = unreadInbound.map(c => c.id);
      
      // Mark them as read
      markAsRead.mutate(idsToMark, {
        onSuccess: () => {
          // Track which ones we've marked to avoid re-marking
          idsToMark.forEach(id => markedAsReadRef.current.add(id));
        }
      });
    }
  }, [open, communications, isLoadingComms, markAsRead]);
  
  // Reset the marked as read tracker when dialog closes
  useEffect(() => {
    if (!open) {
      markedAsReadRef.current.clear();
    }
  }, [open]);

  // Check if lead is already taken over
  useEffect(() => {
    if (open && leadId) {
      checkLeadStatus();
    }
  }, [open, leadId]);

  const checkLeadStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('is_ai_managed')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      setHasTakenOver(Boolean(data && !data.is_ai_managed));
    } catch (err) {
      devError('Failed to check lead status', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleTakeover = async () => {
    if (hasTakenOver || isCheckingStatus) return;
    setIsTakingOver(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.functions.invoke('agent-takeover', {
        body: { 
          leadId, 
          agentId: user.id,
          conversationId 
        }
      });

      if (error) throw error;

      setHasTakenOver(true);
      await checkLeadStatus();
      toast({
        title: "Conversation Taken Over",
        description: `You are now managing the conversation with ${leadName}. The AI has sent a handoff message.`,
      });

      onTakeover?.();
    } catch (error) {
      devError('Takeover error:', error);
      toast({
        title: "Takeover Failed",
        description: error instanceof Error ? error.message : "Failed to take over conversation",
        variant: "destructive"
      });
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleHandback = async () => {
    setIsHandingBack(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-handback', {
        body: { 
          leadId,
          conversationId 
        }
      });

      if (error) throw error;

      setHasTakenOver(false);
      toast({
        title: "Handed Back to AI",
        description: `The AI is now managing the conversation with ${leadName}.`,
      });
    } catch (error) {
      devError('Handback error:', error);
      toast({
        title: "Handback Failed",
        description: error instanceof Error ? error.message : "Failed to hand back to AI",
        variant: "destructive"
      });
    } finally {
      setIsHandingBack(false);
    }
  };

  const handleSend = async () => {
    if (!hasTakenOver) {
      toast({
        title: 'Take over required',
        description: 'Take over the conversation before sending messages.',
        variant: 'destructive'
      });
      return;
    }
    
    const needsPhone = activeTab === 'sms' || activeTab === 'whatsapp';
    const trimmedMessage = message.trim();
    const canSendMessage = trimmedMessage.length > 0 || pendingAttachments.length > 0;
    if (!canSendMessage) return;
    if (needsPhone && !phoneNumber) return;
    if (activeTab === 'email' && !leadEmail) return;

    try {
      const attachmentMarkers = pendingAttachments
        .map((attachment) => `[FILE:${attachment.url}|${attachment.name}]`)
        .join('\n');
      const fullMessage = trimmedMessage
        ? (attachmentMarkers ? `${trimmedMessage}\n${attachmentMarkers}` : trimmedMessage)
        : attachmentMarkers;

      if (activeTab === 'sms') {
        await sendSMS.mutateAsync({
          organizationId,
          leadId,
          toNumber: phoneNumber,
          message: fullMessage,
        });
      } else if (activeTab === 'whatsapp') {
        await sendWhatsApp.mutateAsync({
          organizationId,
          leadId,
          toNumber: phoneNumber,
          message: fullMessage,
        });
      } else if (activeTab === 'messenger') {
        if (!externalSenderId) {
          throw new Error('Missing Facebook recipient ID for this conversation');
        }
        await sendSocialMessage.mutateAsync({
          platform: 'messenger',
          organizationId,
          recipientId: externalSenderId,
          message: fullMessage,
          leadId, // Pass leadId for logging
        });
      } else if (activeTab === 'instagram') {
        if (!externalSenderId) {
          throw new Error('Missing Instagram recipient ID for this conversation');
        }
        await sendSocialMessage.mutateAsync({
          platform: 'instagram',
          organizationId,
          recipientId: externalSenderId,
          message: fullMessage,
          leadId, // Pass leadId for logging
        });
      } else if (activeTab === 'email') {
        if (!leadEmail) {
          throw new Error('No email address is available for this lead');
        }
        await sendEmail.mutateAsync({
          organizationId,
          leadId,
          to: leadEmail,
          subject: emailSubject.trim() || `Re: Conversation with ${leadName}`,
          message: fullMessage,
        });
      }

      const sentPreview = trimmedMessage || `${pendingAttachments.length} attachment${pendingAttachments.length === 1 ? '' : 's'}`;
      
      // Create notification for agent message sent (if lead is under agent control)
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from('notification_history').insert({
            user_id: userData.user.id,
            organization_id: organizationId,
            type: 'agent_message',
            title: `Message sent to ${leadName}`,
            message: `You sent a ${activeTab.toUpperCase()} message: "${sentPreview.substring(0, 50)}${sentPreview.length > 50 ? '...' : ''}"`,
            related_id: leadId,
            channel: activeTab,
          });
        }
      } catch (notifError) {
        devError('Failed to create notification:', notifError);
        // Don't fail the main operation
      }
      
      setMessage('');
      setPendingAttachments([]);
      setSelectedTemplate('');
      toast({
        title: "Message Sent",
        description: `Your ${activeTab.toUpperCase()} message has been sent.`,
      });
    } catch (error) {
      devError('Failed to send message:', error);
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleCall = async () => {
    if (!hasTakenOver) {
      toast({
        title: 'Take over required',
        description: 'Take over the conversation before placing calls.',
        variant: 'destructive'
      });
      return;
    }
    if (!phoneNumber) return;

    try {
      await initiateCall.mutateAsync({
        organizationId,
        leadId,
        toNumber: phoneNumber,
      });
      toast({
        title: "Call Initiated",
        description: "Connecting you to the lead...",
      });
    } catch (error) {
      devError('Failed to initiate call:', error);
      toast({
        title: "Call Failed",
        description: error instanceof Error ? error.message : "Failed to initiate call",
        variant: "destructive"
      });
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setMessage(template.content);
      setPendingAttachments(
        template.attachment_url && template.attachment_name
          ? [createAttachmentFromUpload({
              url: template.attachment_url,
              originalName: template.attachment_name,
            })]
          : []
      );
      setSelectedTemplate(templateId);
    }
  };

  const handleQuickReplySelect = (selection: { content: string; attachmentUrl?: string | null; attachmentName?: string | null }) => {
    setMessage(selection.content);
    setPendingAttachments(
      selection.attachmentUrl && selection.attachmentName
        ? [createAttachmentFromUpload({
            url: selection.attachmentUrl,
            originalName: selection.attachmentName,
          })]
        : []
    );
  };

  const handleAttachmentSelect = (uploadedAttachments: Array<{ url: string; originalName: string }>) => {
    const newAttachments = uploadedAttachments.map((attachment) => createAttachmentFromUpload(attachment));
    setPendingAttachments((currentAttachments) => [...currentAttachments, ...newAttachments]);
  };

  const removeAttachment = (indexToRemove: number) => {
    setPendingAttachments((currentAttachments) =>
      currentAttachments.filter((_, index) => index !== indexToRemove)
    );
  };

  const isSendingMessage = sendSMS.isPending || sendWhatsApp.isPending || sendSocialMessage.isPending || sendEmail.isPending;
  const canSendCurrentMessage = message.trim().length > 0 || pendingAttachments.length > 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
      case 'read':
        return <CheckCheck className="h-3 w-3" />;
      case 'failed':
        return <X className="h-3 w-3 text-destructive" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const filteredCommunications = communications?.filter((comm) => comm.channel === activeTab);
  
  // Count unread inbound messages
  const unreadCount = communications?.filter(
    comm => comm.direction === 'inbound' && comm.status !== 'read'
  ).length || 0;
  
  const handleMarkAllAsRead = () => {
    if (!communications) return;
    
    const unreadIds = communications
      .filter(comm => comm.direction === 'inbound' && comm.status !== 'read')
      .map(comm => comm.id);
    
    if (unreadIds.length > 0) {
      markAsRead.mutate(unreadIds, {
        onSuccess: () => {
          unreadIds.forEach(id => markedAsReadRef.current.add(id));
          toast({
            title: "All Messages Marked as Read",
            description: `${unreadIds.length} message(s) marked as read.`,
          });
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] lg:max-h-[90vh] flex flex-col p-3 lg:p-6 [&>button:last-child]:hidden">
        <DialogHeader className="pb-2 lg:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base lg:text-lg">
              <UserCheck className="h-4 w-4 lg:h-5 lg:w-5" />
              <span className="hidden sm:inline">{hasTakenOver ? 'Chat with' : 'Take Over Conversation with'} </span>
              <span className="sm:hidden">{hasTakenOver ? 'Chat:' : 'Takeover:'} </span>
              <span className="truncate max-w-[150px] sm:max-w-none">{leadName}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAsRead.isPending}
                  className="gap-1.5 text-xs"
                >
                  {markAsRead.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">Mark All as Read</span>
                  <span className="sm:hidden">Read All</span>
                  ({unreadCount})
                </Button>
              )}
              {/* Exit/Close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="gap-1.5 text-xs"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Exit</span>
              </Button>
            </div>
          </div>
          <DialogDescription className="text-xs lg:text-sm">
            {hasTakenOver 
              ? 'You are now managing this conversation.'
              : 'Review the AI conversation and take over to start communicating directly.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-2 lg:gap-4 overflow-hidden min-h-0">
          {/* Takeover Banner - Compact on mobile */}
          {!hasTakenOver && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 lg:p-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-200 text-sm lg:text-base">Ready to take over?</p>
                  <p className="text-xs lg:text-sm text-amber-700 dark:text-amber-300 hidden sm:block">
                    The AI will send a handoff message and switch to reactive mode.
                  </p>
                </div>
                <Button 
                  onClick={handleTakeover} 
                  disabled={isTakingOver || hasTakenOver || isCheckingStatus}
                  className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-8 lg:h-9 text-xs lg:text-sm"
                  size="sm"
                >
                  {isTakingOver ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Taking Over...
                    </>
                  ) : isCheckingStatus ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                      Take Over Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Handback Banner - Compact on mobile */}
          {hasTakenOver && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 lg:p-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-primary text-sm lg:text-base">You're managing this conversation</p>
                  <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
                    Hand it back to the AI when you're done to resume automated responses.
                  </p>
                </div>
                <Button 
                  onClick={handleHandback} 
                  disabled={isHandingBack}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10 shrink-0 h-8 lg:h-9 text-xs lg:text-sm"
                  size="sm"
                >
                  {isHandingBack ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Handing Back...
                    </>
                  ) : (
                    <>
                      <Bot className="h-3.5 w-3.5 mr-1.5" />
                      Hand Back to AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Main Content: Unified Conversation + Communication Channels */}
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-2 lg:gap-4 overflow-hidden min-h-0">
            {/* Unified Conversation History (AI + Agent messages merged) */}
            <div className="flex flex-col border rounded-lg overflow-hidden min-h-[180px] lg:min-h-0 flex-1 lg:flex-none relative">
              <div className="bg-muted px-2 lg:px-3 py-1.5 lg:py-2 border-b flex items-center justify-between shrink-0">
                <h3 className="font-medium flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm">
                  <MessageSquare className="h-3 w-3 lg:h-4 lg:w-4" />
                  <span className="hidden sm:inline">Conversation History</span>
                  <span className="sm:hidden">History</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {aiMessages.length}
                  </Badge>
                </h3>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={aiMessages.length === 0}
                    onClick={() => scrollHistoryToBottom('smooth')}
                    aria-label="Scroll to latest message"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>

                  {isCheckingStatus && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </span>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 p-2 lg:p-3" ref={aiScrollRef}>
                {isLoadingAIMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : aiMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Display unified messages from useConversationMessages (already merged AI + communications) */}
                    {aiMessages.map((msg) => {
                      const isBot = msg.role === 'assistant';
                      const isAgent = msg.role === 'agent';
                      const isUser = msg.role === 'user';
                      const metadata = msg.metadata as Record<string, unknown> | null;
                      const isHandoff = metadata?.type === 'handoff';
                      const isHandback = metadata?.type === 'handback';
                      const channel = msg.channel;
                      const isFromComms = msg.source === 'communications';

                      return (
                        <div
                          key={`${msg.source}-${msg.id}`}
                          className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isHandoff || isHandback ? 'bg-amber-100 dark:bg-amber-900/30' :
                            isAgent ? 'bg-blue-100 dark:bg-blue-900/30' :
                            isBot ? 'bg-primary/10' : 
                            'bg-secondary'
                          }`}>
                            {isHandoff || isHandback ? (
                              <UserCheck className="h-3 w-3 text-amber-600" />
                            ) : isAgent ? (
                              <User className="h-3 w-3 text-blue-600" />
                            ) : isBot ? (
                              <Bot className="h-3 w-3 text-primary" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                          </div>
                          <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
                            {/* Channel/Source badge */}
                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                              {channel && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                                  {channel}
                                </Badge>
                              )}
                              {isHandoff && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Handoff
                                </Badge>
                              )}
                              {isHandback && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Handback
                                </Badge>
                              )}
                              {isAgent && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  Agent
                                </Badge>
                              )}
                              {isBot && !isAgent && msg.role === 'assistant' && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-primary">
                                  AI
                                </Badge>
                              )}
                            </div>
                            <div className={`inline-block rounded-lg px-2 py-1.5 text-xs ${
                              isHandoff || isHandback
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                                : isAgent
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                                : isBot
                                ? 'bg-muted text-foreground'
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(msg.created_at), 'MMM d, p')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {showHistoryScrollToBottom && (
                <div className="absolute bottom-2 right-2 z-10">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow"
                    onClick={() => scrollHistoryToBottom('smooth')}
                    aria-label="Scroll to latest message"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Communication Channels */}
            <div className="flex flex-col border rounded-lg overflow-hidden min-h-[200px] lg:min-h-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CommunicationType)} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-6 rounded-none border-b h-9 shrink-0">
                  <TabsTrigger value="sms" className="rounded-none text-[10px] lg:text-xs px-0.5 lg:px-1 h-full">SMS</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="rounded-none text-[10px] lg:text-xs px-0.5 lg:px-1 h-full">
                    <span className="hidden sm:inline">WhatsApp</span>
                    <span className="sm:hidden">WA</span>
                  </TabsTrigger>
                  <TabsTrigger value="messenger" className="rounded-none text-[10px] lg:text-xs px-0.5 lg:px-1 h-full gap-0.5">
                    <Facebook className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger value="instagram" className="rounded-none text-[10px] lg:text-xs px-0.5 lg:px-1 h-full gap-0.5">
                    <Instagram className="h-3 w-3" />
                  </TabsTrigger>
                  <TabsTrigger value="email" className="rounded-none text-[10px] lg:text-xs px-0.5 lg:px-1 h-full">Email</TabsTrigger>
                  <TabsTrigger value="call" className="rounded-none text-[10px] lg:text-xs px-0.5 lg:px-1 h-full">Call</TabsTrigger>
                </TabsList>

                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                  {activeTab === 'call' ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="call-phone">Phone Number</Label>
                        <Input
                          id="call-phone"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder={phonePlaceholder}
                        />
                      </div>
                      <Button 
                        onClick={handleCall} 
                        disabled={!phoneNumber || initiateCall.isPending || !hasTakenOver} 
                        className="w-full"
                      >
                        {initiateCall.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4 mr-2" />
                        )}
                        Initiate Call
                      </Button>
                      {!hasTakenOver && (
                        <p className="text-sm text-muted-foreground text-center">
                          Take over the conversation first to make calls.
                        </p>
                      )}
                    </div>
                  ) : activeTab === 'email' ? (
                    <div className="space-y-4">
                      <div>
                        <Label>Lead Email</Label>
                        <Input value={leadEmail || 'No email on file'} disabled />
                      </div>
                      <div>
                        <Label htmlFor="email-subject">Subject</Label>
                        <Input
                          id="email-subject"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Re: Conversation"
                          disabled={!hasTakenOver || !leadEmail}
                        />
                      </div>
                      {templates && templates.length > 0 && (
                        <div>
                          <Label className="text-xs">Template</Label>
                          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Use template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <AttachmentPreview attachments={pendingAttachments} onRemove={removeAttachment} />
                      <div className="flex items-start gap-2">
                        <div className="flex items-center gap-1 shrink-0 pt-1">
                          <QuickReplySelector
                            organizationId={organizationId}
                            channel={activeTab}
                            leadData={{ name: leadName, email: leadEmail || undefined, phone: leadPhone || undefined }}
                            onSelect={handleQuickReplySelect}
                            disabled={!hasTakenOver || !leadEmail}
                          />
                          <ChatAttachmentUpload
                            onAttachmentSelect={handleAttachmentSelect}
                            disabled={!hasTakenOver || !leadEmail}
                            pendingCount={pendingAttachments.length}
                          />
                        </div>
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={hasTakenOver ? 'Type your email message...' : 'Take over first to send messages'}
                          rows={5}
                          className="text-sm flex-1"
                          disabled={!hasTakenOver || !leadEmail}
                        />
                      </div>
                      <Button
                        onClick={handleSend}
                        disabled={!hasTakenOver || !leadEmail || !canSendCurrentMessage || isSendingMessage}
                        className="w-full"
                      >
                        {isSendingMessage ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4 mr-2" />
                        )}
                        Send Email
                      </Button>
                      {!leadEmail && (
                        <p className="text-sm text-muted-foreground text-center">
                          No email address is available for this lead.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Message History */}
                      <ScrollArea className="flex-1 border rounded-lg p-3 mb-3" ref={channelScrollRef}>
                        {isLoadingComms ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : filteredCommunications?.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8 text-sm">
                            No {activeTab} messages yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {filteredCommunications?.map((comm) => (
                              <div
                                key={comm.id}
                                className={`p-2 rounded-lg text-sm ${
                                  comm.direction === 'outbound'
                                    ? 'bg-primary text-primary-foreground ml-auto max-w-[85%]'
                                    : 'bg-muted max-w-[85%]'
                                }`}
                              >
                                <p className="whitespace-pre-wrap">{comm.content}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs opacity-70">
                                    {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                                  </span>
                                  {comm.direction === 'outbound' && getStatusIcon(comm.status || 'pending')}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      {/* Compose Area */}
                      <div className="space-y-2">
                        {/* Phone input - only for SMS/WhatsApp */}
                        {(activeTab === 'sms' || activeTab === 'whatsapp') && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="phone" className="text-xs">Phone</Label>
                              <Input
                                id="phone"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder={phonePlaceholder}
                                className="h-8 text-sm"
                              />
                            </div>
                            {templates && templates.length > 0 && (
                              <div>
                                <Label className="text-xs">Template</Label>
                                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Use template" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {templates.map((template) => (
                                      <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Info for Messenger/Instagram */}
                        {(activeTab === 'messenger' || activeTab === 'instagram') && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            <p>Replying to {leadName} via {activeTab === 'messenger' ? 'Facebook Messenger' : 'Instagram DM'}</p>
                            {!externalSenderId && (
                              <p className="mt-1 text-destructive">
                                This conversation is missing the platform recipient ID required to send a reply.
                              </p>
                            )}
                          </div>
                        )}

                        <AttachmentPreview attachments={pendingAttachments} onRemove={removeAttachment} />

                        <div className="flex items-start gap-2">
                          <div className="flex items-center gap-1 shrink-0 pt-1">
                            <QuickReplySelector
                              organizationId={organizationId}
                              channel={activeTab}
                              leadData={{ name: leadName, email: leadEmail || undefined, phone: leadPhone || undefined }}
                              onSelect={handleQuickReplySelect}
                              disabled={!hasTakenOver}
                            />
                            <ChatAttachmentUpload
                              onAttachmentSelect={handleAttachmentSelect}
                              disabled={!hasTakenOver}
                              pendingCount={pendingAttachments.length}
                            />
                          </div>
                          <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={hasTakenOver ? `Type your ${activeTab} message...` : 'Take over first to send messages'}
                            rows={2}
                            className="text-sm flex-1"
                            disabled={!hasTakenOver || ((activeTab === 'messenger' || activeTab === 'instagram') && !externalSenderId)}
                          />
                        </div>

                        <Button
                          onClick={handleSend}
                          disabled={
                            !canSendCurrentMessage || 
                            ((activeTab === 'sms' || activeTab === 'whatsapp') && !phoneNumber) ||
                            isSendingMessage ||
                            !hasTakenOver
                          }
                          className="w-full"
                          size="sm"
                        >
                          {isSendingMessage ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send {activeTab === 'messenger' ? 'Messenger' : activeTab === 'instagram' ? 'Instagram DM' : activeTab.toUpperCase()}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
