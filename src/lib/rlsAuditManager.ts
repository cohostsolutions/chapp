/**
 * RLS Audit Manager
 * 
 * Handles non-blocking RLS compliance checks that don't interfere with critical auth path.
 * RLS audit is important for security but should not block user login.
 * 
 * This module ensures:
 * 1. RLS checks happen in the background (non-blocking)
 * 2. Results are cached to avoid repeated checks
 * 3. Timeouts prevent hanging if database is slow
 * 4. Failures don't crash the auth flow
 */

import {
  auditRLSComplianceWithCache,
  auditRLSWithTimeout,
  getRLSCacheSnapshot,
  type RLSAuditResult
} from './rlsAudit';
import { devLog, devWarn, logError } from './logger';

interface RLSAuditState {
  isRunning: boolean;
  lastResult: RLSAuditResult | null;
  lastError: Error | null;
  lastRunAt: number;
}

const AUDIT_STATE: RLSAuditState = {
  isRunning: false,
  lastResult: null,
  lastError: null,
  lastRunAt: 0
};

// Callbacks for audit result events
type RLSAuditCallback = (result: RLSAuditResult | null, error: Error | null) => void;
const callbacks: RLSAuditCallback[] = [];

/**
 * Subscribe to RLS audit results
 * Called whenever audit completes (success or failure)
 */
export function subscribeToRLSAudit(callback: RLSAuditCallback): () => void {
  callbacks.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  };
}

/**
 * Get the current RLS audit state
 */
export function getRLSAuditState(): RLSAuditState {
  if (!AUDIT_STATE.lastResult && AUDIT_STATE.lastRunAt === 0) {
    const cache = getRLSCacheSnapshot();
    if (cache) {
      AUDIT_STATE.lastResult = cache.data;
      AUDIT_STATE.lastError = null;
      AUDIT_STATE.lastRunAt = cache.timestamp;
    }
  }

  return { ...AUDIT_STATE };
}

/**
 * OPTIMIZATION #4: Start non-blocking RLS audit
 * 
 * This function:
 * - Returns immediately (doesn't block auth)
 * - Runs audit in background with timeout
 * - Calls subscribers when complete
 * - Logs warnings if compliance issues found
 * - Never throws errors (gracefully handles all failures)
 * 
 * @param timeoutMs - How long to wait before giving up (default: 3000ms)
 * @returns Promise that resolves immediately (fire-and-forget pattern)
 */
export async function startNonBlockingRLSAudit(timeoutMs = 3000): Promise<void> {
  // Skip if already running
  if (AUDIT_STATE.isRunning) {
    devLog('rlsAuditManager', 'RLS audit already in progress, skipping');
    return;
  }

  AUDIT_STATE.isRunning = true;
  const startTime = Date.now();

  try {
    devLog('rlsAuditManager', `Starting background RLS audit (timeout: ${timeoutMs}ms)`);
    
    // Run audit with timeout - this is the key: doesn't block
    const result = await auditRLSWithTimeout(timeoutMs, true);

    const duration = Date.now() - startTime;
    
    if (result === null) {
      // Timeout occurred
      devLog('rlsAuditManager', `⏱️ RLS audit timed out after ${duration}ms`);
      AUDIT_STATE.lastError = new Error(`RLS audit timeout after ${timeoutMs}ms`);
      notifyCallbacks(null, AUDIT_STATE.lastError);
      return;
    }

    // Audit completed successfully
    AUDIT_STATE.lastResult = result;
    AUDIT_STATE.lastError = null;
    AUDIT_STATE.lastRunAt = startTime;

    devLog('rlsAuditManager', `✅ RLS audit completed in ${duration}ms`);
    
    // Log warnings if compliance issues found
    if (!result.overall_compliant && result.non_compliant_tables.length > 0) {
      devWarn(
        `⚠️ RLS Compliance Warning: ${result.non_compliant_tables.length} critical table(s) not fully compliant:`,
        result.non_compliant_tables
      );
    }

    notifyCallbacks(result, null);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    devLog('rlsAuditManager', `❌ RLS audit failed: ${err.message}`);
    
    AUDIT_STATE.lastError = err;
    AUDIT_STATE.lastResult = null;
    
    // Log but don't crash - non-critical failure
    logError(err, 'RLS audit error (non-blocking)');
    
    notifyCallbacks(null, err);
  } finally {
    AUDIT_STATE.isRunning = false;
  }
}

/**
 * Notify all subscribers of audit result
 */
function notifyCallbacks(result: RLSAuditResult | null, error: Error | null): void {
  callbacks.forEach(callback => {
    try {
      callback(result, error);
    } catch (err) {
      logError(err, 'Error in RLS audit callback');
    }
  });
}

/**
 * Clear the audit state and cache
 * Useful when RLS policies are updated
 */
export function clearRLSAuditState(): void {
  AUDIT_STATE.isRunning = false;
  AUDIT_STATE.lastResult = null;
  AUDIT_STATE.lastError = null;
  AUDIT_STATE.lastRunAt = 0;
}

/**
 * Get a readable status string for debugging/logging
 */
export function getRLSAuditStatus(): string {
  if (AUDIT_STATE.isRunning) {
    return '🔄 RLS audit in progress...';
  }
  
  if (AUDIT_STATE.lastError) {
    return `❌ RLS audit failed: ${AUDIT_STATE.lastError.message}`;
  }
  
  if (!AUDIT_STATE.lastResult) {
    return '⏳ RLS audit not yet run';
  }
  
  const { compliant_tables, total_tables, overall_compliant } = AUDIT_STATE.lastResult;
  const status = overall_compliant ? '✅' : '⚠️';
  
  return `${status} RLS: ${compliant_tables}/${total_tables} tables compliant`;
}
