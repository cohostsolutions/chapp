/**
 * Request tracing and performance metrics for AI Training features
 * Tracks API calls, response times, and success/failure rates
 */

import { devLog, devWarn } from '../logger';

export interface RequestMetric {
  requestId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

class MetricsTracker {
  private metrics: Map<string, RequestMetric> = new Map();
  private readonly MAX_METRICS = 1000; // Keep last 1000 requests

  /**
   * Generate a unique request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Start tracking a new request
   */
  startRequest(operation: string, metadata?: Record<string, unknown>): string {
    const requestId = this.generateRequestId();
    const metric: RequestMetric = {
      requestId,
      operation,
      startTime: Date.now(),
      status: 'pending',
      metadata,
    };

    this.metrics.set(requestId, metric);
    this.pruneOldMetrics();

    devLog(`[TRACE] Starting ${operation}`, { requestId, metadata });
    return requestId;
  }

  /**
   * Mark a request as successful
   */
  endRequest(requestId: string, metadata?: Record<string, unknown>): void {
    const metric = this.metrics.get(requestId);
    if (!metric) {
      devWarn(`[TRACE] Request ${requestId} not found (endRequest)`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;
    metric.status = 'success';
    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata };
    }

    this.metrics.set(requestId, metric);

    devLog(`[TRACE] Completed ${metric.operation}`, {
      requestId,
      duration: `${duration}ms`,
      status: 'success',
    });
  }

  /**
   * Mark a request as failed
   */
  errorRequest(requestId: string, error: Error | string): void {
    const metric = this.metrics.get(requestId);
    if (!metric) {
      devWarn(`[TRACE] Request ${requestId} not found (errorRequest)`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    const errorMessage = error instanceof Error ? error.message : error;

    metric.endTime = endTime;
    metric.duration = duration;
    metric.status = 'error';
    metric.errorMessage = errorMessage;

    this.metrics.set(requestId, metric);

    devWarn(`[TRACE] Failed ${metric.operation}`, {
      requestId,
      duration: `${duration}ms`,
      error: errorMessage,
    });
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): RequestMetric[] {
    return Array.from(this.metrics.values()).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsByOperation(operation: string): RequestMetric[] {
    return this.getAllMetrics().filter(m => m.operation === operation);
  }

  /**
   * Calculate success rate for an operation
   */
  getSuccessRate(operation?: string): number {
    const metrics = operation
      ? this.getMetricsByOperation(operation)
      : this.getAllMetrics();

    const completed = metrics.filter(m => m.status !== 'pending');
    if (completed.length === 0) return 0;

    const successful = completed.filter(m => m.status === 'success').length;
    return (successful / completed.length) * 100;
  }

  /**
   * Calculate average response time for an operation
   */
  getAverageResponseTime(operation?: string): number {
    const metrics = operation
      ? this.getMetricsByOperation(operation)
      : this.getAllMetrics();

    const completed = metrics.filter(m => m.duration !== undefined);
    if (completed.length === 0) return 0;

    const total = completed.reduce((sum, m) => sum + (m.duration || 0), 0);
    return Math.round(total / completed.length);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const allMetrics = this.getAllMetrics();
    const completed = allMetrics.filter(m => m.status !== 'pending');
    const successful = completed.filter(m => m.status === 'success');
    const failed = completed.filter(m => m.status === 'error');

    return {
      total: allMetrics.length,
      pending: allMetrics.filter(m => m.status === 'pending').length,
      successful: successful.length,
      failed: failed.length,
      successRate: completed.length > 0 ? (successful.length / completed.length) * 100 : 0,
      avgResponseTime: this.getAverageResponseTime(),
      operations: this.getOperationStats(),
    };
  }

  /**
   * Get statistics by operation type
   */
  private getOperationStats() {
    const operations = new Map<string, { total: number; successful: number; failed: number; avgTime: number }>();

    this.getAllMetrics().forEach(metric => {
      if (!operations.has(metric.operation)) {
        operations.set(metric.operation, { total: 0, successful: 0, failed: 0, avgTime: 0 });
      }

      const stats = operations.get(metric.operation)!;
      stats.total++;
      if (metric.status === 'success') stats.successful++;
      if (metric.status === 'error') stats.failed++;
    });

    // Calculate avg times
    operations.forEach((stats, operation) => {
      stats.avgTime = this.getAverageResponseTime(operation);
    });

    return Array.from(operations.entries()).map(([operation, stats]) => ({
      operation,
      ...stats,
      successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0,
    }));
  }

  /**
   * Remove old metrics to prevent memory leaks
   */
  private pruneOldMetrics(): void {
    if (this.metrics.size > this.MAX_METRICS) {
      const sorted = this.getAllMetrics();
      const toRemove = sorted.slice(this.MAX_METRICS);
      toRemove.forEach(m => this.metrics.delete(m.requestId));
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    devLog('[TRACE] Metrics cleared');
  }
}

// Singleton instance
export const metricsTracker = new MetricsTracker();

/**
 * Helper function to wrap async operations with tracing
 */
export async function traceRequest<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const requestId = metricsTracker.startRequest(operation, metadata);
  
  try {
    const result = await fn();
    metricsTracker.endRequest(requestId, { success: true });
    return result;
  } catch (error) {
    metricsTracker.errorRequest(requestId, error as Error);
    throw error;
  }
}

/**
 * Console logging utilities for development
 */
export const traceLog = {
  request: (operation: string, details?: Record<string, unknown>) => {
    devLog(`[TRACE] 🚀 ${operation}`, details);
  },
  success: (operation: string, duration: number, details?: Record<string, unknown>) => {
    devLog(`[TRACE] ✅ ${operation} (${duration}ms)`, details);
  },
  error: (operation: string, error: Error | string, details?: Record<string, unknown>) => {
    devWarn(`[TRACE] ❌ ${operation}`, { error, ...details });
  },
  performance: (operation: string, metrics: { avg: number; min: number; max: number }) => {
    devLog(`[TRACE] ⚡ ${operation} Performance`, metrics);
  },
};
