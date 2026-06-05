/**
 * API Rate Limiting Utilities
 * 
 * Implements per-endpoint and per-user rate limiting
 * Prevents DoS attacks and abuse of API endpoints
 * 
 * Rate Limits:
 * - Normal endpoints: 100 requests/minute
 * - Export endpoints: 10 requests/minute
 * - Auth endpoints: 5 requests/minute
 * - Sensitive operations: 3 requests/minute
 */

/**
 * Rate limit bucket for tracking requests
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
  lastReset: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requestsPerWindow: number; // Max requests allowed
  windowMs: number; // Time window in milliseconds
  message?: string; // Custom message for limit exceeded
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  NORMAL: {
    requestsPerWindow: 100,
    windowMs: 60000, // 1 minute
    message: 'Too many requests, please try again later'
  },
  EXPORT: {
    requestsPerWindow: 10,
    windowMs: 60000, // 1 minute
    message: 'Export limit exceeded, try again in a few moments'
  },
  AUTH: {
    requestsPerWindow: 5,
    windowMs: 60000, // 1 minute
    message: 'Too many login attempts, please try again later'
  },
  SENSITIVE: {
    requestsPerWindow: 3,
    windowMs: 60000, // 1 minute
    message: 'Too many sensitive operations, please slow down'
  },
  IMPORT: {
    requestsPerWindow: 5,
    windowMs: 60000, // 1 minute
    message: 'Import limit exceeded, try again after a minute'
  }
};

/**
 * In-memory rate limit buckets
 * In production, use Redis or database for distributed rate limiting
 */
class RateLimitManager {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up old buckets every 5 minutes
    this.startCleanup();
  }

  /**
   * Check if request is allowed
   * Returns true if within limit, false if exceeded
   */
  isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    // Create new bucket if needed
    if (!bucket) {
      bucket = {
        count: 1,
        resetAt: now + config.windowMs,
        lastReset: now
      };
      this.buckets.set(key, bucket);
      return true;
    }

    // Reset if window has passed
    if (now >= bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = now + config.windowMs;
      bucket.lastReset = now;
      return true;
    }

    // Check if limit exceeded
    if (bucket.count >= config.requestsPerWindow) {
      return false;
    }

    // Increment count
    bucket.count++;
    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string, config: RateLimitConfig): number {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return config.requestsPerWindow;
    }

    const remaining = config.requestsPerWindow - bucket.count;
    return Math.max(0, remaining);
  }

  /**
   * Get reset time in milliseconds
   */
  getResetTime(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return 0;
    }

    const now = Date.now();
    const remaining = bucket.resetAt - now;
    return Math.max(0, remaining);
  }

  /**
   * Reset a specific key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all buckets for a user
   */
  resetUser(userId: string): void {
    const keysToDelete = Array.from(this.buckets.keys()).filter(key =>
      key.startsWith(`user:${userId}:`)
    );
    keysToDelete.forEach(key => this.buckets.delete(key));
  }

  /**
   * Start cleanup of old buckets
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.buckets.forEach((bucket, key) => {
        // Delete buckets that haven't been accessed in 10 minutes
        if (now - bucket.lastReset > 600000) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.buckets.delete(key));
    }, 300000); // Run every 5 minutes
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const manager = new RateLimitManager();

/**
 * Rate limit response headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

/**
 * Check rate limit for a specific endpoint and user
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.NORMAL
): { allowed: boolean; headers: RateLimitHeaders; message?: string } {
  const key = `user:${userId}:${endpoint}`;
  const allowed = manager.isAllowed(key, config);
  const remaining = manager.getRemaining(key, config);
  const resetTime = manager.getResetTime(key);

  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': config.requestsPerWindow.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining - 1).toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
  };

  if (!allowed) {
    headers['Retry-After'] = Math.ceil(resetTime / 1000).toString();
  }

  return {
    allowed,
    headers,
    message: allowed ? undefined : config.message
  };
}

/**
 * Create a rate-limited async function wrapper
 * Automatically enforces rate limiting on async operations
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  userId: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.NORMAL
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async (...args: Parameters<T>) => {
    const result = checkRateLimit(userId, endpoint, config);

    if (!result.allowed) {
      throw new Error(`Rate limit exceeded: ${result.message}`);
    }

    return await fn(...args);
  };
}

/**
 * Track API usage for analytics
 */
export interface APIUsageStats {
  userId: string;
  endpoint: string;
  requestCount: number;
  lastRequestAt: string;
  totalLimitedRequests: number;
}

