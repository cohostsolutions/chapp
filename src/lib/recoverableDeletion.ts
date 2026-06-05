import { supabase } from '@/integrations/supabase/client';

export const RECOVERY_WINDOW_HOURS = 5;

export class DeletionCancelledError extends Error {
  constructor() {
    super('Deletion cancelled');
    this.name = 'DeletionCancelledError';
  }
}

export function getRecoverableDeletionMessage(label = 'this item') {
  return `Delete ${label}? It will remain recoverable for ${RECOVERY_WINDOW_HOURS} hours, then it will be permanently removed.`;
}

export function confirmRecoverableDeletion(label?: string) {
  if (typeof window === 'undefined') return true;
  return window.confirm(getRecoverableDeletionMessage(label));
}

export async function archiveRecoverableRecordDeletion(tableName: string, recordId: string, displayLabel?: string) {
  const { data, error } = await (supabase as any).rpc('archive_record_deletion', {
    _table_name: tableName,
    _record_id: recordId,
    _display_label: displayLabel || null,
  });

  if (error) throw error;
  return data as string;
}