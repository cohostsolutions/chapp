import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useChatInboxSidebarState } from '../useChatInboxSidebarState';
import type { ChatConversation } from '../useChatConversations';

function createConversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
  return {
    id: 'conversation-1',
    leadId: 'lead-1',
    leadName: 'Alex Guest',
    phone: '+15555550101',
    email: 'alex@example.com',
    lastMessage: 'Latest update',
    lastMessageAt: '2026-01-10T10:00:00.000Z',
    unread: 0,
    channel: 'sms',
    messages: [],
    messageCount: 1,
    failedMessageCount: 0,
    conversationStatus: 'active',
    ...overrides,
  };
}

describe('useChatInboxSidebarState', () => {
  test('keeps pinned conversations ahead of newer unpinned ones', () => {
    const olderPinned = createConversation({
      id: 'pinned-conversation',
      leadName: 'Pinned Lead',
      lastMessageAt: '2026-01-10T08:00:00.000Z',
    });
    const newerUnpinned = createConversation({
      id: 'newer-conversation',
      leadName: 'Newest Lead',
      lastMessageAt: '2026-01-10T12:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useChatInboxSidebarState({
        conversations: [newerUnpinned, olderPinned],
        debouncedSearchTerm: '',
        selectedChannel: 'all',
        sortBy: 'newest',
        pinnedConversations: new Set(['pinned-conversation']),
        agentManagedFilter: null,
        unreadFilter: false,
        archivedOnly: false,
        searchTerm: '',
      }),
    );

    expect(result.current.filteredAndSortedChats.map((conversation) => conversation.id)).toEqual([
      'pinned-conversation',
      'newer-conversation',
    ]);
  });

  test('shows resurfaced archived conversations in active inbox but hides quiet archived ones', () => {
    const active = createConversation({
      id: 'active-1',
      conversationStatus: 'active',
      unread: 0,
      lastMessageDirection: 'outbound',
    });
    const resurfacedArchived = createConversation({
      id: 'archived-resurfaced',
      conversationStatus: 'archived',
      unread: 2,
      lastMessageDirection: 'inbound',
      lastMessageAt: '2026-01-11T10:00:00.000Z',
    });
    const quietArchived = createConversation({
      id: 'archived-quiet',
      conversationStatus: 'archived',
      unread: 0,
      lastMessageDirection: 'outbound',
      lastMessageAt: '2026-01-12T10:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useChatInboxSidebarState({
        conversations: [active, resurfacedArchived, quietArchived],
        debouncedSearchTerm: '',
        selectedChannel: 'all',
        sortBy: 'newest',
        pinnedConversations: new Set(),
        agentManagedFilter: null,
        unreadFilter: false,
        archivedOnly: false,
        searchTerm: '',
      }),
    );

    expect(result.current.filteredAndSortedChats.map((conversation) => conversation.id)).toEqual([
      'archived-resurfaced',
      'active-1',
    ]);
  });

  test('returns only archived conversations when archivedOnly is enabled', () => {
    const active = createConversation({ id: 'active-1', conversationStatus: 'active' });
    const archived = createConversation({ id: 'archived-1', conversationStatus: 'archived' });

    const { result } = renderHook(() =>
      useChatInboxSidebarState({
        conversations: [active, archived],
        debouncedSearchTerm: '',
        selectedChannel: 'all',
        sortBy: 'newest',
        pinnedConversations: new Set(),
        agentManagedFilter: null,
        unreadFilter: false,
        archivedOnly: true,
        searchTerm: '',
      }),
    );

    expect(result.current.filteredAndSortedChats.map((conversation) => conversation.id)).toEqual(['archived-1']);
  });

  test('applies unread filter and computes channel unread counts', () => {
    const unreadSms = createConversation({ id: 'sms-1', channel: 'sms', unread: 2 });
    const unreadEmail = createConversation({ id: 'email-1', channel: 'email', unread: 1 });
    const readSms = createConversation({ id: 'sms-2', channel: 'sms', unread: 0 });

    const { result } = renderHook(() =>
      useChatInboxSidebarState({
        conversations: [unreadSms, unreadEmail, readSms],
        debouncedSearchTerm: '',
        selectedChannel: 'all',
        sortBy: 'newest',
        pinnedConversations: new Set(),
        agentManagedFilter: null,
        unreadFilter: true,
        archivedOnly: false,
        searchTerm: '',
      }),
    );

    expect(result.current.filteredAndSortedChats.map((conversation) => conversation.id).sort()).toEqual([
      'email-1',
      'sms-1',
    ]);
    expect(result.current.unreadCounts.all).toBe(3);
    expect(result.current.unreadCounts.sms).toBe(2);
    expect(result.current.unreadCounts.email).toBe(1);
  });

  test('filters by AI-managed vs agent-managed conversations', () => {
    const aiManaged = createConversation({ id: 'ai-1', isAiManaged: true });
    const agentManaged = createConversation({ id: 'agent-1', isAiManaged: false });

    const { result: agentOnly } = renderHook(() =>
      useChatInboxSidebarState({
        conversations: [aiManaged, agentManaged],
        debouncedSearchTerm: '',
        selectedChannel: 'all',
        sortBy: 'newest',
        pinnedConversations: new Set(),
        agentManagedFilter: true,
        unreadFilter: false,
        archivedOnly: false,
        searchTerm: '',
      }),
    );

    expect(agentOnly.current.filteredAndSortedChats.map((conversation) => conversation.id)).toEqual(['agent-1']);

    const { result: aiOnly } = renderHook(() =>
      useChatInboxSidebarState({
        conversations: [aiManaged, agentManaged],
        debouncedSearchTerm: '',
        selectedChannel: 'all',
        sortBy: 'newest',
        pinnedConversations: new Set(),
        agentManagedFilter: false,
        unreadFilter: false,
        archivedOnly: false,
        searchTerm: '',
      }),
    );

    expect(aiOnly.current.filteredAndSortedChats.map((conversation) => conversation.id)).toEqual(['ai-1']);
  });
});