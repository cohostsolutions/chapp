/**
 * Client-side caching utilities
 * 
 * Uses in-memory caching for client-side operations.
 * For persistent caching with Redis/Upstash, use Supabase Edge Functions
 * with non-VITE prefixed environment variables (never expose credentials client-side).
 * 
 * SECURITY NOTE: Redis/Upstash credentials must NEVER be exposed in client-side code.
 * All external cache operations should be performed via Edge Functions.
 */

import { devLog, devError } from './logger';

// In-memory cache for client-side operations
class InMemoryCache {
  private store = new Map<string, { value: unknown; expiry: number | null }>();
  private maxSize = 1000; // Prevent unbounded growth

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    devLog(`[CACHE] HIT: ${key}`);
    return item.value as T;
  }

  async set(key: string, value: unknown, options?: { ex?: number }) {
    // Prevent unbounded growth
    if (this.store.size >= this.maxSize) {
      this.cleanup();
    }
    
    const expiry = options?.ex ? Date.now() + options.ex * 1000 : null;
    this.store.set(key, { value, expiry });
    devLog(`[CACHE] SET: ${key}`, options?.ex ? `(${options.ex}s)` : '');
    return 'OK';
  }

  async del(key: string) {
    const deleted = this.store.delete(key);
    devLog(`[CACHE] DEL: ${key}`);
    return deleted ? 1 : 0;
  }

  async setex(key: string, seconds: number, value: unknown) {
    return this.set(key, value, { ex: seconds });
  }

  async incr(key: string) {
    const current = (await this.get(key)) || 0;
    const newValue = Number(current) + 1;
    await this.set(key, newValue);
    return newValue;
  }

  async expire(key: string, seconds: number) {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiry = Date.now() + seconds * 1000;
    return 1;
  }

  private cleanup() {
    const now = Date.now();
    // Remove expired entries
    for (const [key, item] of this.store.entries()) {
      if (item.expiry && item.expiry < now) {
        this.store.delete(key);
      }
    }
    // If still too large, remove oldest entries
    if (this.store.size >= this.maxSize) {
      const keysToRemove = Array.from(this.store.keys()).slice(0, Math.floor(this.maxSize / 4));
      keysToRemove.forEach(key => this.store.delete(key));
    }
  }
}

// Single in-memory cache instance
const cacheInstance = new InMemoryCache();

async function getCacheClient() {
  // Always use in-memory cache for client-side
  // For persistent caching, use Edge Functions with server-side Redis
  devLog('[CACHE] Using in-memory cache (client-side)');
  return cacheInstance;
}

/**
 * Cache wrapper with automatic serialization
 */
export const cache = {
  /**
   * Get a value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const client = await getCacheClient();
      const value = await client.get<unknown>(key);
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      }
      return value as T;
    } catch (error) {
      devError('[CACHE] Get error:', error);
      return null;
    }
  },

  /**
   * Set a value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const client = await getCacheClient();
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, serialized);
      } else {
        await client.set(key, serialized);
      }
      return true;
    } catch (error) {
      devError('[CACHE] Set error:', error);
      return false;
    }
  },

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const client = await getCacheClient();
      await client.del(key);
      return true;
    } catch (error) {
      devError('[CACHE] Delete error:', error);
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  },

  /**
   * Get or set pattern - fetch from cache, or compute and cache if missing
   */
  async getOrSet<T = unknown>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = (await this.get(key)) as T | null;
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetchFn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },

  /**
   * Invalidate cache by pattern
   * Note: Pattern invalidation is limited in in-memory cache
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // In-memory cache doesn't support pattern matching
      // For production, use Edge Functions with server-side Redis
      devLog('[CACHE] Pattern invalidation not supported in client-side cache');
    } catch (error) {
      devError('[CACHE] Invalidate pattern error:', error);
    }
  },
};

/**
 * Rate limiting using in-memory cache (client-side)
 * For persistent rate limiting, use Supabase Edge Functions with database-backed rate limits
 */
export const rateLimit = {
  /**
   * Check if action is allowed under rate limit
   * @param key - Unique identifier (e.g., user ID or IP)
   * @param limit - Maximum number of actions
   * @param windowSeconds - Time window in seconds
   */
  async check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const client = await getCacheClient();
      const rateLimitKey = `ratelimit:${key}`;
      
      const current = await client.incr(rateLimitKey);
      
      if (current === 1) {
        await client.expire(rateLimitKey, windowSeconds);
      }
      
      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      
      return { allowed, remaining };
    } catch (error) {
      devError('[RATE LIMIT] Check error:', error);
      // On error, allow the request
      return { allowed: true, remaining: limit };
    }
  },
};

/**
 * Common cache keys
 */
export const CacheKeys = {
  // AI responses cache
  aiResponse: (prompt: string) => `ai:response:${hashString(prompt)}`,
  
  // Knowledge base cache
  knowledgeBase: (orgId: string) => `kb:${orgId}`,
  knowledgeBaseEntry: (id: string) => `kb:entry:${id}`,
  
  // Lead stats cache
  leadStats: (orgId: string) => `stats:leads:${orgId}`,
  
  // Dashboard stats
  dashboardStats: (orgId: string, userId?: string) => 
    userId ? `dashboard:${orgId}:${userId}` : `dashboard:${orgId}`,
  
  // User session
  userSession: (userId: string) => `session:${userId}`,
  
  // Rate limiting
  rateLimit: (identifier: string, action: string) => `ratelimit:${action}:${identifier}`,
};

/**
 * Simple string hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
};
