import { useCallback, useMemo } from 'react';
import { isArchivedConversationResurfaced, shouldDisplayConversationInActiveInbox } from '@/lib/chatConversationSummary';
import type { ChatConversation } from '@/hooks/useChatConversations';
import type { SortOption } from '@/hooks/useChatLogsState';

interface UseChatInboxSidebarStateParams {
  conversations: ChatConversation[];
  debouncedSearchTerm: string;
  selectedChannel: string;
  sortBy: SortOption;
  pinnedConversations: Set<string>;
  agentManagedFilter: boolean | null;
  unreadFilter: boolean;
  archivedOnly: boolean;
  searchTerm: string;
}

export function useChatInboxSidebarState({
  conversations,
  debouncedSearchTerm,
  selectedChannel,
  sortBy,
  pinnedConversations,
  agentManagedFilter,
  unreadFilter,
  archivedOnly,
  searchTerm,
}: UseChatInboxSidebarStateParams) {
  const filteredAndSortedChats = useMemo(() => {
    const result = conversations.filter((chat) => {
      const q = debouncedSearchTerm.toLowerCase();
      const matchesSearch = chat.leadName.toLowerCase().includes(q) || chat.phone.includes(debouncedSearchTerm);
      const matchesChannel = selectedChannel === 'all' || chat.channel.toLowerCase() === selectedChannel;
      const matchesAgentFilter = agentManagedFilter === null
        ? true
        : agentManagedFilter === true
          ? chat.isAiManaged === false
          : chat.isAiManaged !== false;
      const matchesUnreadFilter = !unreadFilter || chat.unread > 0;
      const isArchived = chat.conversationStatus === 'archived';
      const matchesArchive = archivedOnly ? isArchived : shouldDisplayConversationInActiveInbox(chat);

      return matchesSearch && matchesChannel && matchesArchive && matchesAgentFilter && matchesUnreadFilter;
    });

    result.sort((left, right) => {
      const leftPinned = pinnedConversations.has(left.id);
      const rightPinned = pinnedConversations.has(right.id);
      if (leftPinned && !rightPinned) return -1;
      if (!leftPinned && rightPinned) return 1;

      const leftResurfaced = isArchivedConversationResurfaced(left);
      const rightResurfaced = isArchivedConversationResurfaced(right);
      if (leftResurfaced && !rightResurfaced) return -1;
      if (!leftResurfaced && rightResurfaced) return 1;

      switch (sortBy) {
        case 'newest':
          return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime();
        case 'oldest':
          return new Date(left.lastMessageAt).getTime() - new Date(right.lastMessageAt).getTime();
        case 'unread':
          return right.unread - left.unread;
        case 'name':
          return left.leadName.localeCompare(right.leadName);
        default:
          return 0;
      }
    });

    return result;
  }, [agentManagedFilter, archivedOnly, conversations, debouncedSearchTerm, pinnedConversations, selectedChannel, sortBy, unreadFilter]);

  const stats = useMemo(() => {
    const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unread, 0);
    const conversationsWithUnread = conversations.filter((conversation) => conversation.unread > 0).length;
    const totalMessages = conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0);
    const archivedUnread = conversations
      .filter((conversation) => conversation.conversationStatus === 'archived')
      .reduce((sum, conversation) => sum + conversation.unread, 0);
    const resurfacedCount = conversations.filter((conversation) => isArchivedConversationResurfaced(conversation)).length;
    const failedMessages = conversations.reduce((sum, conversation) => sum + conversation.failedMessageCount, 0);

    const channelBreakdown: Record<string, number> = {};
    for (const conversation of conversations) {
      const channel = conversation.channel.toLowerCase();
      channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1;
    }

    return {
      total: conversations.length,
      totalUnread,
      conversationsWithUnread,
      totalMessages,
      channelBreakdown,
      failedMessages,
      archivedUnread,
      resurfacedCount,
    };
  }, [conversations]);

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const conversation of conversations) {
      if (conversation.unread > 0) {
        counts.all = (counts.all || 0) + conversation.unread;
        const channel = conversation.channel.toLowerCase();
        counts[channel] = (counts[channel] || 0) + conversation.unread;
      }
    }
    return counts;
  }, [conversations]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: conversations.length };
    for (const conversation of conversations) {
      const channel = conversation.channel.toLowerCase();
      counts[channel] = (counts[channel] || 0) + 1;
    }
    return counts;
  }, [conversations]);

  const getChannelCount = useCallback((channelId: string) => channelCounts[channelId] || 0, [channelCounts]);

  const agentManagedCounts = useMemo(() => {
    const agentManaged = conversations.filter((conversation) => conversation.isAiManaged === false).length;
    const aiManaged = conversations.filter((conversation) => conversation.isAiManaged !== false).length;
    return { agentManaged, aiManaged };
  }, [conversations]);

  const hasActiveFilters = !!searchTerm || selectedChannel !== 'all' || agentManagedFilter !== null || unreadFilter || archivedOnly;

  return {
    filteredAndSortedChats,
    stats,
    unreadCounts,
    getChannelCount,
    agentManagedCounts,
    hasActiveFilters,
  };
}