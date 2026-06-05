import { useEffect, useState } from 'react';

interface UseCounterAnimationOptions {
  end: number;
  duration?: number;
  isVisible: boolean;
  prefix?: string;
  suffix?: string;
}

export function useCounterAnimation({
  end,
  duration = 2000,
  isVisible,
  prefix = '',
  suffix = '',
}: UseCounterAnimationOptions) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!isVisible || hasAnimated) return;

    setHasAnimated(true);
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (end - startValue) * easeOutQuart);
      
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration, hasAnimated]);

  return `${prefix}${count}${suffix}`;
}
