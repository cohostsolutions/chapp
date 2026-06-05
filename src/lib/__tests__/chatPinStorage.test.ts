import { beforeEach, describe, expect, test } from 'vitest';
import {
  buildChatPinStorageKey,
  normalizePinnedIds,
  readPinnedIdsFromStorage,
  writePinnedIdsToStorage,
} from '../chatPinStorage';

describe('chatPinStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('builds a user-and-organization scoped storage key', () => {
    expect(
      buildChatPinStorageKey({
        scope: 'team-chats',
        organizationId: 'org-1',
        userId: 'user-1',
      }),
    ).toBe('canvascapital:chat-pins:v1:team-chats:org-1:user-1');

    expect(
      buildChatPinStorageKey({
        scope: 'inbox-conversations',
        organizationId: 'org-1',
      }),
    ).toBeNull();
  });

  test('normalizes pinned ids by trimming, deduplicating, and discarding invalid entries', () => {
    expect(normalizePinnedIds(['  chat-1  ', 'chat-2', 'chat-1', '', 42, null])).toEqual([
      'chat-1',
      'chat-2',
    ]);
  });

  test('reads persisted pins defensively from localStorage', () => {
    localStorage.setItem('pins', JSON.stringify(['chat-2', 'chat-1', 'chat-2', '']));

    expect(Array.from(readPinnedIdsFromStorage('pins'))).toEqual(['chat-2', 'chat-1']);
    expect(Array.from(readPinnedIdsFromStorage('missing'))).toEqual([]);

    localStorage.setItem('broken', '{bad json');
    expect(Array.from(readPinnedIdsFromStorage('broken'))).toEqual([]);
  });

  test('writes normalized pin ids to localStorage', () => {
    writePinnedIdsToStorage('pins', ['chat-1', 'chat-1', '  chat-2  ', '']);

    expect(localStorage.getItem('pins')).toBe(JSON.stringify(['chat-1', 'chat-2']));
  });
});