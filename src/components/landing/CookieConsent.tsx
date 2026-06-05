import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie, X, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONSENT_KEY = 'alcor_cookie_consent';
const CONSENT_VERSION = '1'; // Increment to re-prompt users after policy changes

interface CookiePreferences {
  essential: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  version: string;
  timestamp: number;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    version: CONSENT_VERSION,
    timestamp: Date.now(),
  });

  useEffect(() => {
    // Check if user has already consented
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookiePreferences;
        // Show banner again if consent version changed
        if (parsed.version !== CONSENT_VERSION) {
          setIsVisible(true);
        }
      } catch {
        setIsVisible(true);
      }
    } else {
      // Small delay before showing for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
    setIsVisible(false);
    
    // Dispatch event for analytics tools to listen to
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: prefs }));
  };

  const handleAcceptAll = () => {
    const newPrefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    };
    setPreferences(newPrefs);
    saveConsent(newPrefs);
  };

  const handleDeclineNonEssential = () => {
    const newPrefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    };
    setPreferences(newPrefs);
    saveConsent(newPrefs);
  };

  const handleSavePreferences = () => {
    const newPrefs: CookiePreferences = {
      ...preferences,
      version: CONSENT_VERSION,
      timestamp: Date.now(),
    };
    saveConsent(newPrefs);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6",
        "animate-in slide-in-from-bottom-5 duration-500"
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Main Banner */}
          <div className="p-4 md:p-6">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary/10 items-center justify-center flex-shrink-0">
                <Cookie className="w-6 h-6 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Cookie Preferences
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      We use cookies to enhance your experience. Essential cookies are required for the site to function. 
                      You can choose to accept or decline non-essential cookies.{' '}
                      <Link to="/privacy" className="text-primary underline hover:no-underline">
                        Read our Privacy Policy
                      </Link>
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Button onClick={handleAcceptAll} size="sm">
                    Accept All
                  </Button>
                  <Button onClick={handleDeclineNonEssential} variant="outline" size="sm">
                    Essential Only
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-muted-foreground"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Customize
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Preferences */}
          {showDetails && (
            <div className="border-t border-border p-4 md:p-6 bg-muted/30">
              <div className="space-y-4">
                {/* Essential Cookies */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-background">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Essential Cookies</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Required
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      These cookies are necessary for the website to function and cannot be disabled. 
                      They include session management and security features.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-6 rounded-full bg-primary flex items-center justify-end px-1">
                      <div className="w-4 h-4 rounded-full bg-white" />
                    </div>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-background">
                  <div className="flex-1">
                    <span className="font-medium text-foreground">Analytics Cookies</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Help us understand how visitors interact with our website by collecting and 
                      reporting information anonymously.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors flex items-center px-1",
                        preferences.analytics 
                          ? "bg-primary justify-end" 
                          : "bg-muted-foreground/30 justify-start"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-background">
                  <div className="flex-1">
                    <span className="font-medium text-foreground">Marketing Cookies</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Used to track visitors across websites to display relevant advertisements 
                      based on your interests.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setPreferences(p => ({ ...p, marketing: !p.marketing }))}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors flex items-center px-1",
                        preferences.marketing 
                          ? "bg-primary justify-end" 
                          : "bg-muted-foreground/30 justify-start"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={handleSavePreferences} size="sm">
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to check cookie consent status
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      try {
        setConsent(JSON.parse(stored));
      } catch {
        setConsent(null);
      }
    }

    const handleUpdate = (e: CustomEvent<CookiePreferences>) => {
      setConsent(e.detail);
    };

    window.addEventListener('cookieConsentUpdated', handleUpdate as EventListener);
    return () => window.removeEventListener('cookieConsentUpdated', handleUpdate as EventListener);
  }, []);

  return {
    hasConsent: consent !== null,
    analytics: consent?.analytics ?? false,
    marketing: consent?.marketing ?? false,
    essential: true,
  };
}
