import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { devError } from "@/lib/logger";
import { Helmet } from 'react-helmet';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkipToContent } from '@/components/shared/SkipToContent';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    devError("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Page Not Found | AlCor Nexus</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <SkipToContent targetId="main-content" />

      <header className="border-b border-border/60 bg-background/95 backdrop-blur-sm" role="banner" aria-label="Site header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/alcor-logo.svg" alt="AlCor Nexus Logo" className="h-10 w-10" width={40} height={40} />
            <span className="text-xl font-bold text-foreground">AlCor Nexus</span>
          </Link>
          <Button variant="outline" asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-[calc(100vh-73px)] max-w-5xl items-center justify-center px-6 py-16" role="main" aria-label="Page not found">
        <div className="max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Search className="h-8 w-8" />
          </div>
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-primary">404 error</p>
          <h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">This page does not exist</h1>
          <p className="mb-3 text-lg text-muted-foreground">
            The URL <span className="break-all text-foreground">{location.pathname}</span> could not be found.
          </p>
          <p className="mb-8 text-muted-foreground">
            Head back to the main site, review pricing, or sign in if you were trying to reach your workspace.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
