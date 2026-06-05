import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Users, 
  MessageSquare, 
  Settings, 
  Plus,
  X,
  ShoppingBag,
  UtensilsCrossed,
  BedDouble,
  Calendar,
  FileText,
  Phone,
  Briefcase,
  BookOpen,
  GraduationCap,
  MessagesSquare,
  Sparkles,
  Wallet
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  path: string;
  color?: string;
  isPrimary?: boolean;
  description?: string;
}

interface NavBadge {
  count?: number;
  dot?: boolean;
}

export function MobileBottomNav() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [badges, setBadges] = useState<Record<string, NavBadge>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { aiAgentType, profile } = useAuth();

  const aiType = aiAgentType || 'cece';
  const organizationId = profile?.organization_id;

  // Fetch real unread message counts
  useEffect(() => {
    if (!organizationId) {
      setBadges({});
      return;
    }

    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('communications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('direction', 'inbound')
        .eq('status', 'received');

      if (!error && count !== null && count > 0) {
        setBadges({ '/chats': { count } });
      } else {
        setBadges({});
      }
    };

    fetchUnreadCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('mobile-nav-unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Get context-aware primary action based on current page
  const getPrimaryAction = (): QuickAction | null => {
    const path = location.pathname;
    
    if (path.includes('/accommodation')) {
      return { icon: <BedDouble className="w-5 h-5" />, label: 'New Booking', path: '/accommodation?action=new', color: 'bg-primary', isPrimary: true };
    }
    return null;
  };

  // Primary nav items (always visible) - consistent across all organizations
  const primaryNavItems = [
    { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/dashboard' },
    { icon: <BedDouble className="w-5 h-5" />, label: 'Accommodation', path: '/accommodation' },
  ];
  
  // Right side nav items (after FAB)
  const rightNavItems = [
    { icon: <MessageSquare className="w-5 h-5" />, label: 'Chats', path: '/chats' },
    { icon: <MessagesSquare className="w-5 h-5" />, label: 'Team', path: '/team-chat' },
  ];

  // Quick actions organized by category
  const getQuickActions = (): { category: string; actions: QuickAction[] }[] => {
    const primaryAction = getPrimaryAction();
    
    const commonActions: QuickAction[] = [
      { icon: <Phone className="w-5 h-5" />, label: 'Call Center', path: '/calls', color: 'bg-emerald-500', description: 'Voice calls' },
      { icon: <FileText className="w-5 h-5" />, label: 'Reports', path: '/reporting', color: 'bg-amber-500', description: 'Analytics' },
      { icon: <Calendar className="w-5 h-5" />, label: 'Calendar', path: '/calendar', color: 'bg-blue-500', description: 'Schedule' },
      { icon: <GraduationCap className="w-5 h-5" />, label: 'Training', path: '/ai-training', color: 'bg-violet-500', description: 'AI training' },
      { icon: <BookOpen className="w-5 h-5" />, label: 'Knowledge', path: '/knowledge-base', color: 'bg-cyan-500', description: 'KB articles' },
      { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings', color: 'bg-slate-500', description: 'Preferences' },
    ];

    return [
      ...(primaryAction ? [{ category: 'Quick Create', actions: [primaryAction] }] : []),
      { 
        category: 'Hospitality', 
        actions: [
          { icon: <BedDouble className="w-5 h-5" />, label: 'Accommodation', path: '/accommodation', color: 'bg-indigo-500', description: 'Manage all' },
        ]
      },
      { category: 'Tools', actions: commonActions },
    ];
  };

  const quickActionCategories = getQuickActions();

  const handleNavigate = (path: string) => {
    triggerHaptic('light');
    navigate(path);
    setIsExpanded(false);
  };

  const handleFabClick = () => {
    triggerHaptic('medium');
    setIsExpanded(!isExpanded);
  };

  const isActive = (path: string) => {
    // Check for exact match or if current path starts with the nav path
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const getBadge = (path: string): NavBadge | undefined => badges[path];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Quick Actions Sheet - Redesigned with categories */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl border-t border-border xl:hidden max-h-[70vh] overflow-hidden"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Quick Actions</h3>
                <p className="text-xs text-muted-foreground">Navigate or create</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[calc(70vh-6rem)] pb-4 px-4 space-y-4">
              {quickActionCategories.map((category) => (
                <div key={category.category}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
                    {category.category}
                  </p>
                  <div className={cn(
                    "grid gap-2",
                    category.category === 'Quick Create' ? 'grid-cols-1' : 'grid-cols-3'
                  )}>
                    {category.actions.map((action) => (
                      <button
                        key={action.path + action.label}
                        onClick={() => handleNavigate(action.path)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl transition-all active:scale-95",
                          action.isPrimary 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                            : "bg-muted/50 hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          action.isPrimary ? "bg-primary-foreground/20" : action.color,
                          !action.isPrimary && "text-white"
                        )}>
                          {action.icon}
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            action.isPrimary ? "text-primary-foreground" : "text-foreground"
                          )}>
                            {action.label}
                          </p>
                          {action.description && (
                            <p className={cn(
                              "text-[10px] truncate",
                              action.isPrimary ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {action.description}
                            </p>
                          )}
                        </div>
                        {action.isPrimary && (
                          <Sparkles className="w-4 h-4 text-primary-foreground/70 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border xl:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
        aria-label="Mobile navigation"
        role="navigation"
      >
        <div className="flex items-center justify-around h-16 px-1 max-w-md mx-auto">
          {/* Left side: Home, Leads/Orders/Bookings */}
          {primaryNavItems.map((item) => {
            const badge = getBadge(item.path);
            return (
              <motion.button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative py-2",
                  isActive(item.path) 
                    ? "text-primary" 
                    : "text-muted-foreground active:text-foreground"
                )}
                aria-label={item.label}
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                {isActive(item.path) && (
                  <motion.div 
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative" aria-hidden="true">
                  {item.icon}
                  {badge?.count && badge.count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {badge.count > 9 ? '9+' : badge.count}
                    </span>
                  )}
                  {badge?.dot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </motion.button>
            );
          })}
          
          {/* Center FAB */}
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
            >
              <Button
                size="icon"
                onClick={handleFabClick}
                className={cn(
                  "w-14 h-14 rounded-full shadow-lg -mt-6 transition-all duration-200",
                  isExpanded 
                    ? "bg-muted text-muted-foreground hover:bg-muted/90 rotate-45" 
                    : "bg-primary hover:bg-primary/90 shadow-primary/30"
                )}
                aria-label={isExpanded ? "Close quick actions menu" : "Open quick actions menu"}
                aria-expanded={isExpanded}
                aria-haspopup="menu"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Plus className="w-6 h-6" aria-hidden="true" />
                </motion.div>
              </Button>
            </motion.div>
          </div>

          {/* Right side: Chats, Notifications */}
          {rightNavItems.map((item) => {
            const badge = getBadge(item.path);
            return (
              <motion.button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative py-2",
                  isActive(item.path) 
                    ? "text-primary" 
                    : "text-muted-foreground active:text-foreground"
                )}
                aria-label={item.label}
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                {isActive(item.path) && (
                  <motion.div 
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative" aria-hidden="true">
                  {item.icon}
                  {badge?.count && badge.count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {badge.count > 9 ? '9+' : badge.count}
                    </span>
                  )}
                  {badge?.dot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
