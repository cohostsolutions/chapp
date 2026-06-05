import { useCallback, useEffect, useRef } from 'react';
import type { ChatConversation, NewMessageInfo } from '@/hooks/useChatConversations';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface UseChatInboxNotificationsParams {
  selectedChatRef: { current: ChatConversation | null };
  setOnNewMessage: (callback: ((info: NewMessageInfo) => void) | null) => void;
  playNotificationSound: () => void;
  showBrowserNotification: (info: NewMessageInfo) => void;
  toast: (options: ToastOptions) => void;
}

export function useChatInboxNotifications({
  selectedChatRef,
  setOnNewMessage,
  playNotificationSound,
  showBrowserNotification,
  toast,
}: UseChatInboxNotificationsParams) {
  const recentNotificationTimestampsRef = useRef<Record<string, number>>({});

  const shouldSuppressBurstNotification = useCallback((info: NewMessageInfo) => {
    const key = `${info.leadId || info.senderName}:${info.channel}:${info.content.slice(0, 32)}`;
    const now = Date.now();
    const lastShownAt = recentNotificationTimestampsRef.current[key] || 0;

    if (now - lastShownAt < 1500) {
      return true;
    }

    recentNotificationTimestampsRef.current[key] = now;

    // Lightweight cleanup to avoid map growth over long sessions.
    for (const entryKey of Object.keys(recentNotificationTimestampsRef.current)) {
      if (now - recentNotificationTimestampsRef.current[entryKey] > 60_000) {
        delete recentNotificationTimestampsRef.current[entryKey];
      }
    }

    return false;
  }, []);

  const shouldSuppressActiveConversationNotification = useCallback((info: NewMessageInfo) => {
    const currentConversation = selectedChatRef.current;
    if (!currentConversation?.leadId || !info.leadId) {
      return false;
    }

    if (currentConversation.leadId !== info.leadId) {
      return false;
    }

    return document.visibilityState === 'visible' && document.hasFocus();
  }, [selectedChatRef]);

  useEffect(() => {
    setOnNewMessage((info: NewMessageInfo) => {
      if (shouldSuppressActiveConversationNotification(info)) {
        return;
      }

      if (shouldSuppressBurstNotification(info)) {
        return;
      }

      playNotificationSound();
      showBrowserNotification(info);

      const truncatedContent = info.content.length > 40
        ? `${info.content.substring(0, 40)}...`
        : info.content;

      toast({
        title: `${info.senderName} via ${info.channel}`,
        description: truncatedContent || 'New message received',
      });
    });

    return () => setOnNewMessage(null);
  }, [playNotificationSound, setOnNewMessage, shouldSuppressActiveConversationNotification, shouldSuppressBurstNotification, showBrowserNotification, toast]);
}