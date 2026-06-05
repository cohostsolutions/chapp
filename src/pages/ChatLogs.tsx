import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { devError } from '@/lib/logger';
import { useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ChatLogsProvider, useChatLogsState, type SortOption, type AvailableNumber } from '@/hooks/useChatLogsState';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Phone, User, Loader2, MessageSquare, Mail, MessageCircle, Plus, Volume2, VolumeX, Facebook, Instagram, CheckCheck, ArrowUpDown, Pin, X, TrendingUp, Users, BedDouble, UserCheck, Undo2, Link2, ShoppingBag, Briefcase, Archive, RefreshCw, Bot } from 'lucide-react';
import { getAgentDisplayName, getTemperatureDisplay, maxAttachmentSizeBytes, allowedAttachmentTypes, availableChatNumbers } from '@/lib/chatConfig';
import { isArchivedConversationResurfaced, shouldDisplayConversationInActiveInbox } from '@/lib/chatConversationSummary';
// react-window removed - using native scrolling for better compatibility
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { LeadInfoDialog, LeadInfo } from '@/components/LeadInfoDialog';
import { CallPopup } from '@/components/CallPopup';
import { useAuth } from '@/contexts/AuthContext';
import { useChatConversations, ChatConversation, NewMessageInfo } from '@/hooks/useChatConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { devLog } from '@/lib/logger';
import { 
  useSendSMS, 
  useSendSocialMessage,
  useSendEmail,
  useRetryCommunication,
} from '@/hooks/useCommunications';
import {
  DropdownMenu,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { TypingIndicator } from '@/components/communications/TypingIndicator';
import { useTypingPresence } from '@/hooks/useTypingPresence';
import { Attachment } from '@/components/communications/AttachmentPreview';
import { BulkActionsBar } from '@/components/conversations/BulkActionsBar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseISO, isToday, isYesterday, format } from 'date-fns';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { ChatComposer } from '@/components/chats/ChatComposer';
import { ChatInboxSidebar } from '@/components/chats/ChatInboxSidebar';
import { ChatThreadHeader } from '@/components/chats/ChatThreadHeader';
import { useChatInboxNotifications } from '@/hooks/useChatInboxNotifications';
import { useChatInboxSidebarState } from '@/hooks/useChatInboxSidebarState';
import { useConversationDrafts } from '@/hooks/useConversationDrafts';
import { useSelectedConversationSync } from '@/hooks/useSelectedConversationSync';
import { buildChatPinStorageKey, readPinnedIdsFromStorage, writePinnedIdsToStorage } from '@/lib/chatPinStorage';

import { saveMessageReaction, removeMessageReaction, fetchMultipleMessageReactions } from '@/lib/messageReactions';

// Lazy load heavy dialog components
const NewMessageDialog = lazy(() => import('@/components/communications/NewMessageDialog').then(m => ({ default: m.NewMessageDialog })));
const TakeoverChatDialog = lazy(() => import('@/components/TakeoverChatDialog').then(m => ({ default: m.TakeoverChatDialog })));
const LinkToBookingDialog = lazy(() => import('@/components/conversations/LinkToBookingDialog').then(m => ({ default: m.LinkToBookingDialog })));
const BulkMessageDialog = lazy(() => import('@/components/communications/BulkMessageDialog').then(m => ({ default: m.BulkMessageDialog })));

const channels = [
  { id: 'all', label: 'All', icon: MessageCircle },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'messenger', label: 'Messenger', icon: Facebook },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'email', label: 'Email', icon: Mail },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'unread', label: 'Unread First' },
  { value: 'name', label: 'By Name' },
];

const formatConversationTime = (isoString: string): string => {
  const date = parseISO(isoString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d');
  }
};

export default function ChatLogs() {
  return (
    <ErrorBoundary fullPage>
      <ChatLogsProvider>
        <ChatLogsContent />
      </ChatLogsProvider>
    </ErrorBoundary>
  );
}

