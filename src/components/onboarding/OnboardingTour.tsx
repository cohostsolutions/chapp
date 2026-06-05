import React, { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Users, 
  MessageSquare, 
  BarChart3,
  Settings,
  Bot,
  CheckCircle2,
  BookOpen,
  Calendar,
  Shield,
  UtensilsCrossed,
  Building2,
  Briefcase,
  ShoppingBag,
  BedDouble,
  FileText,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getAgentOnboardingContent } from '@/lib/agent-onboarding';

type AppRole = 'super_admin' | 'client_admin' | 'agent' | 'viewer';
type AiAgentType = 'cece';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  route?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
  spotlightPadding?: number;
  // Role and agent type restrictions
  roles?: AppRole[];
  agentTypes?: AiAgentType[];
}

// Base steps that apply to all users (matching sidebar nav items available to all)
const BASE_STEPS: TourStep[] = [
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    description: 'Use the sidebar on the left to navigate between different sections. You can collapse it to see more content on smaller screens.',
    target: 'aside[role="navigation"]',
    route: '/dashboard',
    position: 'right',
    icon: <BarChart3 className="w-6 h-6" />,
    spotlightPadding: 0,
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'Your command center. See real-time metrics, recent activity, AI conversation summaries, and performance insights at a glance. Customize widgets to fit your workflow.',
    target: '[data-tour="dashboard-content"]',
    route: '/dashboard',
    position: 'bottom',
    icon: <BarChart3 className="w-6 h-6" />,
    spotlightPadding: 16,
  },
  {
    id: 'ai-conversations',
    title: 'AI Conversations',
    description: 'Monitor all conversations handled by your AI agent 24/7. Review interactions, take over conversations when needed, and collaborate with your team in real-time.',
    target: '[data-tour="ai-conversations-content"]',
    route: '/chats',
    position: 'bottom',
    icon: <MessageSquare className="w-6 h-6" />,
    spotlightPadding: 16,
  },
  {
    id: 'calendar',
    title: 'Calendar & Scheduling',
    description: 'Manage all your appointments, follow-ups, callbacks, and important dates in one place. Sync with Google Calendar for seamless integration.',
    target: '[data-tour="calendar-content"]',
    route: '/calendar',
    position: 'bottom',
    icon: <Calendar className="w-6 h-6" />,
    spotlightPadding: 16,
  },
  {
    id: 'settings',
    title: 'Settings & Configuration',
    description: 'Customize everything about your account and organization. Manage team members, integrations, display preferences, notifications, and security settings.',
    target: '[data-tour="settings-content"]',
    route: '/settings',
    position: 'bottom',
    icon: <Settings className="w-6 h-6" />,
    spotlightPadding: 16,
  },
];

// Role-specific steps
const ADMIN_STEPS: TourStep[] = [
  {
    id: 'knowledge-base',
    title: 'Knowledge Base',
    description: 'Train your AI with custom knowledge. Add FAQs, product info, documents (PDFs, Word docs), and images. Your AI learns from this content to better answer customer questions.',
    target: '[data-tour="knowledge-base-content"]',
    route: '/knowledge-base',
    position: 'bottom',
    icon: <BookOpen className="w-6 h-6" />,
    spotlightPadding: 16,
    roles: ['super_admin', 'client_admin'],
  },
  {
    id: 'reporting',
    title: 'Reports & Analytics',
    description: 'Access detailed reports on leads, conversions, team performance, and customer interactions. Track metrics that matter to your business.',
    target: '[data-tour="reporting-content"]',
    route: '/reporting',
    position: 'bottom',
    icon: <FileText className="w-6 h-6" />,
    spotlightPadding: 16,
    roles: ['super_admin', 'client_admin'],
  },
  {
    id: 'users',
    title: 'Team Management',
    description: 'Manage your team members, assign roles and permissions, monitor activity, and control who has access to what. Keep your team organized and secure.',
    target: '[data-tour="users-content"]',
    route: '/users',
    position: 'bottom',
    icon: <Users className="w-6 h-6" />,
    spotlightPadding: 16,
    roles: ['super_admin', 'client_admin'],
  },
];

const SUPER_ADMIN_STEPS: TourStep[] = [
  {
    id: 'organizations',
    title: 'Organizations',
    description: 'Manage all client organizations, view their settings, and monitor performance across the platform.',
    target: '[data-tour="organizations-content"]',
    route: '/organizations',
    position: 'bottom',
    icon: <Building2 className="w-6 h-6" />,
    spotlightPadding: 16,
    roles: ['super_admin'],
  },
  {
    id: 'security',
    title: 'Security Dashboard',
    description: 'Monitor login attempts, manage IP blocklists, and ensure platform security.',
    target: '[data-tour="security-content"]',
    route: '/security',
    position: 'bottom',
    icon: <Shield className="w-6 h-6" />,
    spotlightPadding: 16,
    roles: ['super_admin'],
  },
];

