/**
 * Analytics and metrics tracking utilities
 * 
 * This module provides utilities to track user interactions, performance metrics,
 * and business events. Integrates with various analytics providers.
 */

import { devError } from './logger';

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

interface PageViewEvent {
  path: string;
  title?: string;
  referrer?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  metadata?: Record<string, unknown>;
}

class Analytics {
  private enabled: boolean;
  private debug: boolean;

  constructor() {
    this.enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';
    this.debug = import.meta.env.DEV;
  }

  /**
   * Track a custom event
   */
  trackEvent(event: AnalyticsEvent) {
    if (this.debug) {
      console.log('[ANALYTICS] Event:', event);
    }

    if (!this.enabled) return;

    // Send to analytics provider (e.g., Google Analytics, Mixpanel)
    try {
      // Example: Google Analytics 4
      if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', event.action, {
          event_category: event.category,
          event_label: event.label,
          value: event.value,
          ...event.metadata,
        });
      }

      // Example: Custom API endpoint
      this.sendToAPI('event', event);
    } catch (error) {
      devError('Failed to track event:', error);
    }
  }

  /**
   * Track a page view
   */
  trackPageView(event: PageViewEvent) {
    if (this.debug) {
      console.log('[ANALYTICS] Page View:', event);
    }

    if (!this.enabled) return;

    try {
      if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'page_view', {
          page_path: event.path,
          page_title: event.title,
          page_referrer: event.referrer,
        });
      }

      this.sendToAPI('pageview', event);
    } catch (error) {
      devError('Failed to track page view:', error);
    }
  }

  /**
   * Track a performance metric
   */
  trackPerformance(metric: PerformanceMetric) {
    if (this.debug) {
      console.log('[ANALYTICS] Performance:', metric);
    }

    if (!this.enabled) return;

    try {
      this.sendToAPI('performance', metric);
    } catch (error) {
      devError('Failed to track performance:', error);
    }
  }

  /**
   * Track user properties
   */
  identifyUser(userId: string, properties?: Record<string, unknown>) {
    if (this.debug) {
      console.log('[ANALYTICS] Identify:', { userId, properties });
    }

    if (!this.enabled) return;

    try {
      if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('set', 'user_properties', {
          user_id: userId,
          ...properties,
        });
      }

      this.sendToAPI('identify', { userId, properties });
    } catch (error) {
      devError('Failed to identify user:', error);
    }
  }

  /**
   * Track business metrics
   */
  trackBusinessMetric(metric: {
    name: string;
    value: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (this.debug) {
      console.log('[ANALYTICS] Business Metric:', metric);
    }

    if (!this.enabled) return;

    this.trackEvent({
      category: 'Business',
      action: metric.name,
      value: metric.value,
      metadata: {
        currency: metric.currency,
        ...metric.metadata,
      },
    });
  }

  /**
   * Send data to custom analytics API
   */
  private async sendToAPI(type: string, data: unknown) {
    try {
      const endpoint = import.meta.env.VITE_ANALYTICS_API_URL;
      if (!endpoint) return;

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      // Fail silently to not disrupt user experience
      if (this.debug) {
        devError('Failed to send to analytics API:', error);
      }
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

/**
 * Common event trackers
 */
export const trackUserAction = {
  // Lead actions
  leadCreated: (source: string) => {
    analytics.trackEvent({
      category: 'Lead',
      action: 'Created',
      label: source,
    });
  },

  leadUpdated: (field: string) => {
    analytics.trackEvent({
      category: 'Lead',
      action: 'Updated',
      label: field,
    });
  },

  leadStatusChanged: (from: string, to: string) => {
    analytics.trackEvent({
      category: 'Lead',
      action: 'Status Changed',
      label: `${from} → ${to}`,
    });
  },

  // Order actions
  orderCreated: (amount: number) => {
    analytics.trackBusinessMetric({
      name: 'Order Created',
      value: amount,
      currency: 'USD',
    });
  },

  orderCompleted: (amount: number) => {
    analytics.trackBusinessMetric({
      name: 'Order Completed',
      value: amount,
      currency: 'USD',
    });
  },

  // Conversation actions
  messagesSent: (count: number) => {
    analytics.trackEvent({
      category: 'Conversation',
      action: 'Messages Sent',
      value: count,
    });
  },

  aiResponseTime: (duration: number) => {
    analytics.trackPerformance({
      name: 'AI Response Time',
      value: duration,
      unit: 'ms',
    });
  },

  // Navigation
  pageViewed: (path: string, title?: string) => {
    analytics.trackPageView({ path, title });
  },

  // Feature usage
  featureUsed: (featureName: string, metadata?: Record<string, unknown>) => {
    analytics.trackEvent({
      category: 'Feature',
      action: 'Used',
      label: featureName,
      metadata,
    });
  },

  // Errors
  errorOccurred: (errorType: string, message: string) => {
    analytics.trackEvent({
      category: 'Error',
      action: errorType,
      label: message,
    });
  },
};

/**
 * Performance tracking utilities
 */
export const trackPerformance = {
  // Track page load time
  pageLoad: () => {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (perfData) {
        analytics.trackPerformance({
          name: 'Page Load Time',
          value: perfData.loadEventEnd - perfData.fetchStart,
          unit: 'ms',
        });
      }
    });
  },

  // Track API call duration
  apiCall: (endpoint: string, duration: number, status: number) => {
    analytics.trackPerformance({
      name: 'API Call Duration',
      value: duration,
      unit: 'ms',
      metadata: {
        endpoint,
        status,
      },
    });
  },

  // Track component render time
  componentRender: (componentName: string, duration: number) => {
    analytics.trackPerformance({
      name: 'Component Render Time',
      value: duration,
      unit: 'ms',
      metadata: {
        component: componentName,
      },
    });
  },
};
