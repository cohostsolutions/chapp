import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollRestoration() {
  const { pathname } = useLocation();

  // Use useLayoutEffect to scroll before paint, preventing flash of wrong position
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  // Also scroll on mount as a fallback
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
}
