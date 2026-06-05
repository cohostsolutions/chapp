import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  MessageSquare, 
  Phone, 
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bot,
  Share2,
  BookOpen,
  Menu,
  X,
  UserCog,
  Lock,
  ShoppingBag,
  UtensilsCrossed,
  MessageCircle,
  BedDouble,
  CalendarCheck,
  Briefcase,
  Shield,
  Palette,
  BarChart,
  ArrowLeftRight,
  MessagesSquare,
  FileText,
  Ticket,
  Wallet
} from 'lucide-react';
import { GraduationCap } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { useTheme } from '@/hooks/themeContext';
import { useSidebarContext } from '@/hooks/sidebarContext';

type AppRole = 'super_admin' | 'client_admin' | 'agent' | 'viewer';
type AiAgentType = 'cece';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  roles: AppRole[];
  hideForSuperAdmin?: boolean; // Hide this item from super admins
}

const navItems: NavItem[] = [
  // Dashboard for all
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['super_admin', 'client_admin', 'agent'] },
  // Accommodation - Cece-specific
  { icon: BedDouble, label: 'Accommodation', path: '/accommodation', roles: ['client_admin', 'agent'], hideForSuperAdmin: true },
  { icon: Wallet, label: 'Operations', path: '/operations', roles: ['client_admin', 'agent'], hideForSuperAdmin: true },
  // Communications (all org types) - team chat and support tickets
  { icon: MessageSquare, label: 'Chats', path: '/chats', roles: ['client_admin', 'agent'], hideForSuperAdmin: true },
  { icon: MessagesSquare, label: 'Team Chat', path: '/team-chat', roles: ['client_admin', 'agent'], hideForSuperAdmin: true },
  // Super Admin only
  { icon: Building2, label: 'Organizations', path: '/organizations', roles: ['super_admin'] },
  // Client Admin & Agent only (hidden from super admin)
  { icon: BookOpen, label: 'Knowledge Base', path: '/knowledge-base', roles: ['client_admin'], hideForSuperAdmin: true },
  { icon: ArrowLeftRight, label: 'Asset Migration', path: '/asset-migration', roles: ['super_admin'] },
  { icon: Ticket, label: 'Support Tickets', path: '/support-tickets', roles: ['super_admin'] },
  { icon: Shield, label: 'Security', path: '/security', roles: ['super_admin'] },
  { icon: BarChart, label: 'Reporting', path: '/reporting', roles: ['client_admin'], hideForSuperAdmin: true },
  { icon: GraduationCap, label: 'AI Training', path: '/ai-training', roles: ['client_admin', 'agent'], hideForSuperAdmin: true },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['super_admin', 'client_admin', 'agent'] },
];

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarContext();
  const { signOut, profile, aiAgentType, effectiveRoles, effectiveIsSuperAdmin, impersonatedRole, isSuperAdmin } = useAuth();
  const isMobile = useIsMobile();
  const { setTheme } = useTheme();

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile, setMobileOpen]);

  // Determine if user is truly a super admin without impersonation
  const isActualSuperAdminNotImpersonating = isSuperAdmin && !impersonatedRole;

  // Check if user has access to a nav item (using effective roles for impersonation support)
  const hasAccess = (item: NavItem) => {
    // Super admin not impersonating has access to all items except hideForSuperAdmin items
    if (isActualSuperAdminNotImpersonating) {
      return !item.hideForSuperAdmin;
    }
    
    // Check role access using effective roles
    const hasRoleAccess = item.roles.some(role => effectiveRoles.includes(role));
    if (!hasRoleAccess) return false;
    
    return true;
  };

  // Filter nav items based on access - only show items the user can access
  const visibleNavItems = navItems.filter(item => hasAccess(item));

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (!hasAccess(item)) {
      e.preventDefault();
      return;
    }
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Mobile hamburger button
  const MobileMenuButton = () => (
    <Button
      variant="ghost"
      size="icon"
      className="fixed top-4 left-4 z-50 lg:hidden bg-background/80 backdrop-blur-sm border border-border shadow-lg"
      onClick={() => setMobileOpen(!mobileOpen)}
    >
      {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </Button>
  );

  // Mobile overlay
  const MobileOverlay = () => (
    <div 
      className={cn(
        "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden transition-opacity",
        mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={() => setMobileOpen(false)}
    />
  );

  // Render nav item with access check
  const renderNavItem = (item: NavItem) => {
    const canAccess = hasAccess(item);
    
    const navContent = (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          !canAccess && "opacity-40 cursor-not-allowed"
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {(!collapsed || isMobile) && (
          <span className="text-sm font-medium flex-1">{item.label}</span>
        )}
        {!canAccess && (!collapsed || isMobile) && (
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>
    );

    if (!canAccess) {
      return (
        <Tooltip key={item.path} delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="text-sidebar-foreground">
              {navContent}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[200px]">
            <p className="text-xs">
              You don't have permission to access this page. Contact your administrator for access.
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={(e) => handleNavClick(e, item)}
        className={({ isActive }) => cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          isActive 
            ? "bg-sidebar-accent text-sidebar-primary shadow-glow" 
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {(!collapsed || isMobile) && <span className="text-sm font-medium">{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <>
      <MobileMenuButton />
      <MobileOverlay />
      
      <aside 
        className={cn(
          "fixed left-0 top-0 z-[60] h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
          "lg:translate-x-0 lg:z-40",
          collapsed ? "lg:w-16" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
            {(!collapsed || isMobile) && (
              <div className="flex items-center gap-2">
                <img src="/alcor-nexus-logo.svg" alt="" className="w-8 h-8" aria-hidden="true" />
                <span className="font-semibold text-foreground">AlCor CRM</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className={cn("ml-auto hidden lg:flex", collapsed && "mx-auto")}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>

          {/* Navigation - Scrollable */}
          <nav 
            className="flex-1 overflow-y-auto p-3 space-y-1 overscroll-contain"
            aria-label="Sidebar navigation"
          >
            {visibleNavItems.map(renderNavItem)}
          </nav>

          {/* User section - Fixed at bottom on mobile */}
          <div className="shrink-0 border-t border-sidebar-border">
            {/* Desktop: Dropdown menu */}
            <div className="hidden lg:block p-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-6">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="User" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {!collapsed && (
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || profile?.email}</p>
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {impersonatedRole 
                            ? `Viewing as ${impersonatedRole.replace('_', ' ')}` 
                            : effectiveRoles[0]?.replace('_', ' ')}
                        </p>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mb-2" align="start">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="w-4 h-4 mr-2" />
                      <span>Theme</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile/Tablet: Direct user info + visible sign out */}
            <div className="lg:hidden p-3 space-y-3">
              {/* User Info */}
              <div className="flex items-center gap-3 px-3 py-2">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="User" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || profile?.email}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {impersonatedRole 
                      ? `Viewing as ${impersonatedRole.replace('_', ' ')}` 
                      : effectiveRoles[0]?.replace('_', ' ')}
                  </p>
                </div>
              </div>

              {/* Theme Toggle - Mobile */}
              <div className="flex items-center gap-2 px-3">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Theme:</span>
                <div className="flex gap-1 ml-auto">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setTheme('light')}
                    className="px-2 text-xs"
                  >
                    Light
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setTheme('dark')}
                    className="px-2 text-xs"
                  >
                    Dark
                  </Button>
                </div>
              </div>

              {/* Sign Out Button - Always visible on mobile */}
              <Button 
                variant="destructive" 
                onClick={signOut}
                className="w-full gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}