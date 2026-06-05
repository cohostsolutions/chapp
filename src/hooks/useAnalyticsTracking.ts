import { supabase } from '@/integrations/supabase/client';

interface TrackEventParams {
  eventType: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  metadata?: Record<string, unknown>;
}

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

export const trackEvent = async ({
  eventType,
  eventCategory,
  eventAction,
  eventLabel,
  eventValue,
  metadata = {}
}: TrackEventParams): Promise<void> => {
  try {
    await supabase.from('analytics_events').insert([{
      event_type: eventType,
      event_category: eventCategory,
      event_action: eventAction,
      event_label: eventLabel,
      event_value: eventValue,
      page_path: window.location.pathname,
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
      metadata: metadata as any
    }]);
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.debug('Analytics tracking failed:', error);
  }
};

// Convenience functions for common events
export const trackButtonClick = (buttonName: string, metadata?: Record<string, unknown>) => {
  return trackEvent({
    eventType: 'interaction',
    eventCategory: 'CTA',
    eventAction: 'Click',
    eventLabel: buttonName,
    metadata
  });
};

export const trackFormSubmission = (formName: string, metadata?: Record<string, unknown>) => {
  return trackEvent({
    eventType: 'conversion',
    eventCategory: 'Form',
    eventAction: 'Submit',
    eventLabel: formName,
    metadata
  });
};

export const trackPageView = (pageName: string) => {
  return trackEvent({
    eventType: 'pageview',
    eventCategory: 'Navigation',
    eventAction: 'View',
    eventLabel: pageName,
    metadata: {
      referrer: document.referrer,
      title: document.title
    }
  });
};
