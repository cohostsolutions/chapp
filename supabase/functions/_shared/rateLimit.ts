// Shared rate limiting utilities for edge functions
// Uses both in-memory and database-backed rate limiting

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Prefix for rate limit keys
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// In-memory rate limit store (good for single function instance)
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function fallbackToMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  reason: unknown
): RateLimitResult {
  console.warn('Rate limit database check failed; using in-memory fallback', reason);
  return checkMemoryRateLimit(`fallback:${key}`, config);
}

/**
 * Check rate limit using in-memory store
 * Fast but resets on cold start - use for burst protection
 */
export function checkMemoryRateLimit(
  key: string, 
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const record = memoryStore.get(key);
  
  if (!record || now > record.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { 
      allowed: true, 
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }
  
  if (record.count >= config.maxRequests) {
    return { 
      allowed: false, 
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    };
  }
  
  record.count++;
  return { 
    allowed: true, 
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * Check rate limit using database (persistent across cold starts)
 * Use for longer-term rate limiting
 */
export async function checkDatabaseRateLimit(
  supabase: SupabaseClient,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs);
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  
  try {
    // Use the increment_rate_limit function
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_key: fullKey,
      p_window_start: windowStart.toISOString(),
      p_increment: 1
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return fallbackToMemoryRateLimit(fullKey, config, error);
    }

    const count = data as number;
    const allowed = count <= config.maxRequests;
    const resetTime = windowStart.getTime() + config.windowMs;

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now.getTime()) / 1000)
    };
  } catch (err) {
    console.error('Rate limit error:', err);
    return fallbackToMemoryRateLimit(fullKey, config, err);
  }
}

/**
 * Combined rate limiter - uses memory for burst + database for persistent
 */
export async function checkCombinedRateLimit(
  supabase: SupabaseClient,
  key: string,
  burstConfig: RateLimitConfig,
  sustainedConfig: RateLimitConfig
): Promise<RateLimitResult> {
  // First check memory (burst protection)
  const burstResult = checkMemoryRateLimit(key, burstConfig);
  if (!burstResult.allowed) {
    return burstResult;
  }
  
  // Then check database (sustained protection)
  return await checkDatabaseRateLimit(supabase, key, sustainedConfig);
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  };
  
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  return headers;
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMITS = {
  // Public endpoints - strict limits
  publicApi: {
    burst: { windowMs: 60000, maxRequests: 20 },        // 20 req/min burst
    sustained: { windowMs: 3600000, maxRequests: 100 }  // 100 req/hour sustained
  },
  // Authenticated endpoints - more relaxed
  authenticatedApi: {
    burst: { windowMs: 60000, maxRequests: 60 },        // 60 req/min burst
    sustained: { windowMs: 3600000, maxRequests: 1000 } // 1000 req/hour sustained
  },
  // Demo/lead forms - very strict
  leadForms: {
    burst: { windowMs: 60000, maxRequests: 5 },         // 5 req/min burst
    sustained: { windowMs: 3600000, maxRequests: 10 }   // 10 req/hour sustained
  },
  // Webhooks - higher limits for external services
  webhooks: {
    burst: { windowMs: 60000, maxRequests: 100 },       // 100 req/min burst
    sustained: { windowMs: 3600000, maxRequests: 5000 } // 5000 req/hour sustained
  }
};

/**
 * Get client IP from request headers
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

/**
 * Clean up old in-memory rate limit entries
 */
export function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(key);
    }
  }
}

// Auto cleanup every 5 minutes
setInterval(cleanupMemoryStore, 300000);
