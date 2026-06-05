import { useEffect } from 'react';
import type { ChatConversation } from '@/hooks/useChatConversations';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface UseSelectedConversationSyncParams {
  conversations: ChatConversation[];
  selectedChatRef: { current: ChatConversation | null };
  setSelectedChat: (chat: ChatConversation | null) => void;
  toast: (options: ToastOptions) => void;
}

export function useSelectedConversationSync({
  conversations,
  selectedChatRef,
  setSelectedChat,
  toast,
}: UseSelectedConversationSyncParams) {
  useEffect(() => {
    const current = selectedChatRef.current;
    if (!current?.id || !conversations.length) return;

    const updatedConversation = conversations.find((conversation) => conversation.id === current.id);

    if (!updatedConversation) {
      setSelectedChat(null);
      toast({
        title: 'Conversation no longer available',
        description: 'The selected conversation was removed or archived.',
        variant: 'destructive',
      });
      return;
    }

    const hasNewMessages = updatedConversation.messageCount !== current.messageCount;
    const lastMessageChanged = updatedConversation.lastMessage !== current.lastMessage;
    const statusChanged = updatedConversation.conversationStatus !== current.conversationStatus;
    const aiManagedChanged = updatedConversation.isAiManaged !== current.isAiManaged;

    if (hasNewMessages || lastMessageChanged || statusChanged || aiManagedChanged) {
      setSelectedChat(updatedConversation);
    }
  }, [conversations, selectedChatRef, setSelectedChat, toast]);
}