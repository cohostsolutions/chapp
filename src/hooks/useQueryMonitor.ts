import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isDevelopmentMode } from '@/lib/env';
import { devWarn } from '@/lib/logger';

interface QueryMetrics {
  queryKey: string;
  duration: number;
  timestamp: number;
  status: 'success' | 'error';
  cached: boolean;
}

interface UseQueryMonitorOptions {
  enabled?: boolean;
  slowQueryThreshold?: number; // ms
  onSlowQuery?: (metrics: QueryMetrics) => void;
  maxHistory?: number;
}

const metricsHistory: QueryMetrics[] = [];
const MAX_HISTORY = 100;

/**
 * Hook for monitoring React Query performance
 * Tracks slow queries and provides insights
 */
export function useQueryMonitor(options: UseQueryMonitorOptions = {}) {
  const { 
    enabled = isDevelopmentMode(),
    slowQueryThreshold = 1000,
    onSlowQuery,
    maxHistory = MAX_HISTORY
  } = options;
  
  const queryClient = useQueryClient();

  const recordMetric = useCallback((metrics: QueryMetrics) => {
    if (!enabled) return;
    
    metricsHistory.push(metrics);
    if (metricsHistory.length > maxHistory) {
      metricsHistory.shift();
    }

    if (metrics.duration > slowQueryThreshold) {
      devWarn(`[Slow Query] ${metrics.queryKey} took ${metrics.duration}ms`, metrics);
      onSlowQuery?.(metrics);
    }
  }, [enabled, slowQueryThreshold, onSlowQuery, maxHistory]);

  const getMetrics = useCallback(() => {
    return {
      total: metricsHistory.length,
      slow: metricsHistory.filter(m => m.duration > slowQueryThreshold).length,
      avgDuration: metricsHistory.length > 0 
        ? metricsHistory.reduce((sum, m) => sum + m.duration, 0) / metricsHistory.length 
        : 0,
      errorRate: metricsHistory.length > 0
        ? metricsHistory.filter(m => m.status === 'error').length / metricsHistory.length
        : 0,
      cacheHitRate: metricsHistory.length > 0
        ? metricsHistory.filter(m => m.cached).length / metricsHistory.length
        : 0,
      slowestQueries: [...metricsHistory]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
      recentErrors: metricsHistory
        .filter(m => m.status === 'error')
        .slice(-5),
    };
  }, [slowQueryThreshold]);

  const clearMetrics = useCallback(() => {
    metricsHistory.length = 0;
  }, []);

  return {
    recordMetric,
    getMetrics,
    clearMetrics,
    isEnabled: enabled,
  };
}

/**
 * Wrapper to time a query function
 */
export function withQueryTiming<T>(
  queryFn: () => Promise<T>,
  queryKey: string,
  onComplete?: (metrics: QueryMetrics) => void
): () => Promise<T> {
  return async () => {
    const startTime = performance.now();
    let status: 'success' | 'error' = 'success';
    
    try {
      const result = await queryFn();
      return result;
    } catch (error) {
      status = 'error';
      throw error;
    } finally {
      const duration = Math.round(performance.now() - startTime);
      onComplete?.({
        queryKey,
        duration,
        timestamp: Date.now(),
        status,
        cached: false,
      });
    }
  };
}

/**
 * Hook for query prefetching optimization
 */
export function useQueryPrefetch() {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchIfNeeded = useCallback(async <T>(
    queryKey: string[],
    queryFn: () => Promise<T>,
    staleTime = 60000
  ) => {
    const keyString = queryKey.join('-');
    
    // Don't prefetch if already prefetched recently
    if (prefetchedRef.current.has(keyString)) {
      return;
    }
    
    // Check if data is already fresh
    const state = queryClient.getQueryState(queryKey);
    if (state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt < staleTime) {
      return;
    }

    prefetchedRef.current.add(keyString);
    
    // Clear from set after staleTime
    setTimeout(() => {
      prefetchedRef.current.delete(keyString);
    }, staleTime);

    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime,
    });
  }, [queryClient]);

  return { prefetchIfNeeded };
}

/**
 * Get query cache stats
 */
export function useQueryCacheStats() {
  const queryClient = useQueryClient();

  const getStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      cacheSize: JSON.stringify(queries.map(q => q.state.data)).length,
    };
  }, [queryClient]);

  return { getStats };
}
