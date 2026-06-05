/**
 * Environment-aware logging utilities
 * These will help during development while keeping production logs clean
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Development-only console.log
 */
export function devLog(...args: unknown[]) {
  if (isDevelopment) {
    console.log('[DEV]', ...args);
  }
}

/**
 * Development-only console.warn
 */
export function devWarn(...args: unknown[]) {
  if (isDevelopment) {
    console.warn('[DEV]', ...args);
  }
}

/**
 * Development-only console.error
 */
export function devError(...args: unknown[]) {
  if (isDevelopment) {
    console.error('[DEV]', ...args);
  }
}

/**
 * Production-safe error logging
 * Logs to console in dev, sends to error tracking in production
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  console.error('[ERROR]', error, context);
}

/**
 * Performance timing utility
 */
export function timeOperation<T>(
  operationName: string,
  operation: () => T | Promise<T>
): T | Promise<T> {
  if (!isDevelopment) {
    return operation();
  }

  const start = performance.now();
  const result = operation();

  if (result instanceof Promise) {
    return result.then((value) => {
      const end = performance.now();
      console.log(`[PERF] ${operationName}: ${(end - start).toFixed(2)}ms`);
      return value;
    });
  }

  const end = performance.now();
  console.log(`[PERF] ${operationName}: ${(end - start).toFixed(2)}ms`);
  return result;
}

/**
 * API call logger
 */
export function logApiCall(method: string, url: string, status?: number, duration?: number) {
  if (isDevelopment) {
    const statusEmoji = status && status >= 200 && status < 300 ? '✅' : '❌';
    console.log(
      `[API] ${statusEmoji} ${method} ${url}`,
      status ? `(${status})` : '',
      duration ? `${duration.toFixed(0)}ms` : ''
    );
  }
}

/**
 * State change logger for debugging
 */
export function logStateChange(component: string, oldState: unknown, newState: unknown) {
  if (isDevelopment) {
    console.log(`[STATE] ${component}:`, {
      old: oldState,
      new: newState,
    });
  }
}
