import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useEffect, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChatLogsErrorBoundary } from "@/components/ChatLogsErrorBoundary";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RouteGuard } from "@/components/RouteGuard";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { useBackendErrorNotifier } from "@/hooks/useBackendErrorNotifier";
import { OnboardingProvider } from "@/components/onboarding/OnboardingTour";
import { PWAInstallBanner, PWAUpdateBanner, OfflineIndicator } from "@/components/pwa/PWAPrompts";

// Lazy load public pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const CustomSolutions = lazy(() => import("./pages/CustomSolutions"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FacebookCallback = lazy(() => import("./pages/FacebookCallback"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));
const InstagramCallback = lazy(() => import("./pages/InstagramCallback"));
const WhatsAppCallback = lazy(() => import("./pages/WhatsAppCallback"));

// Lazy load heavy dashboard pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AccommodationHub = lazy(() => import("./pages/AccommodationHub"));
const SalesOperations = lazy(() => import("./pages/SalesOperations"));
const ChatLogs = lazy(() => import("./pages/ChatLogs"));

const Organizations = lazy(() => import("./pages/Organizations"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));

const Calendar = lazy(() => import("./pages/Calendar"));
const Settings = lazy(() => import("./pages/Settings"));

const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const SecurityDashboard = lazy(() => import("./pages/SecurityDashboard"));
const ErrorDashboard = lazy(() => import("./pages/ErrorDashboard"));
const SessionManagement = lazy(() => import("./pages/SessionManagement"));
const Reporting = lazy(() => import("./pages/Reporting"));

const AITraining = lazy(() => import("./pages/AITraining"));
const Workflows = lazy(() => import("./pages/Workflows"));
const NotificationHistory = lazy(() => import("./pages/NotificationHistory"));
const AssetMigration = lazy(() => import("./pages/AssetMigration"));
const TeamChat = lazy(() => import("./pages/TeamChat"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const Operations = lazy(() => import("./pages/Operations"));

// Loading component for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

// Track recent errors to prevent duplicate toasts
const recentErrors = new Map<string, number>();
const ERROR_DUPLICATE_THRESHOLD = 3000; // 3 seconds

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // Increased from 30s to 60s
      retry: (failureCount, error) => {
        // Don't retry if the error is from a Supabase function that doesn't exist
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('FunctionsHttpError')) {
          return false; // Don't retry function errors
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        // Suppress duplicate "v1 error" toasts
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorKey = errorMessage.substring(0, 100); // Use first 100 chars as key
        const now = Date.now();
        const lastSeen = recentErrors.get(errorKey);
        
        if (lastSeen && now - lastSeen < ERROR_DUPLICATE_THRESHOLD) {
          // Suppress duplicate error
          return;
        }
        
        recentErrors.set(errorKey, now);
        
        // Clean up old entries
        for (const [key, time] of recentErrors.entries()) {
          if (now - time > ERROR_DUPLICATE_THRESHOLD * 2) {
            recentErrors.delete(key);
          }
        }
      },
    },
  },
});

// Scroll to top on route change + backend error notifications
function AppEffects() {
  const { pathname } = useLocation();
  
  // Listen for backend errors from service worker
  useBackendErrorNotifier();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

function App() {
  return (
    <ErrorBoundary fullPage>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
              <TooltipProvider>
              <Sonner
                position="bottom-right"
                visibleToasts={1}
                expand={false}
                closeButton
              />
              <PWAInstallBanner />
              <PWAUpdateBanner />
              <OfflineIndicator />
              <BrowserRouter>
                <OnboardingProvider>
                <CommandPalette />
                <AppEffects />
              <Routes>
                <Route path="/facebook-callback" element={<Suspense fallback={<PageLoader />}><FacebookCallback /></Suspense>} />
                <Route path="/google-callback" element={<Suspense fallback={<PageLoader />}><GoogleCallback /></Suspense>} />
                <Route path="/instagram-callback" element={<Suspense fallback={<PageLoader />}><InstagramCallback /></Suspense>} />
                <Route path="/whatsapp-callback" element={<Suspense fallback={<PageLoader />}><WhatsAppCallback /></Suspense>} />
                <Route path="/" element={<Suspense fallback={<PageLoader />}><Index /></Suspense>} />
                <Route path="/ai-agents" element={<Suspense fallback={<PageLoader />}><AIAgents /></Suspense>} />
                <Route path="/custom-solutions" element={<Suspense fallback={<PageLoader />}><CustomSolutions /></Suspense>} />
                <Route path="/pricing" element={<Suspense fallback={<PageLoader />}><Pricing /></Suspense>} />
                <Route path="/terms" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><Privacy /></Suspense>} />
                {/* Redirect old data-usage route to terms page */}
                <Route path="/data-usage" element={<Suspense fallback={<PageLoader />}><Terms /></Suspense>} />
                <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
                <Route element={<DashboardLayout />}>
                  {/* All roles: Dashboard, Leads, AI Conversations, Chat Logs, Call Center, Calendar, Settings */}
                  <Route
                    path="/dashboard"
                    element={
                      <RouteGuard allowedRoles={["super_admin", "client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Dashboard />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/accommodation"
                    element={
                      <RouteGuard allowedRoles={["client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <AccommodationHub />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/sales-operations"
                    element={
                      <RouteGuard allowedRoles={["client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <SalesOperations />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />

                    <Route path="/ai-training" element={
                      <RouteGuard allowedRoles={['client_admin', 'agent']}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <AITraining />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    } />
                    <Route path="/chats" element={
                      <RouteGuard allowedRoles={['client_admin', 'agent']}>
                        <ChatLogsErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <ChatLogs />
                          </Suspense>
                        </ChatLogsErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <RouteGuard allowedRoles={["client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Calendar />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/operations"
                    element={
                      <RouteGuard allowedRoles={["client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Operations />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RouteGuard allowedRoles={["super_admin", "client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Settings />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />

                  {/* Super Admin only: Organizations */}
                  <Route
                    path="/organizations"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Organizations />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/organizations/:id/settings"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <OrganizationSettings />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />

                  {/* Super Admin and Client Admin: User Management, Social Platforms, Knowledge Base, Organization Settings */}
                  <Route
                    path="/organization-settings"
                    element={
                      <RouteGuard allowedRoles={["super_admin", "client_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <OrganizationSettings />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/knowledge-base"
                    element={
                      <RouteGuard allowedRoles={["client_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <KnowledgeBase />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/security"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <SecurityDashboard />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/errors"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <ErrorDashboard />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/reporting"
                    element={
                      <RouteGuard allowedRoles={["client_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Reporting />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/sessions"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <SessionManagement />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/workflows"
                    element={
                      <RouteGuard allowedRoles={["super_admin", "client_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Workflows />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <RouteGuard allowedRoles={["super_admin", "client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <NotificationHistory />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/notification-history"
                    element={
                      <RouteGuard allowedRoles={["super_admin", "client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <NotificationHistory />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/asset-migration"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <AssetMigration />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/team-chat"
                    element={
                      <RouteGuard allowedRoles={["client_admin", "agent"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <TeamChat />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/support-tickets"
                    element={
                      <RouteGuard allowedRoles={["super_admin"]}>
                        <ErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <SupportTickets />
                          </Suspense>
                        </ErrorBoundary>
                      </RouteGuard>
                    }
                  />
                </Route>
                <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
              </Routes>
              </OnboardingProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
}

export default App;