// AI Agent-specific steps - Cece (Hotels, Airbnbs, Resorts - Hospitality)
const CECE_STEPS: TourStep[] = [
  {
    id: 'accommodation',
    title: 'Accommodation Hub',
    description: 'Manage all your accommodation needs in one place. View bookings, manage rooms, and track availability.',
    target: '[data-tour="accommodation-content"]',
    route: '/accommodation',
    position: 'bottom',
    icon: <BedDouble className="w-6 h-6" />,
    spotlightPadding: 16,
    agentTypes: ['cece'],
  },
];


function getWelcomeStep(agentType: AiAgentType | null, roles: AppRole[]): TourStep {
  const onboardingContent = getAgentOnboardingContent(agentType);

  const roleDesc = roles.includes('super_admin') 
    ? 'As a Super Admin, you have full platform access and can manage multiple organizations.'
    : roles.includes('client_admin')
    ? 'As an Admin, you can configure your AI, manage your team, and access advanced features.'
    : 'You can view conversations and collaborate with your team.';

  return {
    id: 'welcome',
    title: 'Welcome to AlCor Nexus',
    description: `${roleDesc} ${onboardingContent.name} is configured to ${onboardingContent.welcomeFocus}. ${onboardingContent.welcomeAction}`,
    position: 'center',
    icon: <Sparkles className="w-6 h-6" />,
  };
}

function getCompleteStep(agentType: AiAgentType | null): TourStep {
  const onboardingContent = getAgentOnboardingContent(agentType);
  
  return {
    id: 'complete',
    title: "You're All Set! 🚀",
    description: `${onboardingContent.name} is ready. ${onboardingContent.completionNextStep} Reopen this tour anytime from Help & Support if your team needs a refresher.`,
    route: '/dashboard',
    position: 'center',
    icon: <CheckCircle2 className="w-6 h-6 text-green-500" />,
  };
}

function buildTourSteps(roles: AppRole[], agentType: AiAgentType | null): TourStep[] {
  const steps: TourStep[] = [];
  
  // Add welcome step
  steps.push(getWelcomeStep(agentType, roles));
  
  // Add base steps
  steps.push(...BASE_STEPS);
  
  // Add Cece-specific steps
  steps.push(...CECE_STEPS);
  
  // Add admin steps
  if (roles.includes('super_admin') || roles.includes('client_admin')) {
    steps.push(...ADMIN_STEPS);
  }
  
  // Add super admin steps
  if (roles.includes('super_admin')) {
    steps.push(...SUPER_ADMIN_STEPS);
  }
  
  // Add complete step
  steps.push(getCompleteStep(agentType));
  
  return steps;
}

interface OnboardingContextType {
  showTour: boolean;
  startTour: () => void;
  endTour: () => void;
  currentStep: number;
  totalSteps: number;
}

const OnboardingContext = createContext<OnboardingContextType>({
  showTour: false,
  startTour: () => {},
  endTour: () => {},
  currentStep: 0,
  totalSteps: 0,
});

export const useOnboardingTour = () => useContext(OnboardingContext);

const TOUR_COMPLETED_KEY = 'onboarding_tour_completed';
const TOUR_DISABLED_KEY = 'onboarding_tour_disabled';

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, roles, aiAgentType } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Build tour steps based on user role and AI agent type
  const tourSteps = useMemo(() => {
    return buildTourSteps(roles || [], aiAgentType);
  }, [roles, aiAgentType]);

  useEffect(() => {
    if (!user) return;
    
    // Check if user has permanently disabled the tour
    const tourDisabled = localStorage.getItem(`${TOUR_DISABLED_KEY}_${user.id}`);
    if (tourDisabled) return;
    
    // Check if tour was completed (but not disabled)
    const completed = localStorage.getItem(`${TOUR_COMPLETED_KEY}_${user.id}`);
    if (!completed) {
      // Auto-start tour for new users after a short delay
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setShowTour(true);
  }, []);

  const endTour = useCallback((neverShowAgain: boolean = false) => {
    setShowTour(false);
    setCurrentStep(0);
    if (user) {
      localStorage.setItem(`${TOUR_COMPLETED_KEY}_${user.id}`, 'true');
      if (neverShowAgain) {
        localStorage.setItem(`${TOUR_DISABLED_KEY}_${user.id}`, 'true');
      }
    }
  }, [user]);

  return (
    <OnboardingContext.Provider value={{ 
      showTour, 
      startTour, 
      endTour, 
      currentStep,
      totalSteps: tourSteps.length
    }}>
      {children}
      {showTour && (
        <TourOverlay 
          steps={tourSteps} 
          currentStep={currentStep} 
          setCurrentStep={setCurrentStep}
          onComplete={endTour}
          onSkip={endTour}
        />
      )}
    </OnboardingContext.Provider>
  );
}

