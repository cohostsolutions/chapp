/**
 * Utility functions for chat search and filtering enhancements
 */

export interface ChatWithArchiveInfo {
  id: string;
  leadName: string;
  phone: string;
  channel: string;
  unread: number;
  isAiManaged?: boolean;
  conversationStatus?: 'active' | 'archived' | 'ended';
  lastMessageAt: string;
  [key: string]: any;
}

/**
 * Enhanced search that includes archived chats with visual indicator
 * Returns chats with archive status for display purposes
 */
export function searchChatsIncludingArchived(
  chats: ChatWithArchiveInfo[],
  searchTerm: string,
  filters?: {
    selectedChannel?: string;
    agentManagedFilter?: boolean | null;
    unreadFilter?: boolean;
  }
): Array<ChatWithArchiveInfo & { isArchivedChat?: boolean }> {
  return chats
    .map((chat) => ({
      ...chat,
      isArchivedChat: chat.conversationStatus === 'archived',
    }))
    .filter((chat) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        chat.leadName.toLowerCase().includes(q) ||
        chat.phone.includes(searchTerm);
      const matchesChannel =
        !filters?.selectedChannel ||
        filters.selectedChannel === 'all' ||
        chat.channel.toLowerCase() === filters.selectedChannel;
      const matchesAgentFilter =
        filters?.agentManagedFilter === null
          ? true
          : filters?.agentManagedFilter === true
            ? chat.isAiManaged === false
            : chat.isAiManaged !== false;
      const matchesUnreadFilter =
        !filters?.unreadFilter || chat.unread > 0;

      return (
        matchesSearch &&
        matchesChannel &&
        matchesAgentFilter &&
        matchesUnreadFilter
      );
    });
}

/**
 * Separate chats into active and archived for tab display
 */
export function separateArchived(chats: ChatWithArchiveInfo[]) {
  const active = chats.filter((c) => c.conversationStatus !== 'archived');
  const archived = chats.filter((c) => c.conversationStatus === 'archived');
  return { active, archived };
}

/**
 * Get unread count in archived chats
 */
export function getArchivedUnreadCount(chats: ChatWithArchiveInfo[]): number {
  return chats
    .filter((c) => c.conversationStatus === 'archived')
    .reduce((sum, c) => sum + (c.unread || 0), 0);
}

/**
 * Move chat to top of list when new message arrives
 */
export function reorderChatOnNewMessage(
  chats: ChatWithArchiveInfo[],
  chatId: string
): ChatWithArchiveInfo[] {
  const index = chats.findIndex((c) => c.id === chatId);
  if (index === -1) return chats;

  const chat = chats[index];
  const remaining = chats.filter((_, i) => i !== index);
  return [chat, ...remaining];
}
