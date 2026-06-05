/**
 * Timeout Handling Utilities
 * Request timeouts, retry logic, and error recovery (TIMEOUT-001)
 * Exponential backoff, configurable timeouts, and automatic retries
 */

import * as React from 'react';

/**
 * Timeout configuration options
 */
export interface TimeoutConfig {
  /** Initial timeout in milliseconds (default: 30000 = 30 seconds) */
  timeout?: number;
  /** Maximum timeout in milliseconds (default: 120000 = 2 minutes) */
  maxTimeout?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Exponential backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Initial backoff delay in milliseconds (default: 1000) */
  initialBackoff?: number;
  /** Maximum backoff delay in milliseconds (default: 30000) */
  maxBackoff?: number;
  /** Enable automatic retries (default: true) */
  autoRetry?: boolean;
  /** Retry only on specific error codes */
  retryableStatusCodes?: number[];
  /** Callback for timeout events */
  onTimeout?: () => void;
  /** Callback for retry attempts */
  onRetry?: (attempt: number, delay: number) => void;
  /** Callback for final failure */
  onFailure?: (error: Error) => void;
}

/**
 * Default configuration constants
 */
export const DEFAULT_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_MAX_TIMEOUT = 120000; // 2 minutes
export const DEFAULT_RETRIES = 3;
export const DEFAULT_BACKOFF_MULTIPLIER = 1.5;
export const DEFAULT_INITIAL_BACKOFF = 1000; // 1 second
export const DEFAULT_MAX_BACKOFF = 30000; // 30 seconds

/**
 * Default retryable HTTP status codes
 */
export const DEFAULT_RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Timeout error class
 */
export class TimeoutError extends Error {
  constructor(
    message: string = 'Request timeout',
    public readonly timeoutMs: number = 0,
    public readonly attempt: number = 0
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Maximum retries exceeded error
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    message: string = 'Maximum retries exceeded',
    public readonly totalAttempts: number = 0
  ) {
    super(message);
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Create a promise that resolves after a timeout
 */
export function createTimeoutPromise<T>(
  ms: number,
  message?: string
): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(message || `Timeout after ${ms}ms`, ms));
    }, ms);
  });
}

/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([
    promise,
    createTimeoutPromise<T>(ms, message),
  ]);
}

/**
 * Calculate backoff delay with exponential increase
 */
export function calculateBackoffDelay(
  attempt: number,
  config: TimeoutConfig = {}
): number {
  const {
    initialBackoff = DEFAULT_INITIAL_BACKOFF,
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    maxBackoff = DEFAULT_MAX_BACKOFF,
  } = config;

  // Exponential backoff: initialBackoff * (multiplier ^ (attempt - 1))
  // Add jitter to prevent thundering herd
  const baseDelay = initialBackoff * Math.pow(backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.1 * baseDelay; // 0-10% jitter
  const delay = Math.min(baseDelay + jitter, maxBackoff);

  return Math.round(delay);
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(
  error: any,
  config: TimeoutConfig = {}
): boolean {
  // Always retry on timeout
  if (error instanceof TimeoutError) {
    return true;
  }

  // Check for retryable status codes
  const { retryableStatusCodes = DEFAULT_RETRYABLE_STATUS_CODES } = config;
  if (error?.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }

  // Check for network errors
  if (error?.message?.includes('network') || error?.message?.includes('offline')) {
    return true;
  }

  return false;
}

/**
 * Execute a function with automatic retries and exponential backoff
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: TimeoutConfig = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    maxTimeout = DEFAULT_MAX_TIMEOUT,
    retries = DEFAULT_RETRIES,
    autoRetry = true,
    onTimeout,
    onRetry,
    onFailure,
  } = config;

  let lastError: Error | null = null;
  let currentTimeout = timeout;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // Increase timeout for each attempt
      currentTimeout = Math.min(currentTimeout * 1.2, maxTimeout);

      // Execute with timeout
      const result = await withTimeout(fn(), currentTimeout);
      return result;
    } catch (error: any) {
      lastError = error;

      // Check if error is timeout
      if (error instanceof TimeoutError) {
        onTimeout?.();
      }

      // Check if we should retry
      const shouldRetry = attempt <= retries && autoRetry && isRetryableError(error, config);

      if (shouldRetry) {
        const delay = calculateBackoffDelay(attempt, config);
        onRetry?.(attempt, delay);

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Final failure
        onFailure?.(error);
        throw error;
      }
    }
  }

  // Should not reach here, but throw last error if we do
  if (lastError) {
    throw new MaxRetriesExceededError(
      `Failed after ${retries + 1} attempts`,
      retries + 1
    );
  }

  throw new Error('Unknown error in executeWithRetry');
}

/**
 * Fetch with timeout and retry support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & TimeoutConfig = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    onRetry,
    onFailure,
    ...fetchOptions
  } = options;

  return executeWithRetry(
    async () => {
      const response = await withTimeout(
        fetch(url, fetchOptions),
        timeout,
        `Fetch timeout after ${timeout}ms`
      );

      // Check for HTTP errors
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return response;
    },
    { timeout, onRetry, onFailure, ...options }
  );
}

/**
 * React hook for timeout handling
 */
export function useTimeout(
  callback: () => void,
  delay: number | null
): void {
  React.useEffect(() => {
    if (delay === null) return;

    const timeout = setTimeout(callback, delay);
    return () => clearTimeout(timeout);
  }, [callback, delay]);
}

/**
 * React hook for request with timeout
 */
export interface UseTimeoutRequestState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
  cancel: () => void;
}

export function useTimeoutRequest<T>(
  fn: () => Promise<T>,
  config: TimeoutConfig = {},
  dependencies: React.DependencyList = []
): UseTimeoutRequestState<T> {
  const [state, setState] = React.useState<UseTimeoutRequestState<T>>({
    data: null,
    loading: true,
    error: null,
    retry: async () => {},
    cancel: () => {},
  });

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const timeoutIdRef = React.useRef<NodeJS.Timeout | null>(null);

  const executeRequest = React.useCallback(async () => {
    abortControllerRef.current = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await executeWithRetry(fn, {
        ...config,
        onFailure: (error) => {
          config.onFailure?.(error);
        },
      });

      if (!abortControllerRef.current?.signal.aborted) {
        setState((prev) => ({ ...prev, data, loading: false }));
      }
    } catch (error: any) {
      if (!abortControllerRef.current?.signal.aborted) {
        setState((prev) => ({ ...prev, error, loading: false }));
      }
    }
  }, [fn, config]);

  React.useEffect(() => {
    executeRequest();

    return () => {
      abortControllerRef.current?.abort();
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, dependencies);

  const retry = React.useCallback(async () => {
    await executeRequest();
  }, [executeRequest]);

  const cancel = React.useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({ ...prev, loading: false }));
  }, []);

  return {
    ...state,
    retry,
    cancel,
  };
}

