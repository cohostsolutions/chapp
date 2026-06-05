import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface QueryMetrics {
  queryKey: string;
  duration: number;
  timestamp: number;
  status: 'success' | 'error' | 'pending';
}

interface RenderMetrics {
  componentName: string;
  renderTime: number;
  timestamp: number;
}

interface PerformanceAlert {
  id: string;
  type: 'slow_query' | 'error' | 'high_frequency';
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  queryKey?: string;
  duration?: number;
}

interface PerformanceData {
  queryMetrics: QueryMetrics[];
  renderMetrics: RenderMetrics[];
  averageQueryTime: number;
  averageRenderTime: number;
  slowQueries: QueryMetrics[];
  slowRenders: RenderMetrics[];
  alerts: PerformanceAlert[];
  queryFrequency: Map<string, number>;
}

const SLOW_QUERY_THRESHOLD = 500; // ms
const CRITICAL_QUERY_THRESHOLD = 2000; // ms
const SLOW_RENDER_THRESHOLD = 16; // ms (60fps = 16.67ms per frame)
const MAX_METRICS_HISTORY = 50;
const HIGH_FREQUENCY_THRESHOLD = 10; // queries per minute

export function usePerformanceMonitor() {
  const [data, setData] = useState<PerformanceData>({
    queryMetrics: [],
    renderMetrics: [],
    averageQueryTime: 0,
    averageRenderTime: 0,
    slowQueries: [],
    slowRenders: [],
    alerts: [],
    queryFrequency: new Map(),
  });

  const queryClient = useQueryClient();
  const queryStartTimes = useRef<Map<string, number>>(new Map());
  const alertsShown = useRef<Set<string>>(new Set());

  // Track query performance
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    
    const unsubscribe = cache.subscribe((event) => {
      if (!event?.query?.queryKey) return;
      
      const queryKey = JSON.stringify(event.query.queryKey);
      
      if (event.type === 'updated') {
        const state = event.query.state;
        
        if (state.fetchStatus === 'fetching') {
          queryStartTimes.current.set(queryKey, performance.now());
        } else if (state.fetchStatus === 'idle' && queryStartTimes.current.has(queryKey)) {
          const startTime = queryStartTimes.current.get(queryKey)!;
          const duration = performance.now() - startTime;
          queryStartTimes.current.delete(queryKey);
          
          const metric: QueryMetrics = {
            queryKey: queryKey.slice(0, 50),
            duration: Math.round(duration),
            timestamp: Date.now(),
            status: state.status as 'success' | 'error' | 'pending',
          };
          
          setData(prev => {
            const newMetrics = [metric, ...prev.queryMetrics].slice(0, MAX_METRICS_HISTORY);
            const avgTime = newMetrics.reduce((sum, m) => sum + m.duration, 0) / newMetrics.length;
            const slowQueries = newMetrics.filter(m => m.duration > SLOW_QUERY_THRESHOLD);
            
            // Track query frequency
            const newFrequency = new Map(prev.queryFrequency);
            const currentCount = newFrequency.get(metric.queryKey) || 0;
            newFrequency.set(metric.queryKey, currentCount + 1);
            
            // Generate alerts
            const newAlerts = [...prev.alerts];
            const alertId = `${metric.queryKey}-${Math.floor(metric.timestamp / 60000)}`;
            
            // Critical slow query alert
            if (duration > CRITICAL_QUERY_THRESHOLD && !alertsShown.current.has(alertId)) {
              alertsShown.current.add(alertId);
              const alert: PerformanceAlert = {
                id: alertId,
                type: 'slow_query',
                message: `Critical: Query took ${Math.round(duration)}ms`,
                timestamp: Date.now(),
                severity: 'critical',
                queryKey: metric.queryKey,
                duration: Math.round(duration),
              };
              newAlerts.unshift(alert);
              toast.error(`Slow Query Detected: ${metric.queryKey.slice(0, 30)}... (${Math.round(duration)}ms)`);
            } else if (duration > SLOW_QUERY_THRESHOLD && !alertsShown.current.has(alertId)) {
              alertsShown.current.add(alertId);
              const alert: PerformanceAlert = {
                id: alertId,
                type: 'slow_query',
                message: `Warning: Query took ${Math.round(duration)}ms`,
                timestamp: Date.now(),
                severity: 'warning',
                queryKey: metric.queryKey,
                duration: Math.round(duration),
              };
              newAlerts.unshift(alert);
            }
            
            // High frequency alert
            if (currentCount + 1 >= HIGH_FREQUENCY_THRESHOLD) {
              const freqAlertId = `freq-${metric.queryKey}`;
              if (!alertsShown.current.has(freqAlertId)) {
                alertsShown.current.add(freqAlertId);
                newAlerts.unshift({
                  id: freqAlertId,
                  type: 'high_frequency',
                  message: `Query called ${currentCount + 1} times in short period`,
                  timestamp: Date.now(),
                  severity: 'warning',
                  queryKey: metric.queryKey,
                });
              }
            }
            
            // Error alert
            if (state.status === 'error') {
              const errorAlertId = `error-${metric.queryKey}-${metric.timestamp}`;
              newAlerts.unshift({
                id: errorAlertId,
                type: 'error',
                message: `Query failed: ${metric.queryKey}`,
                timestamp: Date.now(),
                severity: 'critical',
                queryKey: metric.queryKey,
              });
            }
            
            return {
              ...prev,
              queryMetrics: newMetrics,
              averageQueryTime: Math.round(avgTime),
              slowQueries,
              alerts: newAlerts.slice(0, 50),
              queryFrequency: newFrequency,
            };
          });
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  // Function to track component render time
  const trackRender = useCallback((componentName: string, renderTime: number) => {
    const metric: RenderMetrics = {
      componentName,
      renderTime: Math.round(renderTime * 100) / 100,
      timestamp: Date.now(),
    };

    setData(prev => {
      const newMetrics = [metric, ...prev.renderMetrics].slice(0, MAX_METRICS_HISTORY);
      const avgTime = newMetrics.reduce((sum, m) => sum + m.renderTime, 0) / newMetrics.length;
      const slowRenders = newMetrics.filter(m => m.renderTime > SLOW_RENDER_THRESHOLD);

      return {
        ...prev,
        renderMetrics: newMetrics,
        averageRenderTime: Math.round(avgTime * 100) / 100,
        slowRenders,
      };
    });
  }, []);

  const clearMetrics = useCallback(() => {
    alertsShown.current.clear();
    setData({
      queryMetrics: [],
      renderMetrics: [],
      averageQueryTime: 0,
      averageRenderTime: 0,
      slowQueries: [],
      slowRenders: [],
      alerts: [],
      queryFrequency: new Map(),
    });
  }, []);

  const clearAlerts = useCallback(() => {
    alertsShown.current.clear();
    setData(prev => ({ ...prev, alerts: [] }));
  }, []);

  const exportMetrics = useCallback(() => {
    const csvRows = [
      ['Query Key', 'Duration (ms)', 'Status', 'Timestamp'].join(','),
      ...data.queryMetrics.map(m => 
        [m.queryKey, m.duration, m.status, new Date(m.timestamp).toISOString()].join(',')
      ),
    ];
    return csvRows.join('\n');
  }, [data.queryMetrics]);

  return { data, trackRender, clearMetrics, clearAlerts, exportMetrics };
}

// Hook to measure component render time
export function useRenderTime(componentName: string, trackRender?: (name: string, time: number) => void) {
  const renderStart = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    trackRender?.(componentName, renderTime);
  });

  // Reset on each render
  renderStart.current = performance.now();
}
