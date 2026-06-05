import { Link } from 'react-router-dom';
import { publicFooterLinks, type PublicFooterLink } from '@/constants/publicSite';

interface FooterProps {
  links?: PublicFooterLink[];
}

export function Footer({ links = publicFooterLinks }: FooterProps) {
  return (
    <footer className="relative z-10 border-t border-border py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/alcor-logo.svg" alt="AlCor Nexus Logo" className="w-7 h-7 sm:w-8 sm:h-8" loading="lazy" width={32} height={32} />
            <span className="font-semibold text-foreground text-sm sm:text-base">AlCor Nexus</span>
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
            {links.map((link) =>
              link.isAnchor || link.to.startsWith('#') ? (
                <a
                  key={link.to}
                  href={link.to}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>
        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-border text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            © {new Date().getFullYear()} AlCor Nexus. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
