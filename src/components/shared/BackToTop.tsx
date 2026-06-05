import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollHeader } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

interface BackToTopProps {
  threshold?: number;
}

export function BackToTop({ threshold = 400 }: BackToTopProps) {
  const isVisible = useScrollHeader(threshold);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'fixed bottom-6 right-6 z-40 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-border/50 transition-all duration-300',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
      onClick={scrollToTop}
      aria-label="Back to top"
    >
      <ArrowUp className="w-5 h-5" />
    </Button>
  );
}
