import { useEffect, useState } from 'react';

export function CursorGlow() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseleave', handleMouseLeave);
    document.body.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible]);

  return (
    <>
      {/* Main glow orb */}
      <div
        className="pointer-events-none fixed z-50 transition-opacity duration-300"
        style={{
          left: position.x,
          top: position.y,
          opacity: isVisible ? 1 : 0,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div 
          className="w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsla(187, 85%, 53%, 0.15) 0%, hsla(187, 85%, 53%, 0.05) 40%, transparent 70%)',
            filter: 'blur(20px)',
            transition: 'left 0.15s ease-out, top 0.15s ease-out',
          }}
        />
      </div>
      
      {/* Inner bright core */}
      <div
        className="pointer-events-none fixed z-50 transition-opacity duration-300"
        style={{
          left: position.x,
          top: position.y,
          opacity: isVisible ? 0.8 : 0,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div 
          className="w-2 h-2 rounded-full bg-primary/60"
          style={{
            boxShadow: '0 0 20px 8px hsla(187, 85%, 53%, 0.3)',
            transition: 'left 0.05s ease-out, top 0.05s ease-out',
          }}
        />
      </div>
    </>
  );
}