class APIUsageTracker {
  private usage: Map<string, APIUsageStats> = new Map();

  trackRequest(userId: string, endpoint: string): void {
    const key = `${userId}:${endpoint}`;
    const stats = this.usage.get(key) || {
      userId,
      endpoint,
      requestCount: 0,
      lastRequestAt: new Date().toISOString(),
      totalLimitedRequests: 0
    };

    stats.requestCount++;
    stats.lastRequestAt = new Date().toISOString();
    this.usage.set(key, stats);
  }

  trackLimitedRequest(userId: string, endpoint: string): void {
    const key = `${userId}:${endpoint}`;
    const stats = this.usage.get(key);

    if (stats) {
      stats.totalLimitedRequests++;
    } else {
      this.trackRequest(userId, endpoint);
      const newStats = this.usage.get(key)!;
      newStats.totalLimitedRequests = 1;
    }
  }

  getStats(userId: string, endpoint?: string): APIUsageStats[] {
    const results: APIUsageStats[] = [];

    this.usage.forEach((stats, key) => {
      if (stats.userId === userId && (!endpoint || stats.endpoint === endpoint)) {
        results.push(stats);
      }
    });

    return results;
  }

  clearStats(userId: string): void {
    const keysToDelete: string[] = [];
    this.usage.forEach((stats, key) => {
      if (stats.userId === userId) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.usage.delete(key));
  }
}

const usageTracker = new APIUsageTracker();

/**
 * Create middleware-style rate limiting for express-like frameworks
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.NORMAL
) {
  return function rateLimitMiddleware(req: any, res: any, next: any) {
    const userId = req.user?.id || req.ip;
    const endpoint = req.path;

    const result = checkRateLimit(userId, endpoint, config);

    // Set rate limit headers
    Object.entries(result.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (!result.allowed) {
      usageTracker.trackLimitedRequest(userId, endpoint);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: result.message,
        retryAfter: result.headers['Retry-After']
      });
    }

    usageTracker.trackRequest(userId, endpoint);
    next();
  };
}

/**
 * Endpoint-specific rate limiters
 */
export const endpointLimiters = {
  /**
   * Login endpoint (strict)
   */
  login: (userId: string) =>
    checkRateLimit(userId, 'login', RATE_LIMIT_CONFIGS.AUTH),

  /**
   * Register endpoint (strict)
   */
  register: (userId: string) =>
    checkRateLimit(userId, 'register', RATE_LIMIT_CONFIGS.AUTH),

  /**
   * Password reset (strict)
   */
  passwordReset: (userId: string) =>
    checkRateLimit(userId, 'password-reset', RATE_LIMIT_CONFIGS.AUTH),

  /**
   * Data export (strict)
   */
  export: (userId: string) =>
    checkRateLimit(userId, 'export', RATE_LIMIT_CONFIGS.EXPORT),

  /**
   * Data import (strict)
   */
  import: (userId: string) =>
    checkRateLimit(userId, 'import', RATE_LIMIT_CONFIGS.IMPORT),

  /**
   * Delete operation (sensitive)
   */
  delete: (userId: string) =>
    checkRateLimit(userId, 'delete', RATE_LIMIT_CONFIGS.SENSITIVE),

  /**
   * Bulk operations (sensitive)
   */
  bulkOperation: (userId: string) =>
    checkRateLimit(userId, 'bulk-op', RATE_LIMIT_CONFIGS.SENSITIVE),

  /**
   * Search endpoint (normal)
   */
  search: (userId: string) =>
    checkRateLimit(userId, 'search', RATE_LIMIT_CONFIGS.NORMAL),

  /**
   * List endpoint (normal)
   */
  list: (userId: string) =>
    checkRateLimit(userId, 'list', RATE_LIMIT_CONFIGS.NORMAL),

  /**
   * Create operation (normal)
   */
  create: (userId: string) =>
    checkRateLimit(userId, 'create', RATE_LIMIT_CONFIGS.NORMAL),

  /**
   * Update operation (normal)
   */
  update: (userId: string) =>
    checkRateLimit(userId, 'update', RATE_LIMIT_CONFIGS.NORMAL)
};

/**
 * Reset rate limit for a user (admin function)
 */
export function resetUserRateLimit(userId: string): void {
  manager.resetUser(userId);
  usageTracker.clearStats(userId);
}

/**
 * Get usage statistics for a user
 */
export function getUserUsageStats(userId: string): APIUsageStats[] {
  return usageTracker.getStats(userId);
}

/**
 * Export manager for testing/cleanup
 */
export { manager as rateLimitManager };