/**
 * Timeout configuration preset
 */
export enum TimeoutPreset {
  INSTANT = 5000, // 5 seconds
  FAST = 10000, // 10 seconds
  NORMAL = 30000, // 30 seconds (default)
  SLOW = 60000, // 60 seconds
  VERY_SLOW = 120000, // 2 minutes
}

/**
 * Get timeout configuration for a preset
 */
export function getPresetConfig(preset: TimeoutPreset): TimeoutConfig {
  return {
    timeout: preset,
    maxTimeout: Math.min(preset * 4, 300000), // Max 5 minutes
    retries: preset <= 10000 ? 5 : 3,
  };
}

/**
 * Create a timeout manager for complex operations
 */
export class TimeoutManager {
  private timeoutId: NodeJS.Timeout | null = null;
  private config: TimeoutConfig;
  private startTime: number = 0;
  private elapsedTime: number = 0;

  constructor(config: TimeoutConfig = {}) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      ...config,
    };
  }

  /**
   * Start the timeout
   */
  start(): void {
    this.startTime = Date.now();
    this.elapsedTime = 0;

    this.timeoutId = setTimeout(() => {
      this.config.onTimeout?.();
    }, this.config.timeout);
  }

  /**
   * Clear the timeout
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.startTime = 0;
    this.elapsedTime = 0;
  }

  /**
   * Get elapsed time
   */
  getElapsed(): number {
    if (this.startTime === 0) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get remaining time
   */
  getRemaining(): number {
    const remaining = (this.config.timeout || 0) - this.getElapsed();
    return Math.max(0, remaining);
  }

  /**
   * Check if timeout has been exceeded
   */
  isExceeded(): boolean {
    return this.getRemaining() <= 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimeoutConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset the timeout
   */
  reset(): void {
    this.clear();
    this.start();
  }

  /**
   * Extend the timeout
   */
  extend(ms: number): void {
    this.config.timeout = (this.config.timeout || 0) + ms;
    this.reset();
  }

  /**
   * Get formatted remaining time
   */
  getFormattedRemaining(): string {
    const remaining = this.getRemaining();
    const seconds = Math.ceil(remaining / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  }
}

/**
 * Race multiple promises with timeout
 */
export async function raceWithTimeout<T>(
  promises: Promise<T>[],
  timeout: number,
  message?: string
): Promise<T> {
  return Promise.race([
    ...promises,
    createTimeoutPromise<T>(timeout, message),
  ]);
}

/**
 * All promises with timeout
 */
export async function allWithTimeout<T>(
  promises: Promise<T>[],
  timeout: number,
  message?: string
): Promise<T[]> {
  return Promise.race([
    Promise.all(promises),
    createTimeoutPromise<T[]>(timeout, message),
  ]) as Promise<T[]>;
}

/**
 * Validate timeout configuration
 */
export function validateTimeoutConfig(config: TimeoutConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.timeout && config.timeout < 0) {
    errors.push('timeout must be >= 0');
  }

  if (config.retries && config.retries < 0) {
    errors.push('retries must be >= 0');
  }

  if (config.backoffMultiplier && config.backoffMultiplier <= 1) {
    errors.push('backoffMultiplier must be > 1');
  }

  if (
    config.timeout &&
    config.maxTimeout &&
    config.timeout > config.maxTimeout
  ) {
    errors.push('timeout must be <= maxTimeout');
  }

  if (
    config.initialBackoff &&
    config.maxBackoff &&
    config.initialBackoff > config.maxBackoff
  ) {
    errors.push('initialBackoff must be <= maxBackoff');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