interface TourOverlayProps {
  steps: TourStep[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
  onComplete: (neverShowAgain: boolean) => void;
  onSkip: (neverShowAgain: boolean) => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function TourOverlay({ steps, currentStep, setCurrentStep, onComplete, onSkip }: TourOverlayProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isCentered = step.position === 'center' || !step.target;
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isNavigating, setIsNavigating] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Navigate to step route if needed
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      setIsNavigating(true);
      navigate(step.route);
    }
  }, [step.route, location.pathname, navigate]);

  // Find and highlight the target element
  useEffect(() => {
    if (!step.target) {
      setSpotlightRect(null);
      return;
    }

    const findTarget = () => {
      const element = document.querySelector(step.target!);
      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = step.spotlightPadding ?? 8;
        setSpotlightRect({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
        setIsNavigating(false);
        return true;
      }
      return false;
    };

    // Try immediately
    if (!findTarget()) {
      // Retry with delays for dynamic content
      const timers = [100, 300, 500, 1000].map(delay => 
        setTimeout(() => {
          if (findTarget()) {
            timers.forEach(clearTimeout);
          }
        }, delay)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [step.target, step.spotlightPadding, currentStep, location.pathname]);

  // Position tooltip relative to spotlight
  useEffect(() => {
    if (!spotlightRect || !tooltipRef.current) {
      // Center if no spotlight
      setTooltipPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      return;
    }

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 20;
    
    let x = 0;
    let y = 0;

    switch (step.position) {
      case 'top':
        x = spotlightRect.left + spotlightRect.width / 2;
        y = spotlightRect.top - tooltipRect.height - padding;
        break;
      case 'bottom':
        x = spotlightRect.left + spotlightRect.width / 2;
        y = spotlightRect.top + spotlightRect.height + padding;
        break;
      case 'left':
        x = spotlightRect.left - tooltipRect.width - padding;
        y = spotlightRect.top + spotlightRect.height / 2;
        break;
      case 'right':
        x = spotlightRect.left + spotlightRect.width + padding;
        y = spotlightRect.top + spotlightRect.height / 2;
        break;
      default:
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
    }

    // Keep tooltip within viewport
    const maxX = window.innerWidth - tooltipRect.width / 2 - padding;
    const minX = tooltipRect.width / 2 + padding;
    const maxY = window.innerHeight - tooltipRect.height - padding;
    const minY = padding;

    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));

    setTooltipPosition({ x, y });
  }, [spotlightRect, step.position, currentStep]);

  const handleNext = () => {
    if (isLast) {
      onComplete(neverShowAgain);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-none"
      >
        {/* SVG Overlay with spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full pointer-events-auto">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightRect && !isCentered && (
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  x={spotlightRect.left}
                  y={spotlightRect.top}
                  width={spotlightRect.width}
                  height={spotlightRect.height}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#spotlight-mask)"
            onClick={onSkip}
          />
        </svg>

        {/* Spotlight border glow */}
        {spotlightRect && !isCentered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute rounded-xl border-2 border-primary shadow-[0_0_30px_rgba(var(--primary),0.5)] pointer-events-none"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
            }}
          />
        )}

        {/* Tour Card */}
        <motion.div
          ref={tooltipRef}
          key={step.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            x: isCentered ? '-50%' : '-50%',
            translateY: isCentered ? '-50%' : 0,
          }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="absolute z-10 pointer-events-auto"
          style={{
            left: isCentered ? '50%' : tooltipPosition.x,
            top: isCentered ? '50%' : tooltipPosition.y,
          }}
        >
          <Card className="w-[90vw] max-w-md border-border/60 shadow-elevated bg-popover text-popover-foreground">
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{step.title}</h3>
                    <p className="text-sm text-foreground/70">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onSkip}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <p className="text-foreground/80 mb-6 leading-relaxed">{step.description}</p>

              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      i === currentStep
                        ? "bg-primary w-6"
                        : i < currentStep
                          ? "bg-primary/60"
                          : "bg-muted-foreground/30"
                    )}
                    onClick={() => setCurrentStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* "Never show again" checkbox - only on last step */}
              {isLast && (
                <label className="flex items-center gap-3 px-2 py-3 mb-4 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={neverShowAgain}
                    onChange={(e) => setNeverShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-sm text-foreground/80">Don't show this tour on next login</span>
                </label>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={isFirst}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  {!isLast && (
                    <Button variant="ghost" onClick={() => onSkip(false)} className="text-foreground/70">
                      Skip tour
                    </Button>
                  )}
                  <Button onClick={handleNext} className="gap-2 min-w-[100px]">
                    {isLast ? 'Get Started' : 'Next'}
                    {!isLast && <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Feature Tooltip - contextual hints for specific features
 */
interface FeatureTooltipProps {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function FeatureTooltip({ id, title, description, children }: FeatureTooltipProps) {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `tooltip_${id}_dismissed`;
    if (localStorage.getItem(key)) {
      setDismissed(true);
    }
  }, [id]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`tooltip_${id}_dismissed`, 'true');
    setVisible(false);
  };

  if (dismissed) return <>{children}</>;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50"
          >
            <Card className="w-64 shadow-elevated border-border/60 bg-popover text-popover-foreground">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm text-foreground">{title}</p>
                    <p className="text-xs text-foreground/80 mt-1">{description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleDismiss}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook to reset tour for testing
 */
export function useResetTour() {
  const { user } = useAuth();
  
  return useCallback(() => {
    if (user) {
      localStorage.removeItem(`${TOUR_COMPLETED_KEY}_${user.id}`);
    }
  }, [user]);
}
