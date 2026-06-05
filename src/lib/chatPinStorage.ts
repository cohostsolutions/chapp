export type ChatPinScope = 'inbox-conversations' | 'team-chats';

const CHAT_PIN_STORAGE_PREFIX = 'canvascapital:chat-pins:v1';

interface ChatPinStorageKeyParams {
  scope: ChatPinScope;
  organizationId?: string | null;
  userId?: string | null;
}

export function buildChatPinStorageKey({ scope, organizationId, userId }: ChatPinStorageKeyParams): string | null {
  if (!organizationId || !userId) {
    return null;
  }

  return `${CHAT_PIN_STORAGE_PREFIX}:${scope}:${organizationId}:${userId}`;
}

export function normalizePinnedIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

export function readPinnedIdsFromStorage(storageKey?: string | null): Set<string> {
  if (!storageKey || typeof window === 'undefined') {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return new Set();
    }

    return new Set(normalizePinnedIds(JSON.parse(raw)));
  } catch {
    return new Set();
  }
}

export function writePinnedIdsToStorage(storageKey: string | null | undefined, ids: Iterable<string>): void {
  if (!storageKey || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizePinnedIds(Array.from(ids))));
  } catch {
    // Ignore storage write failures.
  }
}