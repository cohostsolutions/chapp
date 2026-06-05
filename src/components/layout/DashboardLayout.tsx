import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLeadTemperatureAlerts } from '@/components/LeadTemperatureAlerts';
import { RoleBadge } from '@/components/RoleBadge';
import { CommunicationNotifications } from '@/components/CommunicationNotifications';
import { CommunicationNotificationBell } from '@/components/CommunicationNotificationBell';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { HelpButton } from '@/components/shared/HelpButton';
import { NotificationPermissionBanner } from '@/components/shared/NotificationPermissionBanner';
import { TokenExpiryAlert } from '@/components/TokenExpiryAlert';
import { MobileBottomNav } from './MobileBottomNav';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { useSidebarContext } from '@/hooks/sidebarContext';
import { FloatingChatWidget } from '@/components/team-chat/FloatingChatWidget';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { LiveRegion } from '@/components/shared/LiveRegion';

// Page title mapping for mobile header
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sales-operations': 'Sales Operations',
  '/menu-and-orders': 'Menu & Orders',
  '/accommodation': 'Accommodation',
  '/chats': 'Communications',
  '/ai-training': 'Training',
  '/calls': 'Call Center',
  '/calendar': 'Calendar',
  '/team-chat': 'Team Chat',
  '/knowledge-base': 'Knowledge',
  '/reporting': 'Reports',
  '/saved-reports': 'Saved Reports',
  '/settings': 'Settings',
  '/organizations': 'Organizations',
  '/users': 'Users',
  '/social-platforms': 'Platforms',
  '/security': 'Security',
  '/support-tickets': 'Support',
  '/notification-history': 'Notifications',
};

function getPageTitle(pathname: string): string {
  // Check for exact match first
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  // Check for partial match (for nested routes)
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path)) {
      return title;
    }
  }
  return 'AlCor CRM';
}

function DashboardContent() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const { collapsed } = useSidebarContext();
  const location = useLocation();
  
  const pageTitle = getPageTitle(location.pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      {/* Skip to content link for keyboard users */}
      <SkipToContent targetId="main-content" />
      
      {/* Live region for screen reader announcements */}
      <LiveRegion message="" />
      
      <Sidebar />
      <CommunicationNotifications />
      
      {/* Header with alerts */}
      <header 
        className={cn(
          "fixed top-0 right-0 z-30 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 lg:px-6 bg-background/95 backdrop-blur-md border-b border-border transition-all duration-300",
          collapsed ? "lg:left-16" : "lg:left-64",
          "left-0"
        )}
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
        role="banner"
      >
        {/* Mobile: Page title (centered) */}
        <div className="flex-1 flex items-center lg:hidden">
          <div className="w-10" /> {/* Spacer for hamburger */}
          <h1 className="flex-1 text-center text-base font-semibold text-foreground truncate px-2">
            {pageTitle}
          </h1>
        </div>
        
        {/* Desktop: Empty left side */}
        <div className="hidden lg:block" />
        
        {/* Header actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3" role="toolbar" aria-label="Header actions">
          <HelpButton />
          <ThemeToggle />
          <CommunicationNotificationBell />
          <div className="hidden sm:block">
            <RoleBadge />
          </div>
        </div>
      </header>
      
      <main 
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-screen transition-all duration-300",
          collapsed ? "lg:pl-16" : "lg:pl-64",
          "pl-0",
          "focus:outline-none"
        )}
        role="main"
        aria-label="Main content"
      >
        <div 
          className={cn(
            "p-3 sm:p-4 lg:p-6",
            "pt-[4.5rem] sm:pt-20 lg:pt-20",
            "pb-24 xl:pb-6"
          )}
          style={{ paddingBottom: 'max(calc(6rem + env(safe-area-inset-bottom)), 6rem)' }}
        >
          <TokenExpiryAlert />
          <Outlet />
        </div>
      </main>
      
      <NotificationPermissionBanner />
      
      {/* Mobile & Tablet Bottom Navigation - MobileBottomNav handles its own xl:hidden */}
      <MobileBottomNav />
      
      {/* Floating Chat Widget */}
      <FloatingChatWidget />
    </div>
  );
}

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <DashboardContent />
    </SidebarProvider>
  );
}