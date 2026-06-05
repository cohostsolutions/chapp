import { useCallback, useEffect, useState } from 'react';
import { devError } from '@/lib/logger';

export interface BulkMessageDraft {
  id: string;
  recipients: string[]; // Lead IDs
  content: string;
  subject?: string;
  channel?: string;
  createdAt: number;
  updatedAt: number;
}

const DRAFT_STORAGE_KEY = 'bulk-message-drafts';
const MAX_DRAFTS = 10;

/**
 * Hook to manage bulk message drafts in localStorage
 * Provides save, load, delete, and clear functionality
 */
export function useBulkMessageDraft() {
  const [drafts, setDrafts] = useState<BulkMessageDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load drafts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as BulkMessageDraft[];
        // Clean up drafts older than 30 days
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const fresh = parsed.filter((d) => d.updatedAt > thirtyDaysAgo);
        setDrafts(fresh);
      }
    } catch (err) {
      devError('Failed to load drafts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Persist drafts to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
      } catch (err) {
        devError('Failed to save drafts:', err);
      }
    }
  }, [drafts, isLoading]);

  const saveDraft = useCallback(
    (
      recipients: string[],
      content: string,
      options?: { subject?: string; channel?: string }
    ) => {
      const now = Date.now();
      const existingIndex = drafts.findIndex((d) => JSON.stringify(d.recipients.sort()) === JSON.stringify(recipients.sort()));

      if (existingIndex >= 0) {
        // Update existing draft
        const updated = [...drafts];
        updated[existingIndex] = {
          ...updated[existingIndex],
          content,
          subject: options?.subject,
          channel: options?.channel,
          updatedAt: now,
        };
        setDrafts(updated);
        return updated[existingIndex].id;
      } else {
        // Create new draft
        const newDraft: BulkMessageDraft = {
          id: `draft-${now}`,
          recipients,
          content,
          subject: options?.subject,
          channel: options?.channel,
          createdAt: now,
          updatedAt: now,
        };
        setDrafts((prev) => {
          // Keep only the most recent 10 drafts
          const combined = [newDraft, ...prev].slice(0, MAX_DRAFTS);
          return combined;
        });
        return newDraft.id;
      }
    },
    [drafts]
  );

  const getDraft = useCallback(
    (id: string) => {
      return drafts.find((d) => d.id === id);
    },
    [drafts]
  );

  const deleteDraft = useCallback(
    (id: string) => {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    },
    []
  );

  const clearAllDrafts = useCallback(() => {
    setDrafts([]);
  }, []);

  const getRecentDraft = useCallback(() => {
    return drafts.length > 0 ? drafts[0] : null;
  }, [drafts]);

  return {
    drafts,
    isLoading,
    saveDraft,
    getDraft,
    deleteDraft,
    clearAllDrafts,
    getRecentDraft,
  };
}
