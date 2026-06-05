import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function TextReveal({ 
  children, 
  className = '',
  delay = 0,
  direction = 'up',
}: TextRevealProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({ threshold: 0.2 });

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)';
    switch (direction) {
      case 'up': return 'translateY(100%)';
      case 'down': return 'translateY(-100%)';
      case 'left': return 'translateX(100%)';
      case 'right': return 'translateX(-100%)';
      default: return 'translateY(100%)';
    }
  };

  return (
    <div ref={ref} className={cn('overflow-hidden', className)}>
      <div
        className="transition-all duration-700 ease-out"
        style={{
          transform: getTransform(),
          opacity: isVisible ? 1 : 0,
          transitionDelay: `${delay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface TextRevealByWordProps {
  text: string;
  className?: string;
  wordClassName?: string;
  staggerDelay?: number;
}

export function TextRevealByWord({ 
  text, 
  className = '',
  wordClassName = '',
  staggerDelay = 50,
}: TextRevealByWordProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({ threshold: 0.3 });
  const words = text.split(' ');

  return (
    <div ref={ref} className={cn('flex flex-wrap', className)}>
      {words.map((word, index) => (
        <span key={index} className="overflow-hidden mr-[0.25em]">
          <span
            className={cn(
              'inline-block transition-all duration-500 ease-out',
              wordClassName
            )}
            style={{
              transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
              opacity: isVisible ? 1 : 0,
              transitionDelay: isVisible ? `${index * staggerDelay}ms` : '0ms',
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </div>
  );
}

interface TextRevealByCharProps {
  text: string;
  className?: string;
  charClassName?: string;
  staggerDelay?: number;
}

export function TextRevealByChar({ 
  text, 
  className = '',
  charClassName = '',
  staggerDelay = 20,
}: TextRevealByCharProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({ threshold: 0.3 });
  const chars = text.split('');

  return (
    <div ref={ref} className={className}>
      {chars.map((char, index) => (
        <span key={index} className="inline-block overflow-hidden">
          <span
            className={cn(
              'inline-block transition-all duration-300 ease-out',
              charClassName
            )}
            style={{
              transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
              opacity: isVisible ? 1 : 0,
              transitionDelay: isVisible ? `${index * staggerDelay}ms` : '0ms',
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        </span>
      ))}
    </div>
  );
}