function ChatLogsContent() {
  const { profile, aiAgentType } = useAuth();
  const { state, dispatch } = useChatLogsState();
  const { toast } = useToast();
  
  // Compatibility layer - map state to local variables for minimal refactoring
  const selectedChat = state.selection.selectedChat;
  const messageInput = state.input.messageInput;
  const searchTerm = state.filters.searchTerm;
  const debouncedSearchTerm = state.filters.debouncedSearchTerm;
  const pendingAttachments = state.input.pendingAttachments;
  const leadDialogOpen = state.dialogs.leadDialogOpen;
  const callPopupOpen = state.dialogs.callPopupOpen;
  const newMessageDialogOpen = state.dialogs.newMessageDialogOpen;
  const showTakeoverDialog = state.dialogs.showTakeoverDialog;
  const linkDialogOpen = state.dialogs.linkDialogOpen;
  const bulkMessageDialogOpen = state.dialogs.bulkMessageDialogOpen;
  const selectedLead = state.selection.selectedLead;
  const callTarget = state.selection.callTarget;
  const soundEnabled = state.status.soundEnabled;
  const messageReactions = state.messages.messageReactions;
  const activeFormats = state.input.activeFormats;
  const highlightedMessageId = state.input.highlightedMessageId;
  const sortBy = state.filters.sortBy;
  const pinnedConversations = state.filters.pinnedConversations;
  const archivedOnly = state.filters.archivedOnly;
  const selectedConversationIds = state.bulkSelection.selectedConversationIds;
  const selectedConversationLeadIds = state.bulkSelection.selectedConversationLeadIds;
  const selectedChannel = state.selection.selectedChannel;
  const agentManagedFilter = state.filters.agentManagedFilter;
  const unreadFilter = state.filters.unreadFilter;
  const conversationForTakeover = state.selection.conversationForTakeover;
  const conversationForLinking = state.selection.conversationForLinking;
  const isRefreshing = state.status.isRefreshing;
  const isSending = state.status.isSending;
  const isInputFocused = state.ui.isInputFocused;
  const showScrollToBottom = state.ui.showScrollToBottom;
  const selectedNumber = state.selection.selectedNumber;
  const convVisibleRange = state.status.convVisibleRange;
  const isTablet = state.ui.isTablet;
  
  // Available numbers for SMS
  const availableNumbers: AvailableNumber[] = availableChatNumbers;
  
  // Setter compatibility functions
  const setMessageInput = (value: string) => dispatch({ type: 'SET_MESSAGE_INPUT', payload: value });
  const setSearchTerm = (value: string) => dispatch({ type: 'SET_SEARCH_TERM', payload: value });
  const setPendingAttachments = (attachments: Attachment[]) => 
    dispatch({ type: 'SET_PENDING_ATTACHMENTS', payload: attachments });
  const setLeadDialogOpen = (open: boolean) => 
    open ? dispatch({ type: 'OPEN_DIALOG', payload: 'lead' }) : dispatch({ type: 'CLOSE_DIALOG', payload: 'lead' });
  const setCallPopupOpen = (open: boolean) =>
    open ? dispatch({ type: 'OPEN_DIALOG', payload: 'call' }) : dispatch({ type: 'CLOSE_DIALOG', payload: 'call' });
  const setNewMessageDialogOpen = (open: boolean) =>
    open ? dispatch({ type: 'OPEN_DIALOG', payload: 'newMessage' }) : dispatch({ type: 'CLOSE_DIALOG', payload: 'newMessage' });
  const setShowTakeoverDialog = (open: boolean) =>
    open ? dispatch({ type: 'OPEN_DIALOG', payload: 'takeover' }) : dispatch({ type: 'CLOSE_DIALOG', payload: 'takeover' });
  const setLinkDialogOpen = (open: boolean) =>
    open ? dispatch({ type: 'OPEN_DIALOG', payload: 'link' }) : dispatch({ type: 'CLOSE_DIALOG', payload: 'link' });
  const setBulkMessageDialogOpen = (open: boolean) =>
    open ? dispatch({ type: 'OPEN_DIALOG', payload: 'bulkMessage' }) : dispatch({ type: 'CLOSE_DIALOG', payload: 'bulkMessage' });
  const setSelectedChat = (chat: ChatConversation | null) => 
    dispatch({ type: 'SET_SELECTED_CHAT', payload: chat });
  const setSelectedLead = (lead: LeadInfo | null) =>
    dispatch({ type: 'SET_SELECTED_LEAD', payload: lead });
  const setCallTarget = (target: { name: string; phone: string; leadId?: string } | null) =>
    dispatch({ type: 'SET_CALL_TARGET', payload: target });
  const setSoundEnabled = (enabled: boolean) =>
    dispatch({ type: 'TOGGLE_SOUND', payload: enabled });
  const setMessageReactions = (reactions: Record<string, Record<string, string[]>>) =>
    dispatch({ type: 'SET_MESSAGE_REACTIONS', payload: reactions });
  const setActiveFormats = (formats: string[]) =>
    dispatch({ type: 'SET_ACTIVE_FORMATS', payload: formats });
  const setHighlightedMessageId = (id: string | null) =>
    dispatch({ type: 'SET_HIGHLIGHTED_MESSAGE_ID', payload: id });
  const setSortBy = (sort: SortOption) =>
    dispatch({ type: 'SET_SORT_BY', payload: sort });
  const setArchivedOnly = (archived: boolean) =>
    dispatch({ type: 'SET_ARCHIVED_ONLY', payload: archived });
  const setSelectedChannel = (channel: string) =>
    dispatch({ type: 'SET_SELECTED_CHANNEL', payload: channel });
  const setAgentManagedFilter = (filter: boolean | null) =>
    dispatch({ type: 'SET_AGENT_MANAGED_FILTER', payload: filter });
  const setUnreadFilter = (filter: boolean) =>
    dispatch({ type: 'SET_UNREAD_FILTER', payload: filter });
  const setConversationForTakeover = (conv: ChatConversation | null) =>
    dispatch({ type: 'SET_CONVERSATION_FOR_TAKEOVER', payload: conv });
  const setConversationForLinking = (conv: { leadId: string; leadName: string; date: string } | null) =>
    dispatch({ type: 'SET_CONVERSATION_FOR_LINKING', payload: conv });
  const setIsRefreshing = (refreshing: boolean) =>
    dispatch({ type: 'SET_IS_REFRESHING', payload: refreshing });
  const setIsSending = (sending: boolean) =>
    dispatch({ type: 'SET_IS_SENDING', payload: sending });
  const setIsInputFocused = (focused: boolean) =>
    dispatch({ type: 'SET_INPUT_FOCUSED', payload: focused });
  const setShowScrollToBottom = (show: boolean) =>
    dispatch({ type: 'SET_SHOW_SCROLL_TO_BOTTOM', payload: show });
  const setSelectedNumber = (number: AvailableNumber) =>
    dispatch({ type: 'SET_SELECTED_NUMBER', payload: number });
  const setConvVisibleRange = (range: { start: number; end: number }) =>
    dispatch({ type: 'SET_CONV_VISIBLE_RANGE', payload: range });
  const clearBulkSelection = () => dispatch({ type: 'CLEAR_BULK_SELECTION' });
  const toggleConversationSelection = (chatId: string, leadId?: string | null) =>
    dispatch({ type: 'TOGGLE_CONVERSATION_SELECTION', payload: { chatId, leadId: leadId || undefined } });
  
  // Bulk message send handler is defined after conversations is available
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  // Detect tablet via matchMedia to align with Tailwind breakpoints
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => 
      dispatch({ 
        type: 'SET_IS_TABLET',
        payload: 'matches' in e ? e.matches : (e as MediaQueryList).matches 
      });
    handler(query);
    const listener = (e: MediaQueryListEvent) => handler(e);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [dispatch]);

  const organizationId = profile?.organization_id;
  const userId = profile?.id;
  const userName = profile?.full_name || profile?.email;
  const draftsStorageKey = useMemo(() => `chatDrafts:${organizationId || 'org'}`, [organizationId]);
  const inboxPinStorageKey = useMemo(
    () => buildChatPinStorageKey({ scope: 'inbox-conversations', organizationId, userId }),
    [organizationId, userId],
  );
  const [hydratedInboxPinStorageKey, setHydratedInboxPinStorageKey] = useState<string | null>(null);

  // Log organization context for debugging data isolation issues
  useEffect(() => {
    if (profile) {
      devLog(`👤 User: ${userName} (${userId})`);
      devLog(`🏢 Organization ID: ${organizationId}`);
      if (!organizationId) {
        devError('⚠️ WARNING: User has no organization_id assigned. This will prevent data loading.');
      }
    }
  }, [profile, organizationId, userId, userName]);

  // Debounce search input to reduce render churn
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: state.filters.searchTerm.trim() }), 250);
    return () => clearTimeout(t);
  }, [state.filters.searchTerm, dispatch]);

  useEffect(() => {
    if (!inboxPinStorageKey) {
      dispatch({ type: 'SET_PINNED_CONVERSATIONS', payload: new Set() });
      setHydratedInboxPinStorageKey(null);
      return;
    }

    dispatch({
      type: 'SET_PINNED_CONVERSATIONS',
      payload: readPinnedIdsFromStorage(inboxPinStorageKey),
    });
    setHydratedInboxPinStorageKey(inboxPinStorageKey);
  }, [dispatch, inboxPinStorageKey]);

  useEffect(() => {
    if (!inboxPinStorageKey || hydratedInboxPinStorageKey !== inboxPinStorageKey) {
      return;
    }

    writePinnedIdsToStorage(inboxPinStorageKey, pinnedConversations);
  }, [hydratedInboxPinStorageKey, inboxPinStorageKey, pinnedConversations]);

  // Fetch real conversations
  const { conversations, isLoading: isLoadingConversations, refetch: refetchConversations, markAsRead, setOnNewMessage } = useChatConversations(organizationId);
  const {
    messages: selectedChatMessages,
    isLoading: isLoadingSelectedChatMessages,
    error: selectedChatMessagesError,
    refetch: refetchSelectedChatMessages,
  } = useConversationMessages(selectedChat?.id || null, selectedChat?.leadId || null);

  // CRITICAL: Sync selectedChat with latest conversations data when realtime updates arrive
  // This ensures the currently viewed chat shows new messages INSTANTLY
  // Use a ref to track the selected chat to prevent unnecessary re-renders
  const selectedChatRef = useRef<ChatConversation | null>(null);
  
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);
  
  useSelectedConversationSync({
    conversations,
    selectedChatRef,
    setSelectedChat,
    toast,
  });

  // Initialize audio for notifications
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (state.status.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => devLog('Audio play failed:', err));
    }
  }, [state.status.soundEnabled]);

  // Show browser notification
  const showBrowserNotification = useCallback((info: NewMessageInfo) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const truncatedContent = info.content.length > 50 
        ? info.content.substring(0, 50) + '...' 
        : info.content;
      
      const notification = new Notification(`New ${info.channel} message from ${info.senderName}`, {
        body: truncatedContent || 'New message received',
        icon: '/favicon.png',
        tag: 'new-message',
        requireInteraction: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, []);

  useChatInboxNotifications({
    selectedChatRef,
    setOnNewMessage,
    playNotificationSound,
    showBrowserNotification,
    toast,
  });

  // Handle bulk message sending
  const handleBulkMessageSend = useCallback(async (recipientIds: string[], message: string, channel?: string, subject?: string) => {
    if (!organizationId) {
      throw new Error('Organization not found');
    }

    try {
      setIsSending(true);
      
      // Get the lead info for each recipient
      const leads = conversations
        .filter(c => c.leadId && recipientIds.includes(c.leadId))
        .map(c => ({
          id: c.leadId!,
          name: c.leadName,
          phone: c.phone,
          email: c.email,
        }));

      const results = await Promise.allSettled(
        leads.map(async (lead) => {
          if (channel === 'sms' && lead.phone) {
            const { error } = await supabase.functions.invoke('send-sms', {
              body: {
                leadId: lead.id,
                message,
                to: lead.phone,
              },
            });
            if (error) throw error;
            return;
          }

          if (channel === 'email' && lead.email) {
            const { data, error } = await supabase.functions.invoke('send-email', {
              body: {
                to: lead.email,
                subject: subject || 'Message from AlCor Nexus',
                message,
                organizationId,
                leadId: lead.id,
              },
            });
            if (error || (data as { error?: string } | null)?.error) {
              throw error || new Error((data as { error?: string }).error);
            }
            return;
          }

          if (channel === 'whatsapp' && lead.phone) {
            const { data, error } = await supabase.functions.invoke('send-social-message', {
              body: {
                platform: 'whatsapp',
                organizationId,
                leadId: lead.id,
                recipientId: lead.phone,
                message,
              },
            });
            if (error || (data as { error?: string } | null)?.error) {
              throw error || new Error((data as { error?: string }).error);
            }
            return;
          }

          throw new Error(`Lead ${lead.name} is missing contact info for ${channel || 'the selected channel'}`);
        })
      );

      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      if (successCount === 0) {
        throw new Error('No messages were sent. Check recipient contact details and channel setup.');
      }

      await refetchConversations();
      
      toast({ 
        title: 'Messages sent', 
        description: failureCount > 0
          ? `Sent to ${successCount} recipient(s). ${failureCount} failed.`
          : `Sent to ${successCount} recipient${successCount !== 1 ? 's' : ''}`,
        variant: failureCount > 0 ? 'destructive' : 'default',
      });
      
      clearBulkSelection();
      setBulkMessageDialogOpen(false);
    } catch (error) {
      devError('Bulk send error:', error);
      toast({ 
        title: 'Send failed', 
        description: error instanceof Error ? error.message : 'Could not send bulk messages. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  }, [clearBulkSelection, conversations, organizationId, refetchConversations, toast, setIsSending]);

  // Mark messages as read when a conversation is selected
  useEffect(() => {
    if (selectedChat?.leadId && selectedChat.unread > 0) {
      void markAsRead(selectedChat.leadId);
    }
  }, [selectedChat?.id, selectedChat?.leadId, selectedChat?.unread, markAsRead]);

  // Auto-scroll to bottom when chat is selected or messages change,
  // but only if user is near the bottom (avoid jump while reading history)
  useEffect(() => {
    if (selectedChat && messagesEndRef.current && !showScrollToBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedChat?.id, selectedChatMessages.length, showScrollToBottom]);

  // Handle scroll position to show/hide scroll-to-bottom button
  const handleScrollChange = useCallback((event: Event) => {
    const target = event.target as HTMLDivElement;
    if (!target) return;
    
    const { scrollTop, scrollHeight, clientHeight } = target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Show button if scrolled more than 200px from bottom
    setShowScrollToBottom(distanceFromBottom > 200);
  }, []);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, []);

  // Typing presence
  const { typingUsers, setTyping } = useTypingPresence(
    selectedChat?.leadId || null,
    userId || null,
    userName || null
  );

  useConversationDrafts({
    selectedConversationId: selectedChat?.id,
    draftsStorageKey,
    messageInput,
    pendingAttachments,
    setMessageInput,
    setPendingAttachments,
  });

  // Cleanup typing indicator on unmount or when changing chats
  useEffect(() => {
    return () => {
      try {
        setTyping(false);
      } catch (err) {
        devLog('Failed to clear typing status', err);
      }
    };
  }, [setTyping, selectedChat?.id]);

  // Load reactions for messages when a chat is selected/updated
  useEffect(() => {
    const loadReactions = async () => {
      if (selectedChatMessages.length === 0) {
        setMessageReactions({});
        return;
      }
      const ids = selectedChatMessages
        .filter(m => m.source !== 'call')
        .map(m => m.id)
        .filter(Boolean);

      if (ids.length === 0) {
        setMessageReactions({});
        return;
      }

      try {
        const reactions = await fetchMultipleMessageReactions(ids);
        setMessageReactions(reactions);
      } catch (err) {
        devLog('Failed to load reactions', err);
      }
    };
    loadReactions();
  }, [selectedChat?.id, selectedChatMessages.length]);

  // Conversations data stays fresh via realtime + optimistic cache updates; avoid polling/refetch loops.

    // Additional typing safeguard when switching conversations
    const previousLeadIdRef = useRef<string | null>(null);
    useEffect(() => {
      const prev = previousLeadIdRef.current;
      const next = selectedChat?.leadId || null;
      if (prev && prev !== next) {
        try { setTyping(false); } catch { /* no-op */ }
      }
      previousLeadIdRef.current = next;
    }, [selectedChat?.leadId, setTyping]);
  const sendSMS = useSendSMS();
  const sendSocialMessage = useSendSocialMessage();
  const sendEmail = useSendEmail();
  const retry = useRetryCommunication();

  // Handle typing indicator on input change + auto-resize textarea
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setMessageInput(nextValue);
    if (nextValue.trim()) {
      setTyping(true);
    } else {
      setTyping(false);
    }
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // Handle input focus/blur for expandable UI
  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  const handleInputBlur = () => {
    setTyping(false);
    // Only collapse if input is empty
    if (!messageInput.trim()) {
      setIsInputFocused(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = messageInput.slice(0, start) + emoji + messageInput.slice(end);
      setMessageInput(newValue);
      // Set cursor position after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setMessageInput(messageInput + emoji);
    }
  };

  // Handle message reactions (persisted)
  const handleReaction = async (messageId: string, emoji: string, externalId?: string) => {
    if (!userId || !organizationId || !selectedChat) return;

    // Optimistic update
    const isRemoving = messageReactions[messageId]?.[emoji]?.includes(userId);
    const msgReactions = messageReactions[messageId] || {};
    const emojiUsers = msgReactions[emoji] || [];
    
    let newReactions: Record<string, Record<string, string[]>>;
    if (isRemoving) {
      newReactions = {
        ...messageReactions,
        [messageId]: {
          ...msgReactions,
          [emoji]: emojiUsers.filter(id => id !== userId)
        }
      };
    } else {
      newReactions = {
        ...messageReactions,
        [messageId]: {
          ...msgReactions,
          [emoji]: [...emojiUsers, userId]
        }
      };
    }
    setMessageReactions(newReactions);

    // Persist reaction to internal DB
    const previousReactions = messageReactions;
    try {
      if (isRemoving) {
        const removed = await removeMessageReaction(messageId, emoji, userId);
        if (!removed) {
          setMessageReactions(previousReactions);
          toast({
            title: 'Reaction failed',
            description: 'Could not remove reaction. Please try again.',
            variant: 'destructive',
          });
          return;
        }
      } else {
        const saved = await saveMessageReaction(organizationId, messageId, emoji, userId);
        if (!saved) {
          setMessageReactions(previousReactions);
          toast({
            title: 'Reaction failed',
            description: 'Could not save reaction. Please try again.',
            variant: 'destructive',
          });
          return;
        }
      }
    } catch (error) {
      devError('Failed to persist reaction:', error);
      setMessageReactions(previousReactions);
      toast({
        title: 'Reaction failed',
        description: 'Could not save reaction. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Sync to social platform if external ID exists
    if (externalId) {
      try {
        await supabase.functions.invoke('send-reaction', {
          body: {
            platform: selectedChat.channel.toLowerCase(),
            messageId: externalId,
            emoji,
            action: isRemoving ? 'unreact' : 'react',
            organizationId,
            communicationId: messageId,
          }
        });
      } catch (error) {
        devError('Failed to sync reaction:', error);
      }
    }
  };

  // Handle rich text formatting
  const handleFormat = (format: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = messageInput.slice(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `*${selectedText}*`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'underline':
        formattedText = `~${selectedText}~`;
        break;
      case 'list':
        formattedText = `\n• ${selectedText}`;
        break;
      default:
        formattedText = selectedText;
    }

    const newValue = messageInput.slice(0, start) + formattedText + messageInput.slice(end);
    setMessageInput(newValue);
    
    // Toggle format in active list
    const newFormats = activeFormats.includes(format)
      ? activeFormats.filter(f => f !== format)
      : [...activeFormats, format];
    setActiveFormats(newFormats);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };

  // Handle quick reply selection
  const handleQuickReply = (selection: { content: string; attachmentUrl?: string | null; attachmentName?: string | null }) => {
    setMessageInput(selection.content);
    // If the template has an attachment, add it to pending attachments
    if (selection.attachmentUrl && selection.attachmentName) {
      const attachment = createAttachmentFromUpload({
        url: selection.attachmentUrl,
        originalName: selection.attachmentName,
      });
      setPendingAttachments([...pendingAttachments, attachment]);
    }
    inputRef.current?.focus();
  };

  // Handle message search result click
  const handleSearchResultClick = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const messageEl = messageRefs.current[messageId];
    if (messageEl) {
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clear highlight after animation
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  // Handle URL search params to auto-select a conversation
  const [searchParams, setSearchParams] = useSearchParams();
  const leadIdFromUrl = searchParams.get('leadId');

  // Auto-select conversation from URL param
  useEffect(() => {
    if (leadIdFromUrl && conversations.length > 0 && !selectedChat) {
      const matchingConv = conversations.find(c => c.leadId === leadIdFromUrl);
      if (matchingConv) {
        setSelectedChat(matchingConv);
        // Clear the URL param after selection
        setSearchParams({}, { replace: true });
      } else {
        // Invalid or stale leadId in URL, clear and notify
        setSearchParams({}, { replace: true });
        toast({ title: 'Conversation not found', description: 'The conversation referenced in the URL no longer exists.', variant: 'destructive' });
      }
    }
  }, [leadIdFromUrl, conversations, selectedChat, setSearchParams, toast]);

  const handleViewLead = (chat: ChatConversation) => {
    if (!chat.leadId) return;
    setSelectedLead({
      id: chat.leadId,
      name: chat.leadName,
      phone: chat.phone,
      email: chat.email,
    });
    setLeadDialogOpen(true);
  };

  const {
    filteredAndSortedChats,
    stats,
    unreadCounts,
    getChannelCount,
    agentManagedCounts,
    hasActiveFilters,
  } = useChatInboxSidebarState({
    conversations,
    debouncedSearchTerm,
    selectedChannel,
    sortBy,
    pinnedConversations,
    agentManagedFilter,
    unreadFilter,
    archivedOnly,
    searchTerm,
  });

  // Toggle pin conversation
  const togglePinConversation = (conversationId: string) => {
    dispatch({ type: 'TOGGLE_PINNED_CONVERSATION', payload: conversationId });
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    const unreadConvs = conversations.filter(c => c.unread > 0 && c.leadId);
    if (unreadConvs.length === 0) {
      toast({ title: 'No unread messages' });
      return;
    }
    
    // Mark all in parallel
    await Promise.all(
      unreadConvs.map(conv => conv.leadId ? markAsRead(conv.leadId) : Promise.resolve())
    );
    
    // Force refetch to update UI
    await refetchConversations();
    toast({ title: 'All messages marked as read' });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedChannel('all');
    setAgentManagedFilter(null);
    setUnreadFilter(false);
    setArchivedOnly(false);
  };

  // Handle handback complete callback
  const handleHandbackComplete = () => {
    toast({ title: 'Handed back to AI', description: 'The conversation is now managed by AI.' });
    refetchConversations();
  };

  const handleRefreshInbox = async () => {
    setIsRefreshing(true);
    try {
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('backfill-facebook-messages', { body: {} });
      if (syncError) {
        devLog('Sync error:', syncError);
        toast({ title: 'Sync error', description: syncError.message, variant: 'destructive' });
        return;
      }

      devLog('Backfill result:', syncResult);
      const { data: processResult, error: processError } = await supabase.functions.invoke('process-pending-messages', { body: {} });
      if (processError) {
        devLog('Process pending error:', processError);
      } else {
        devLog('Process pending result:', processResult);
      }

      await refetchConversations();
      const msgCount = syncResult?.messages_recovered || 0;
      const aiSent = processResult?.ai_responses_sent || 0;
      toast({ title: 'Conversations synced', description: `Recovered ${msgCount} messages, sent ${aiSent} AI responses` });
    } catch (error) {
      devError('Refresh error:', error);
      toast({ title: 'Refresh failed', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleArchiveConversation = async (chat: ChatConversation) => {
    try {
      if (!chat.leadId) throw new Error('Missing leadId for archive');
      const { error } = await supabase.from('ai_conversations').update({ status: 'archived' }).eq('lead_id', chat.leadId);
      if (error) throw error;
      toast({ title: 'Conversation archived', description: `${chat.leadName} archived.` });
    } catch (error) {
      devError('Archive error:', error);
      toast({ title: 'Archive failed', variant: 'destructive' });
    }
  };

  const handleUnarchiveConversation = async (chat: ChatConversation) => {
    try {
      if (!chat.leadId) throw new Error('Missing leadId for unarchive');
      const { error } = await supabase.from('ai_conversations').update({ status: 'active' }).eq('lead_id', chat.leadId);
      if (error) throw error;
      toast({ title: 'Conversation unarchived', description: `${chat.leadName} restored.` });
    } catch (error) {
      devError('Unarchive error:', error);
      toast({ title: 'Unarchive failed', variant: 'destructive' });
    }
  };

  // Handle takeover action
  const handleTakeover = (chat: ChatConversation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConversationForTakeover(chat);
    setShowTakeoverDialog(true);
  };

  // Handle handback from context menu (for mobile/tablet)
  const handleHandbackFromContext = async (chat: ChatConversation) => {
    if (!chat.leadId) return;
    try {
      const { error } = await supabase.functions.invoke('agent-handback', {
        body: { lead_id: chat.leadId }
      });
      if (error) throw error;
      toast({ title: 'Handed back to AI', description: 'The conversation is now managed by AI.' });
      refetchConversations();
    } catch (error) {
      devError('Handback error:', error);
      toast({ 
        title: 'Handback failed', 
        description: 'Could not hand back to AI. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle link to booking/order/offering
  const handleLinkConversation = (chat: ChatConversation, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!chat.leadId) return;
    setConversationForLinking({
      leadId: chat.leadId,
      leadName: chat.leadName,
      date: chat.startedAt || chat.lastMessageAt,
    });
    setLinkDialogOpen(true);
  };

  // Get the link action label based on organization type
  const getLinkActionConfig = () => {
    switch (aiAgentType) {
      case 'jay': return { label: 'Link to Order', icon: ShoppingBag, color: 'text-green-600 border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' };
      case 'may': return { label: 'Link to Offering', icon: Briefcase, color: 'text-purple-600 border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20' };
      default: return { label: 'Link to Booking', icon: Link2, color: 'text-primary border-primary hover:bg-primary/10' };
    }
  };
  const linkConfig = getLinkActionConfig();
  const agentName = getAgentDisplayName(aiAgentType || 'ai');

  const handleCallLead = (chat: ChatConversation) => {
    setCallTarget({ name: chat.leadName, phone: chat.phone, leadId: chat.leadId || undefined });
    setCallPopupOpen(true);
  };

  const handleSendMessage = async () => {
    const hasContent = messageInput.trim() || pendingAttachments.length > 0;
    if (!hasContent || !selectedChat || isSending || !organizationId) return;

    // Validate attachments before sending
      const maxSizeBytes = maxAttachmentSizeBytes; // 10MB per file
      const allowedTypes = new Set(allowedAttachmentTypes);
      for (const a of pendingAttachments) {
        const sizeOk = true; // Size validation happens during upload
        const typeOk = typeof a.type === 'string' ? allowedTypes.has(a.type) : true;
        const urlOk = typeof a.url === 'string' && a.url.length > 0;
        if (!urlOk || !sizeOk || !typeOk) {
          toast({
            title: 'Invalid attachment',
            description: !urlOk ? 'Missing file URL.' : (!sizeOk ? 'File exceeds 10MB.' : 'Unsupported file type.'),
            variant: 'destructive',
          });
          return;
        }
      }

    setIsSending(true);

    try {
      const channel = selectedChat.channel.toLowerCase();
      
      // Build message with attachments - include filename metadata for proper display
      let fullMessage = messageInput.trim();
      if (pendingAttachments.length > 0) {
        // Format: [FILE:url|filename] so edge function can parse the original name
        const attachmentMarkers = pendingAttachments.map(a => 
          `[FILE:${a.url}|${a.name}]`
        ).join('\n');
        fullMessage = fullMessage ? `${fullMessage}\n${attachmentMarkers}` : attachmentMarkers;
      }
      
      if (channel === 'sms') {
        if (!selectedChat.leadId) {
          toast({ title: 'Error', description: 'Lead is required to send SMS', variant: 'destructive' });
          setIsSending(false);
          return;
        }
        if (!selectedChat.phone) {
          toast({ title: 'Error', description: 'Phone number is required to send SMS', variant: 'destructive' });
          setIsSending(false);
          return;
        }
        await sendSMS.mutateAsync({
          organizationId,
          leadId: selectedChat.leadId,
          toNumber: selectedChat.phone,
          fromNumber: selectedNumber.number,
          message: fullMessage,
        });
      } else if (channel === 'whatsapp') {
        if (!selectedChat.phone) {
          throw new Error('Missing WhatsApp phone number for this conversation');
        }
        await sendSocialMessage.mutateAsync({
          platform: 'whatsapp',
          organizationId,
          leadId: selectedChat.leadId || undefined,
          recipientId: selectedChat.phone,
          message: fullMessage,
        });
      } else if (channel === 'messenger') {
        // Use external_id (Facebook PSID) for messenger, and include leadId for proper association
        const recipientId = selectedChat.externalId;
        if (!recipientId) {
          throw new Error('Missing Facebook recipient ID for this conversation');
        }
        await sendSocialMessage.mutateAsync({
          platform: 'messenger',
          organizationId,
          recipientId,
          message: fullMessage,
          leadId: selectedChat.leadId || undefined,
        });
      } else if (channel === 'instagram') {
        // Use external_id (Instagram user ID) for instagram, and include leadId for proper association
        const recipientId = selectedChat.externalId;
        if (!recipientId) {
          throw new Error('Missing Instagram recipient ID for this conversation');
        }
        await sendSocialMessage.mutateAsync({
          platform: 'instagram',
          organizationId,
          recipientId,
          message: fullMessage,
          leadId: selectedChat.leadId || undefined,
        });
      } else if (channel === 'email' && selectedChat.email) {
        await sendEmail.mutateAsync({
          organizationId,
          leadId: selectedChat.leadId || undefined,
          to: selectedChat.email,
          subject: 'Re: Conversation',
          message: fullMessage,
        });
      } else if (channel === 'email') {
        throw new Error('Missing email address for this conversation');
      } else {
        throw new Error(`Unsupported channel: ${selectedChat.channel}`);
      }

      setMessageInput('');
      setPendingAttachments([]);
      setTyping(false);
      // Keep input focused for continued chatting
      setIsInputFocused(true);
      // Reset textarea height to default
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        // Re-focus the input for continued typing
        inputRef.current.focus();
      }
      // Show subtle success feedback
      toast({ title: 'Sent', description: 'Message delivered' });

      // Reconcile both inbox summary and thread timeline to avoid waiting solely on realtime delivery.
      await Promise.allSettled([
        refetchConversations(),
        refetchSelectedChatMessages(),
      ]);
    } catch (error) {
      devError('Error sending message:', error);
      const message = error instanceof Error ? error.message : 'Failed to send message';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends the message (standard chat behavior)
    // Shift+Enter or Ctrl+Enter adds a new line
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSendMessage();
      // Keep input focused after sending
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    // Shift+Enter, Ctrl+Enter, Cmd+Enter = new line (default textarea behavior)
  };

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  // Mobile/Tablet: Show either list or chat view (single panel)
  // Desktop: Show both panels side by side
  const useSinglePanelLayout = isMobile || isTablet;
  const showChatList = !useSinglePanelLayout || !selectedChat;
  const showChatView = !useSinglePanelLayout || selectedChat;

  return (
    <TooltipProvider>
    <div className="flex flex-col animate-fade-in h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 shrink-0">
        {isMobile ? (
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">Communications</h1>
            <p className="text-xs text-muted-foreground">Manage conversations</p>
          </div>
        ) : (
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Communications</h1>
            <p className="text-sm text-muted-foreground">Manage conversations across all channels</p>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-2 flex-1 justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <MessageCircle className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Conversations</span>
            <span className="text-sm font-semibold">{stats.total}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border",
            stats.totalUnread > 0 ? "border-destructive/50" : "border-border"
          )}>
            <Mail className={cn("w-3.5 h-3.5", stats.totalUnread > 0 ? "text-destructive" : "text-muted-foreground")} />
            <span className="text-xs text-muted-foreground">Unread</span>
            <span className={cn("text-sm font-semibold", stats.totalUnread > 0 && "text-destructive")}>{stats.totalUnread}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <span className="text-xs text-muted-foreground">Messages</span>
            <span className="text-sm font-semibold">{stats.totalMessages}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Users className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs text-muted-foreground">Need Response</span>
            <span className="text-sm font-semibold">{stats.conversationsWithUnread}</span>
          </div>
          {stats.failedMessages > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/50 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs text-destructive font-medium">Failed</span>
              <span className="text-sm font-bold text-destructive">{stats.failedMessages}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {stats.totalUnread > 0 && (
            <Button
              variant="outline"
              size={isMobile ? "icon" : "sm"}
              onClick={handleMarkAllAsRead}
              className={isMobile ? "h-8 w-8" : "text-xs h-8"}
              title="Mark all read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {!isMobile && <span className="ml-1.5">Mark all read</span>}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
            className="h-8 w-8"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          {selectedConversationIds.size > 0 && (
            <Button
              variant="secondary"
              size={isMobile ? "icon" : "sm"}
              onClick={() => setBulkMessageDialogOpen(true)}
              className={isMobile ? "h-8 w-8" : "text-xs h-8"}
              title="Send bulk message"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {!isMobile && <span className="ml-1.5">Bulk Message ({selectedConversationIds.size})</span>}
            </Button>
          )}
          <Button 
            variant="glow" 
            size={isMobile ? "icon" : "default"}
            onClick={() => setNewMessageDialogOpen(true)} 
            className={isMobile ? "h-8 w-8" : "h-8"}
          >
            <Plus className="w-4 h-4" />
            {!isMobile && <span className="ml-2">New Message</span>}
          </Button>
        </div>
      </div>

      <div className={cn(
        "flex-1 min-h-0 bg-gradient-to-b from-background via-background to-muted/20",
        useSinglePanelLayout ? "flex" : "grid grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr]"
      )}>
        {showChatList && (
          <ChatInboxSidebar
            useSinglePanelLayout={useSinglePanelLayout}
            stats={stats}
            onOpenNewMessage={() => setNewMessageDialogOpen(true)}
            selectedChannel={selectedChannel}
            onSelectedChannelChange={setSelectedChannel}
            channels={channels}
            unreadCounts={unreadCounts}
            getChannelCount={getChannelCount}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            isRefreshing={isRefreshing}
            isLoadingConversations={isLoadingConversations}
            onRefresh={handleRefreshInbox}
            sortBy={sortBy}
            sortOptions={sortOptions}
            onSortByChange={setSortBy}
            archivedOnly={archivedOnly}
            onArchivedOnlyChange={setArchivedOnly}
            unreadFilter={unreadFilter}
            onUnreadFilterChange={setUnreadFilter}
            agentManagedFilter={agentManagedFilter}
            onAgentManagedFilterChange={setAgentManagedFilter}
            agentManagedCounts={agentManagedCounts}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filteredChats={filteredAndSortedChats}
            selectedChatId={selectedChat?.id}
            pinnedConversations={pinnedConversations}
            selectedConversationIds={selectedConversationIds}
            onSelectChat={setSelectedChat}
            onToggleConversationSelection={toggleConversationSelection}
            onTogglePinConversation={togglePinConversation}
            onViewLead={handleViewLead}
            onCallLead={handleCallLead}
            onLinkConversation={handleLinkConversation}
            onTakeover={handleTakeover}
            onHandbackFromContext={handleHandbackFromContext}
            onHandbackComplete={handleHandbackComplete}
            onArchiveConversation={handleArchiveConversation}
            onUnarchiveConversation={handleUnarchiveConversation}
            linkConfig={linkConfig}
            formatConversationTime={formatConversationTime}
          />
        )}

        {/* Chat View - Takes remaining space */}
        {showChatView && (
          <Card className={cn(
            "flex flex-col min-w-0 min-h-0 overflow-hidden rounded-none border-0 bg-background/70 backdrop-blur-sm",
            useSinglePanelLayout ? "w-full flex-1" : "h-full"
          )}>
            {selectedChat ? (
              <>
                <CardHeader className="border-b border-border bg-background/85 py-2 lg:py-4 px-3 lg:px-6 backdrop-blur-sm">
                  <ChatThreadHeader
                    selectedChat={selectedChat}
                    useSinglePanelLayout={useSinglePanelLayout}
                    agentName={agentName}
                    linkConfig={linkConfig}
                    messages={selectedChatMessages.map((message) => ({
                      id: message.id,
                      content: message.content,
                      timestamp: message.timestamp || '',
                      role: message.role,
                    }))}
                    onBackToList={handleBackToList}
                    onViewLead={handleViewLead}
                    onTakeover={handleTakeover}
                    onLinkConversation={handleLinkConversation}
                    onCallLead={handleCallLead}
                    onSearchResultClick={handleSearchResultClick}
                    onHandbackComplete={handleHandbackComplete}
                  />
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden relative">
                  <ScrollArea 
                    className="flex-1 p-3 lg:p-4"
                    onScrollCapture={(e) => handleScrollChange(e.nativeEvent)}
                  >
                    <div className="space-y-3 lg:space-y-4">
                      {isLoadingSelectedChatMessages ? (
                        <div className="p-4 space-y-4">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="space-y-2">
                              <Skeleton className="h-4 w-1/3" />
                              <Skeleton className="h-16 w-2/3" />
                            </div>
                          ))}
                        </div>
                      ) : selectedChatMessagesError ? (
                        <div className="rounded-3xl border border-dashed border-border/70 bg-background/80 p-6 text-center text-sm text-muted-foreground shadow-sm">
                          Unable to load this conversation right now. Try refreshing the inbox.
                        </div>
                      ) : selectedChatMessages.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-border/70 bg-gradient-to-b from-background to-muted/25 p-8 text-center shadow-sm">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <MessageCircle className="h-7 w-7" />
                          </div>
                          <p className="text-sm font-medium text-foreground">No messages yet</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            The thread is ready. Send the first message to start the conversation.
                          </p>
                        </div>
                      ) : selectedChatMessages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          ref={(el) => { messageRefs.current[message.id] = el; }}
                          message={message}
                          isHighlighted={highlightedMessageId === message.id}
                          onReaction={(messageId, emoji, externalId) => handleReaction(messageId, emoji, externalId)}
                          onRetry={(messageId) => retry.mutate(messageId)}
                          reactions={messageReactions[message.id]}
                          currentUserId={userId}
                          channel={selectedChat?.channel}
                          agentName={agentName}
                        />
                      ))}
                      
                      {/* Typing Indicator */}
                      {typingUsers.length > 0 && (
                        <TypingIndicator typingUsers={typingUsers} />
                      )}
                      
                      {/* Scroll anchor for auto-scroll to bottom */}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Scroll to bottom button */}
                  {showScrollToBottom && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-20 right-4 h-10 w-10 rounded-full shadow-lg border border-border z-10 animate-fade-in"
                      onClick={scrollToBottom}
                      title="Scroll to latest messages"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </Button>
                  )}

                  <ChatComposer
                    selectedChat={selectedChat}
                    isMobile={isMobile}
                    useSinglePanelLayout={useSinglePanelLayout}
                    selectedNumber={selectedNumber}
                    availableNumbers={availableNumbers}
                    onSelectNumber={setSelectedNumber}
                    pendingAttachments={pendingAttachments}
                    setPendingAttachments={setPendingAttachments}
                    isInputFocused={isInputFocused}
                    setIsInputFocused={setIsInputFocused}
                    activeFormats={activeFormats}
                    organizationId={organizationId}
                    isSending={isSending}
                    onFormat={handleFormat}
                    onQuickReply={handleQuickReply}
                    onEmojiSelect={handleEmojiSelect}
                    inputRef={inputRef}
                    messageInput={messageInput}
                    onMessageInputChange={handleMessageInputChange}
                    onKeyPress={handleKeyPress}
                    onInputFocus={handleInputFocus}
                    onInputBlur={handleInputBlur}
                    onSendMessage={handleSendMessage}
                  />
                </CardContent>
              </>
            ) : (
              /* Beautiful empty state when no chat selected */
              <CardContent className="flex-1 flex items-center justify-center bg-gradient-to-b from-muted/10 via-muted/20 to-muted/35">
                <div className="text-center max-w-sm mx-auto p-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-3xl border border-primary/15 bg-primary/10 flex items-center justify-center shadow-sm">
                    <MessageCircle className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No conversation selected</h3>
                  <p className="text-sm leading-6 text-muted-foreground mb-6">
                    Choose a conversation from the list to start messaging, or create a new one.
                  </p>
                  <Button variant="outline" onClick={() => setNewMessageDialogOpen(true)} className="gap-2 rounded-xl">
                    <Plus className="w-4 h-4" />
                    New Conversation
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={[...selectedConversationIds]}
        selectedLeadIds={[...selectedConversationLeadIds]}
        onClearSelection={clearBulkSelection}
        onActionComplete={() => refetchConversations()}
      />

      {/* Lead Info Dialog */}
      <LeadInfoDialog
        lead={selectedLead}
        open={leadDialogOpen}
        onOpenChange={(open) => {
          setLeadDialogOpen(open);
          if (!open) setSelectedLead(null);
        }}
      />

      {/* Call Popup */}
      <CallPopup
        open={callPopupOpen}
        onOpenChange={setCallPopupOpen}
        leadName={callTarget?.name || ''}
        phoneNumber={callTarget?.phone || ''}
        leadId={callTarget?.leadId}
      />

      {/* New Message Dialog */}
      <Suspense fallback={null}>
        <NewMessageDialog
          open={newMessageDialogOpen}
          onOpenChange={setNewMessageDialogOpen}
          organizationId={organizationId}
          onMessageSent={() => refetchConversations()}
        />
      </Suspense>

      {/* Takeover Dialog */}
      <Suspense fallback={null}>
        {conversationForTakeover?.leadId && organizationId && (
          <TakeoverChatDialog
            open={showTakeoverDialog}
            onOpenChange={(open) => {
              setShowTakeoverDialog(open);
              if (!open) setConversationForTakeover(null);
            }}
            leadId={conversationForTakeover.leadId}
            leadName={conversationForTakeover.leadName}
            organizationId={organizationId}
            onTakeover={() => {
              refetchConversations();
              setShowTakeoverDialog(false);
              setConversationForTakeover(null);
            }}
          />
        )}
      </Suspense>

      {/* Link to Booking/Order Dialog (Cece uses booking, Jay/May will need their own) */}
      <Suspense fallback={null}>
        <LinkToBookingDialog
          open={linkDialogOpen}
          onOpenChange={(open) => {
            setLinkDialogOpen(open);
            if (!open) setConversationForLinking(null);
          }}
          leadId={conversationForLinking?.leadId || null}
          leadName={conversationForLinking?.leadName || ''}
          conversationDate={conversationForLinking?.date || null}
        />
      </Suspense>

      {/* Bulk Message Dialog */}
      <Suspense fallback={null}>
        {selectedConversationLeadIds.size > 0 && (
          <BulkMessageDialog
            isOpen={bulkMessageDialogOpen}
            onOpenChange={setBulkMessageDialogOpen}
            leads={conversations
              .filter(c => selectedConversationLeadIds.has(c.leadId) && c.leadId)
              .map(c => ({
                id: c.leadId!,
                name: c.leadName,
                phone: c.phone,
                email: c.email,
                channel: c.channel,
              }))}
            onSendMessages={handleBulkMessageSend}
          />
        )}
      </Suspense>
    </div>
    </TooltipProvider>
  );
}
