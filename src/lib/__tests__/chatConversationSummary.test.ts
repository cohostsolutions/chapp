import { describe, expect, it } from 'vitest';

import {
  getConversationPreview,
  isArchivedConversationResurfaced,
  shouldDisplayConversationInActiveInbox,
} from '@/lib/chatConversationSummary';

describe('chatConversationSummary', () => {
  describe('getConversationPreview', () => {
    it('strips attachment markers and keeps visible text', () => {
      expect(
        getConversationPreview({
          content: 'Here is the contract [FILE:https://example.com/doc.pdf|contract.pdf]',
          direction: 'outbound',
        })
      ).toBe('Here is the contract');
    });

    it('builds an image preview when metadata only contains images', () => {
      expect(
        getConversationPreview({
          content: '',
          direction: 'inbound',
          metadata: { image_urls: ['https://example.com/a.jpg'] },
        })
      ).toBe('Received an image');
    });

    it('builds a plural attachment preview for attachment-only messages', () => {
      expect(
        getConversationPreview({
          content: '[FILE:https://example.com/a.pdf|a.pdf]\n[FILE:https://example.com/b.pdf|b.pdf]',
          direction: 'outbound',
        })
      ).toBe('Sent 2 attachments');
    });

    it('maps known system events to stable previews', () => {
      expect(
        getConversationPreview({
          content: '',
          metadata: { event_type: 'agent_takeover' },
        })
      ).toBe('Agent took over the conversation');
    });
  });

  describe('resurfacing rules', () => {
    it('resurfaces archived conversations when the latest unread message is inbound', () => {
      const state = {
        conversationStatus: 'archived' as const,
        unread: 2,
        lastMessageDirection: 'inbound' as const,
      };

      expect(isArchivedConversationResurfaced(state)).toBe(true);
      expect(shouldDisplayConversationInActiveInbox(state)).toBe(true);
    });

    it('keeps archived conversations hidden from the active inbox when unread state does not need attention', () => {
      expect(
        shouldDisplayConversationInActiveInbox({
          conversationStatus: 'archived',
          unread: 0,
          lastMessageDirection: 'inbound',
        })
      ).toBe(false);

      expect(
        shouldDisplayConversationInActiveInbox({
          conversationStatus: 'archived',
          unread: 3,
          lastMessageDirection: 'outbound',
        })
      ).toBe(false);
    });
  });
});