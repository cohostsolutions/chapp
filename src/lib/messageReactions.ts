/**
 * Message Reactions Module
 * Handles saving, removing, and fetching emoji reactions for chat messages.
 * Gracefully handles cases where the message_reactions table doesn't exist.
 */

import { supabase } from '@/integrations/supabase/client';
import { devWarn, devError } from '@/lib/logger';

/** Shape of a reaction record from the database */
export interface MessageReactionRecord {
  id: string;
  communication_id: string;
  emoji: string;
  user_id: string;
  created_at: string;
}

// Flag to track if we've already logged a warning about missing table
let hasLoggedTableWarning = false;

/**
 * Checks if an error indicates the message_reactions table doesn't exist.
 * @param error - The error to check
 * @returns True if this is a "table not found" error
 */
function isTableNotFoundError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; message?: string };
    return err.code === 'PGRST205' || err.message?.includes('Could not find the table');
  }
  return false;
}

/**
 * Logs a warning once about missing table to avoid console spam.
 */
function logTableWarningOnce(): void {
  if (!hasLoggedTableWarning) {
    hasLoggedTableWarning = true;
    devWarn('[MessageReactions] message_reactions table not found - reactions feature disabled');
  }
}

// Helper to access the message_reactions table (not in generated types)
const reactionsTable = () => (supabase as any).from('message_reactions');

/**
 * Save a message reaction to the database
 */
export async function saveMessageReaction(
  organizationId: string,
  communicationId: string,
  emoji: string,
  userId: string,
): Promise<boolean> {
  try {
    const { error } = await reactionsTable()
      .insert({
        organization_id: organizationId,
        communication_id: communicationId,
        emoji,
        user_id: userId,
      });

    if (error) {
      if (isTableNotFoundError(error)) {
        logTableWarningOnce();
        return false;
      }
      devError('Error saving reaction:', error);
      return false;
    }
    return true;
  } catch (error) {
    if (isTableNotFoundError(error)) {
      logTableWarningOnce();
      return false;
    }
    devError('Error saving reaction:', error);
    return false;
  }
}

/**
 * Remove a message reaction from the database
 */
export async function removeMessageReaction(
  communicationId: string,
  emoji: string,
  userId: string,
): Promise<boolean> {
  try {
    const { error } = await reactionsTable()
      .delete()
      .eq('communication_id', communicationId)
      .eq('emoji', emoji)
      .eq('user_id', userId);

    if (error) {
      if (isTableNotFoundError(error)) {
        logTableWarningOnce();
        return false;
      }
      devError('Error removing reaction (inner):', error);
      return false;
    }
    return true;
  } catch (error) {
    if (isTableNotFoundError(error)) {
      logTableWarningOnce();
      return false;
    }
    devError('Error removing reaction:', error);
    return false;
  }
}

/**
 * Fetch reactions for a communication message
 */
export async function fetchMessageReactions(
  communicationId: string,
): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await reactionsTable()
      .select('emoji, user_id')
      .eq('communication_id', communicationId);

    if (error) {
      if (isTableNotFoundError(error)) {
        logTableWarningOnce();
        return {};
      }
      devError('Error fetching reactions (single inner):', error);
      return {};
    }

    const reactions: Record<string, string[]> = {};
    const rows = (data || []) as Array<{ emoji: string; user_id: string }>;
    for (const record of rows) {
      if (!reactions[record.emoji]) reactions[record.emoji] = [];
      reactions[record.emoji].push(record.user_id);
    }
    return reactions;
  } catch (error) {
    if (isTableNotFoundError(error)) {
      logTableWarningOnce();
      return {};
    }
    devError('Error fetching reactions (single catch):', error);
    return {};
  }
}

/**
 * Fetch reactions for multiple communications at once
 */
export async function fetchMultipleMessageReactions(
  communicationIds: string[],
): Promise<Record<string, Record<string, string[]>>> {
  if (communicationIds.length === 0) return {};

  try {
    const { data, error } = await reactionsTable()
      .select('communication_id, emoji, user_id')
      .in('communication_id', communicationIds);

    if (error) {
      if (isTableNotFoundError(error)) {
        logTableWarningOnce();
        return {};
      }
      devError('Error fetching reactions (multi inner):', error);
      return {};
    }

    const reactions: Record<string, Record<string, string[]>> = {};
    const rows = (data || []) as Array<{ communication_id: string; emoji: string; user_id: string }>;
    for (const record of rows) {
      const cid = record.communication_id;
      const emoji = record.emoji;
      const uid = record.user_id;
      if (!reactions[cid]) reactions[cid] = {};
      if (!reactions[cid][emoji]) reactions[cid][emoji] = [];
      reactions[cid][emoji].push(uid);
    }
    return reactions;
  } catch (error) {
    if (isTableNotFoundError(error)) {
      logTableWarningOnce();
      return {};
    }
    devError('Error fetching reactions (multi catch):', error);
    return {};
  }
}
