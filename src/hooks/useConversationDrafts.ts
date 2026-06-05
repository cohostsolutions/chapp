import { useEffect } from 'react';
import type { Attachment } from '@/components/communications/AttachmentPreview';

interface UseConversationDraftsParams {
  selectedConversationId?: string | null;
  draftsStorageKey: string;
  messageInput: string;
  pendingAttachments: Attachment[];
  setMessageInput: (value: string) => void;
  setPendingAttachments: (attachments: Attachment[]) => void;
}

export function useConversationDrafts({
  selectedConversationId,
  draftsStorageKey,
  messageInput,
  pendingAttachments,
  setMessageInput,
  setPendingAttachments,
}: UseConversationDraftsParams) {
  useEffect(() => {
    try {
      if (!selectedConversationId) return;
      const raw = localStorage.getItem(draftsStorageKey);
      if (!raw) return;

      const map = JSON.parse(raw) as Record<string, { text: string; attachments: Attachment[] }>;
      const draft = map[selectedConversationId];

      if (draft) {
        setMessageInput(draft.text || '');
        setPendingAttachments(draft.attachments || []);
        return;
      }

      setMessageInput('');
      setPendingAttachments([]);
    } catch {
      // Ignore storage errors.
    }
  }, [draftsStorageKey, selectedConversationId, setMessageInput, setPendingAttachments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        if (!selectedConversationId) return;
        const raw = localStorage.getItem(draftsStorageKey);
        const map = raw ? (JSON.parse(raw) as Record<string, { text: string; attachments: Attachment[] }>) : {};

        map[selectedConversationId] = {
          text: messageInput,
          attachments: pendingAttachments,
        };

        localStorage.setItem(draftsStorageKey, JSON.stringify(map));
      } catch {
        // Ignore storage errors.
      }
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [draftsStorageKey, messageInput, pendingAttachments, selectedConversationId]);
}