import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MobileNav } from './MobileNav';
import { useScrollHeader } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { NetworkStatusIndicator } from '@/components/shared/NetworkStatusIndicator';

interface NavLink {
  to: string;
  label: string;
  icon?: React.ReactNode;
}
interface StickyHeaderProps {
  links: NavLink[];
  ctaLabel: string;
  onCtaClick: () => void;
  onGetStarted?: () => void;
  showSignIn?: boolean;
}
export function StickyHeader({
  links,
  ctaLabel,
  onCtaClick,
  onGetStarted,
  showSignIn = false
}: StickyHeaderProps) {
  const isScrolled = useScrollHeader(80);
  return <>
      <header className={cn('fixed top-0 left-0 right-0 z-50 transition-all duration-300 ios-safe-top', isScrolled ? 'bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm' : 'bg-transparent')}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-3">
            <img 
              alt="AlCor Nexus Logo" 
              className="w-10 h-10" 
              width={40} 
              height={40} 
              src="/alcor-logo.svg"
              loading="eager"
            />
            <span className="text-xl font-bold text-foreground">AlCor Nexus</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {links.map(link => link.to.startsWith('#') || link.to.includes('#') ? <a key={link.to} href={link.to.replace(/^\//, '')} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  {link.icon}
                  {link.label}
                </a> : <Link key={link.to} to={link.to} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  {link.icon}
                  {link.label}
                </Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <NetworkStatusIndicator />
            {onGetStarted && <Button variant="glow" className="hidden sm:flex" onClick={onGetStarted}>
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>}
            <Button variant="outline" className="hidden sm:flex" onClick={onCtaClick}>
              {ctaLabel}
            </Button>
            <MobileNav links={links} ctaLabel={ctaLabel} onCtaClick={onCtaClick} onGetStarted={onGetStarted} />
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[72px]" />
    </>;
}