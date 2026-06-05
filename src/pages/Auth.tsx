import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const auth = useAuth();
  const { signIn, user, loading: authLoading } = auth;
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  const startRedirectSequence = () => {
    if (redirecting || redirectTimerRef.current) return;
    setRedirecting(true);
    setProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setProgress(p => Math.min(100, p + 12));
    }, 80);
    redirectTimerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress(100);
      setTimeout(() => {
        setRedirecting(false);
        navigate('/dashboard', { replace: true });
      }, 120);
    }, 800);
  };

  useEffect(() => {
    if (!authLoading && user) {
      startRedirectSequence();
    }
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setRedirecting(false);
      setProgress(0);
    };
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn(email, password);
      
      if (result.error) {
        let description = result.error.message || String(result.error);
        const lockoutStatus = 'lockoutStatus' in result ? result.lockoutStatus : undefined;
        if (lockoutStatus && !lockoutStatus.is_locked && lockoutStatus.remaining_attempts > 0) {
          description += ` (${lockoutStatus.remaining_attempts} attempts remaining)`;
        }
        toast({
          title: lockoutStatus?.is_locked ? 'Account Locked' : 'Login failed',
          description,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      startRedirectSequence();
    } catch (err) {
      setLoading(false);
    }
  };

  // Map password reset errors to user-friendly messages
  const mapPasswordResetError = (err: any): string => {
    const message = err?.message || err?.error_description || String(err || '');
    const status = err?.status || (err as any)?.code;
    const msg = message.toLowerCase();

    if (status === 429 || msg.includes('rate') || msg.includes('too many') || msg.includes('wait')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('invalid') || msg.includes('email')) {
      return 'Invalid email address. Please check and try again.';
    }

    return message || 'Unable to send reset email. Please try again later.';
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address to receive password reset instructions.',
        variant: 'destructive'
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;

      toast({
        title: 'Reset email sent',
        description: 'Check your inbox (and spam folder) for password reset instructions.'
      });
    } catch (err: any) {
      const errMsg = mapPasswordResetError(err);
      console.log('TEST_DEBUG: Firing destructive toast:', errMsg);
      toast({
        title: 'Unable to send reset',
        description: errMsg,
        variant: 'destructive'
      });
    } finally {
      setResetLoading(false);
    }
  };

  return <>
      <Helmet>
        <title>Sign In | AlCor Nexus</title>
        <meta name="description" content="Sign in to AlCor Nexus to manage AI agents, conversations, bookings, and customer engagement workflows." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://alcornexus.com/auth" />
      </Helmet>
      <SkipToContent targetId="main-content" />
      <div className="min-h-screen flex bg-background" aria-busy={loading || resetLoading || redirecting}>
      {/* Left side - Branding */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden" aria-label="AlCor Nexus product overview">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-12">
          <div className="flex items-center gap-3 mb-8">
            <img alt="AlCor Nexus Logo" className="w-12 h-12" width={48} height={48} src="/alcor-logo.svg" />
            <h1 className="text-3xl font-bold text-foreground">AlCor Nexus</h1>
          </div>
          <h2 className="text-4xl font-bold mb-4 text-foreground">
            Your AI-Powered<br />
            <span className="gradient-text">Customer Engagement Workspace</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-md">
            Manage AI agents, customer conversations, bookings, and follow-up workflows from one workspace.
          </p>
        </div>
      </aside>

      {/* Right side - Form */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-6 py-12" role="main" aria-label="Sign in form">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <img alt="AlCor Nexus Logo" className="w-10 h-10" width={40} height={40} src="/alcor-logo.svg" />
              <h1 className="text-2xl font-bold text-foreground">AlCor Nexus</h1>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-2 text-muted-foreground">
              Enter your credentials to access your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading || resetLoading || redirecting} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading || resetLoading || redirecting}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  disabled={loading || resetLoading || redirecting}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} disabled={resetLoading || loading || redirecting} className="text-sm text-primary hover:underline inline-flex items-center gap-2">
                {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Forgot password?</span>
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading || resetLoading || redirecting}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sign In
            </Button>
          </form>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Contact your administrator if you need access
            </p>
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      {/* Redirecting overlay */}
      {redirecting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
           <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-lg">
             <div className="flex items-center gap-4">
               <div className="flex-1">
                 <div className="text-sm text-muted-foreground mb-2">Redirecting to dashboard</div>
                 <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div className="h-2 bg-primary transition-all" style={{
                width: `${progress}%`,
                transition: 'width 120ms linear'
              }} />
                 </div>
               </div>
               <div className="w-12 text-right">
                 <div className="text-sm font-medium">{progress}%</div>
               </div>
             </div>
           </div>
         </div>}
      </div>
    </>;
}