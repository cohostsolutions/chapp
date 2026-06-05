import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
}: UseLongPressOptions) {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Only handle touch events for long press (not mouse)
      if (!('touches' in e)) return;
      
      isLongPressRef.current = false;
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        setIsLongPressing(true);
        onLongPress();
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      setIsLongPressing(false);
      
      // If it wasn't a long press and we should trigger click
      if (shouldTriggerClick && !isLongPressRef.current && onClick && 'touches' in e) {
        // Don't trigger click here - let the normal click handler work
      }
    },
    [onClick]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsLongPressing(false);
    isLongPressRef.current = false;
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: cancel,
    isLongPressing,
    wasLongPress: () => isLongPressRef.current,
  };
}
