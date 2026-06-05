import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavLink {
  to: string;
  label: string;
  icon?: React.ReactNode;
}

interface MobileNavProps {
  links: NavLink[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  onGetStarted?: () => void;
}

export function MobileNav({ links, ctaLabel = 'Sign In', onCtaClick, onGetStarted }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)} />
      )}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-background shadow-xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ height: '100dvh' }}
      >
        <div className="flex flex-col h-full ios-safe-top ios-safe-bottom overflow-y-auto overscroll-contain">
          {/* Mobile Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <Link to="/" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
              <img src="/alcor-logo.svg" alt="AlCor Nexus Logo" className="w-10 h-10" width={40} height={40} loading="lazy" />
              <span className="text-xl font-bold text-foreground">AlCor Nexus</span>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-6 py-8">
            <ul className="space-y-4">
              {links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 text-lg font-medium text-foreground hover:text-primary transition-colors py-3 border-b border-border/50"
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* CTA Buttons */}
          <div className="px-6 py-6 border-t border-border space-y-3">
            {onGetStarted && (
              <Button
                variant="glow"
                className="w-full"
                onClick={() => {
                  setIsOpen(false);
                  onGetStarted();
                }}
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                onCtaClick?.();
              }}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
