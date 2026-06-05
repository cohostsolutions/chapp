// Lightweight DB-backed processing lock helper
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_LOCK_TIMEOUT_MS = 60000;

export async function claimProcessingLock(
  supabase: SupabaseClient,
  leadId: string,
  organizationId: string | null | undefined,
  platform: string,
  timeoutMs = DEFAULT_LOCK_TIMEOUT_MS
): Promise<boolean> {
  try {
    const lockKey = `processing_${leadId}_${platform}`;
    const lockExpiry = new Date(Date.now() + timeoutMs).toISOString();

    const { error } = await supabase
      .from('processing_locks')
      .insert({
        lead_id: leadId,
        organization_id: organizationId || null,
        platform,
        lock_key: lockKey,
        acquired_at: new Date().toISOString(),
        expires_at: lockExpiry,
        worker_id: `worker_${Math.random().toString(36).slice(2)}`
      })
      .single();

    if (error) {
      // 23505 = unique violation (already locked)
      if ((error as any)?.code === '23505') return false;
      console.warn('[locks] Unexpected error claiming lock:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[locks] Exception claiming lock (fail-safe):', err);
    // Fail-safe: treat as locked false so caller can decide. Returning false prevents duplicate sends.
    return false;
  }
}

export async function releaseProcessingLock(
  supabase: SupabaseClient,
  leadId: string,
  platform: string
): Promise<void> {
  try {
    await supabase
      .from('processing_locks')
      .delete()
      .eq('lead_id', leadId)
      .eq('platform', platform);
  } catch (err) {
    console.warn('[locks] Exception releasing lock:', err);
  }
}
