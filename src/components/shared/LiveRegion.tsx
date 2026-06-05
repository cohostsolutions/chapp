import { useEffect, useState } from 'react';

interface LiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  clearDelay?: number;
}

/**
 * ARIA live region for announcing dynamic content changes to screen readers
 * Use this to announce status changes, loading states, form submissions, etc.
 */
export function LiveRegion({ 
  message, 
  priority = 'polite',
  clearDelay = 5000 
}: LiveRegionProps) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (message) {
      // Clear and re-announce to ensure screen readers pick it up
      setAnnouncement('');
      const timer = setTimeout(() => {
        setAnnouncement(message);
      }, 100);
      
      // Clear the announcement after delay
      const clearTimer = setTimeout(() => {
        setAnnouncement('');
      }, clearDelay);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [message, clearDelay]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Hook for programmatic announcements
 */
export function useAnnounce() {
  const [message, setMessage] = useState('');

  const announce = (text: string) => {
    setMessage('');
    setTimeout(() => setMessage(text), 100);
  };

  return { message, announce };
}