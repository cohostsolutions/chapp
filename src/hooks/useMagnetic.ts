import { useRef, useState, useCallback } from 'react';

interface MagneticPosition {
  x: number;
  y: number;
}

interface UseMagneticOptions {
  strength?: number;
  radius?: number;
}

export function useMagnetic<T extends HTMLElement = HTMLDivElement>(
  options: UseMagneticOptions = {}
) {
  const { strength = 0.3, radius = 100 } = options;
  const ref = useRef<T>(null);
  const [position, setPosition] = useState<MagneticPosition>({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      if (distance < radius) {
        const factor = (radius - distance) / radius;
        setPosition({
          x: distanceX * strength * factor,
          y: distanceY * strength * factor,
        });
      }
    },
    [strength, radius]
  );

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  const style = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: position.x === 0 && position.y === 0 ? 'transform 0.3s ease-out' : 'none',
  };

  return {
    ref,
    style,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}
