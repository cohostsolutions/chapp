import { useEffect, useState, useRef, useCallback } from 'react';

export function useParallax(speed: number = 0.5) {
  const [offset, setOffset] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastScrollY = useRef(0);

  const handleScroll = useCallback(() => {
    // Cancel any pending RAF to prevent stacking
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      // Only update if scroll position actually changed
      if (scrollY !== lastScrollY.current) {
        lastScrollY.current = scrollY;
        setOffset(scrollY * speed);
      }
      rafRef.current = null;
    });
  }, [speed]);

  useEffect(() => {
    // Set initial offset without causing reflow
    lastScrollY.current = window.scrollY;
    setOffset(window.scrollY * speed);

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [speed, handleScroll]);

  return offset;
}
