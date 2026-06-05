/**
 * Custom Error Tracking System
 * 
 * A lightweight error tracking solution that stores errors in the database
 * without requiring external services like Sentry.
 * 
 * Features:
 * - Error logging with stack traces
 * - User context tracking
 * - Browser/device info capture
 * - Breadcrumb trail for debugging
 * - Performance timing
 */

import { supabase } from '@/integrations/supabase/client';
import { devError } from './logger';

interface ErrorContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  organizationId?: string;
  route?: string;
  componentName?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

interface Breadcrumb {
  type: 'navigation' | 'click' | 'api' | 'console' | 'error' | 'user';
  category: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  type: string;
  timestamp: string;
  url: string;
  userAgent: string;
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
  deviceInfo: {
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    language: string;
    platform: string;
    online: boolean;
  };
}

// In-memory breadcrumb storage
const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

// User context
let userContext: ErrorContext = {};

// Debug mode
const isDebug = import.meta.env.DEV;

/**
 * Initialize error tracking
 */
export function initErrorTracking(): void {
  if (typeof window === 'undefined') return;

  // Global error handler
  window.addEventListener('error', (event) => {
    captureError(event.error || new Error(event.message), {
      componentName: 'window',
      action: 'unhandled_error',
    });
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    captureError(error, {
      componentName: 'window',
      action: 'unhandled_rejection',
    });
  });

  // Track navigation
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    addBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: `Navigate to ${args[2]}`,
      data: { url: args[2] },
    });
    return originalPushState.apply(this, args);
  };

  // Track clicks on interactive elements
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button, a')) {
      const element = target.closest('button, a') || target;
      const text = element.textContent?.slice(0, 50) || '';
      const id = element.id || element.getAttribute('data-testid') || '';
      
      addBreadcrumb({
        type: 'click',
        category: 'ui.click',
        message: `Click on ${element.tagName.toLowerCase()}${id ? `#${id}` : ''}: ${text}`,
        data: { tagName: element.tagName, id, text },
      });
    }
  }, { capture: true });

  if (isDebug) {
    console.log('[ErrorTracking] Initialized');
  }
}

/**
 * Set user context for error reports
 */
export function setUserContext(context: Partial<ErrorContext>): void {
  userContext = { ...userContext, ...context };
  
  if (isDebug) {
    console.log('[ErrorTracking] User context set:', userContext);
  }
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  userContext = {};
  breadcrumbs.length = 0;
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>): void {
  const breadcrumb: Breadcrumb = {
    ...crumb,
    timestamp: Date.now(),
  };

  breadcrumbs.push(breadcrumb);
  
  // Keep only the last N breadcrumbs
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }

  if (isDebug) {
    console.log('[ErrorTracking] Breadcrumb:', breadcrumb);
  }
}

/**
 * Capture and log an error
 */
export async function captureError(
  error: Error | unknown,
  context: Partial<ErrorContext> = {}
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  
  const report: ErrorReport = {
    message: err.message,
    stack: err.stack,
    type: err.name || 'Error',
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    context: { ...userContext, ...context },
    breadcrumbs: [...breadcrumbs],
    deviceInfo: getDeviceInfo(),
  };

  // Log to console in development
  if (isDebug) {
    console.error('[ErrorTracking] Captured error:', report);
  }

  // Store in database (non-blocking)
  try {
    await storeErrorReport(report);
  } catch (storeError) {
    // Don't let storage errors cause more problems
    devError('[ErrorTracking] Failed to store error:', storeError);
  }
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context: Partial<ErrorContext> = {}
): void {
  addBreadcrumb({
    type: level === 'error' ? 'error' : 'console',
    category: 'message',
    message,
    data: { level, ...context },
  });

  if (isDebug) {
    const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    logFn(`[ErrorTracking] ${level.toUpperCase()}:`, message, context);
  }
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: Partial<ErrorContext> = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      await captureError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Get device/browser info
 */
function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      screenWidth: 0,
      screenHeight: 0,
      devicePixelRatio: 1,
      language: 'en',
      platform: 'unknown',
      online: true,
    };
  }

  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    language: navigator.language,
    platform: navigator.platform,
    online: navigator.onLine,
  };
}

/**
 * Store error report in database
 */
async function storeErrorReport(report: ErrorReport): Promise<void> {
  // Use analytics_events table which already exists
  const { error } = await supabase
    .from('analytics_events')
    .insert([{
      event_type: 'error',
      event_category: 'error_tracking',
      event_action: report.type,
      event_label: report.message.slice(0, 500),
      page_path: report.url,
      user_agent: report.userAgent,
      metadata: JSON.parse(JSON.stringify({
        stack: report.stack?.slice(0, 5000),
        context: report.context,
        breadcrumbs: report.breadcrumbs.slice(-20),
        deviceInfo: report.deviceInfo,
      })),
    }]);

  if (error) {
    devError('[ErrorTracking] Database insert failed:', error);
  }
}

/**
 * Performance timing wrapper
 */
export function timeOperation<T>(
  operationName: string,
  operation: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  
  try {
    const result = operation();
    
    if (result instanceof Promise) {
      return result.then((value) => {
        const duration = performance.now() - start;
        addBreadcrumb({
          type: 'api',
          category: 'performance',
          message: `${operationName} completed in ${duration.toFixed(2)}ms`,
          data: { duration, operationName },
        });
        return value;
      }).catch((error) => {
        const duration = performance.now() - start;
        addBreadcrumb({
          type: 'error',
          category: 'performance',
          message: `${operationName} failed after ${duration.toFixed(2)}ms`,
          data: { duration, operationName, error: String(error) },
        });
        throw error;
      });
    }
    
    const duration = performance.now() - start;
    addBreadcrumb({
      type: 'api',
      category: 'performance',
      message: `${operationName} completed in ${duration.toFixed(2)}ms`,
      data: { duration, operationName },
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    addBreadcrumb({
      type: 'error',
      category: 'performance',
      message: `${operationName} failed after ${duration.toFixed(2)}ms`,
      data: { duration, operationName, error: String(error) },
    });
    throw error;
  }
}

// Export default for easy initialization
export default {
  init: initErrorTracking,
  setUser: setUserContext,
  clearUser: clearUserContext,
  captureError,
  captureMessage,
  addBreadcrumb,
  timeOperation,
  withErrorTracking,
};
