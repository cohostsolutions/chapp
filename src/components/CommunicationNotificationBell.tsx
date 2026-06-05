import { useState, useEffect, useRef } from 'react';
import { Bell, UserCheck, Bot, MessageSquare, Phone, Mail, MessageCircle, Users, ShoppingBag, Calendar, Shield, Building2, TrendingUp, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { useRoleNotifications } from '@/hooks/useRoleNotifications';

interface Communication {
  id: string;
  channel: string;
  direction: string;
  content: string | null;
  subject: string | null;
  created_at: string;
  lead_id: string | null;
  status: string | null;
}

const channelIcons: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  messenger: MessageCircle,
};

const channelLabels: Record<string, string> = {
  sms: 'SMS',
  call: 'Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
};

// Notification type icons and colors
const notificationTypeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  // Agent notifications
  lead_assignment: { icon: Users, color: 'text-blue-500', label: 'Assignment' },
  lead_status_change: { icon: TrendingUp, color: 'text-orange-500', label: 'Status Change' },
  new_message: { icon: MessageSquare, color: 'text-blue-500', label: 'Message' },
  training_reminder: { icon: BookOpen, color: 'text-indigo-500', label: 'Training' },
  // Client Admin notifications
  new_lead: { icon: Users, color: 'text-blue-500', label: 'New Lead' },
  new_order: { icon: ShoppingBag, color: 'text-green-500', label: 'New Order' },
  new_booking: { icon: Calendar, color: 'text-purple-500', label: 'New Booking' },
  agent_takeover: { icon: UserCheck, color: 'text-amber-500', label: 'Takeover' },
  agent_handback: { icon: Bot, color: 'text-primary', label: 'Handback' },
  agent_performance: { icon: TrendingUp, color: 'text-red-500', label: 'Performance' },
  daily_summary: { icon: Mail, color: 'text-muted-foreground', label: 'Summary' },
  // Super Admin notifications
  cross_org_alert: { icon: Building2, color: 'text-red-500', label: 'Cross-Org Alert' },
  new_organization: { icon: Building2, color: 'text-green-500', label: 'New Org' },
  security_alert: { icon: Shield, color: 'text-red-500', label: 'Security' },
  system_health: { icon: Bell, color: 'text-amber-500', label: 'System Health' },
};

export function CommunicationNotificationBell() {
  const { profile, orgFeatures, user, isSuperAdmin, effectiveIsClientAdmin, effectiveIsAgent } = useAuth();
  const navigate = useNavigate();
  const [commUnreadCount, setCommUnreadCount] = useState(0);
  const [recentCommunications, setRecentCommunications] = useState<Communication[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const initializedRef = useRef(false);

  // Initialize role-based notifications
  const { orgType, labels } = useRoleNotifications();

  // Use notification history hook for system notifications
  const { 
    notifications: systemNotifications, 
    unreadCount: systemUnreadCount,
    markAsRead,
    markAllAsRead: markAllSystemAsRead,
    refetch: refetchNotifications
  } = useNotificationHistory();

  // Group notifications by category based on role
  const agentNotifications = systemNotifications.filter(n => 
    ['lead_assignment', 'lead_status_change', 'new_message', 'training_reminder'].includes(n.type)
  ).slice(0, 5);

  const adminNotifications = systemNotifications.filter(n => 
    ['new_lead', 'new_order', 'new_booking', 'agent_takeover', 'agent_handback', 'agent_performance', 'daily_summary'].includes(n.type)
  ).slice(0, 5);

  const superAdminNotifications = systemNotifications.filter(n => 
    ['cross_org_alert', 'new_organization', 'security_alert', 'system_health'].includes(n.type)
  ).slice(0, 5);

  // Total unread count
  const totalUnreadCount = commUnreadCount + systemUnreadCount;

  // Fetch recent inbound communications
  const fetchRecentCommunications = async () => {
    if (!profile?.organization_id) return;

    const { data, error } = await supabase
      .from('communications')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRecentCommunications(data);
      const unread = data.filter(c => !c.status || c.status === 'unread').length;
      setCommUnreadCount(unread);
    }
  };

  useEffect(() => {
    if (!profile?.organization_id) {
      return;
    }

    if (orgFeatures?.communications_enabled) {
      fetchRecentCommunications();
    }

    // Prevent duplicate subscriptions
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Subscribe to new communications
    const commChannel = supabase
      .channel('communications-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => {
          const newComm = payload.new as Communication;
          if (newComm.direction === 'inbound') {
            setRecentCommunications(prev => [newComm, ...prev.slice(0, 9)]);
            setCommUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          fetchRecentCommunications();
        }
      )
      .subscribe();

    // Subscribe to notification_history for real-time system notifications
    const notifChannel = supabase
      .channel('notification-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_history',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          refetchNotifications();
        }
      )
      .subscribe();

    return () => {
      initializedRef.current = false;
      supabase.removeChannel(commChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [profile?.organization_id, orgFeatures?.communications_enabled, user?.id]);

  const markAllAsRead = async () => {
    if (!profile?.organization_id) return;

    // Mark communications as read
    if (orgFeatures?.communications_enabled) {
      await supabase
        .from('communications')
        .update({ status: 'read' })
        .eq('organization_id', profile.organization_id)
        .eq('direction', 'inbound')
        .or('status.is.null,status.eq.unread');
    }

    // Mark system notifications as read
    markAllSystemAsRead();

    setCommUnreadCount(0);
    fetchRecentCommunications();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/communications');
  };

  const handleNotificationClick = (notification: typeof systemNotifications[0]) => {
    markAsRead(notification.id);
    setIsOpen(false);
    
    // Navigate based on notification type
    const navigationMap: Record<string, string> = {
      lead_assignment: '/sales-operations?tab=leads',
      lead_status_change: '/sales-operations?tab=leads',
      new_message: '/communications',
      training_reminder: '/ai-training',
      new_lead: '/sales-operations?tab=leads',
      new_order: '/menu-and-orders?tab=orders',
      new_booking: '/accommodation',
      agent_takeover: '/chats',
      agent_handback: '/chats',
      agent_performance: '/ai-training',
      daily_summary: '/reporting',
      cross_org_alert: '/organizations',
      new_organization: '/organizations',
      security_alert: '/security',
      system_health: '/dashboard',
    };

    const route = navigationMap[notification.type] || '/notifications';
    navigate(route);
  };

  const getNotificationIcon = (type: string) => {
    const config = notificationTypeConfig[type];
    if (config) {
      const Icon = config.icon;
      return <Icon className={`h-4 w-4 ${config.color}`} />;
    }
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  const renderNotificationGroup = (
    notifications: typeof systemNotifications,
    label: string
  ) => {
    if (notifications.length === 0) return null;

    return (
      <>
        <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
          {label}
        </DropdownMenuLabel>
        {notifications.map((notif) => {
          const isUnread = !notif.is_read;
          return (
            <DropdownMenuItem
              key={notif.id}
              className={`flex items-start gap-3 p-3 cursor-pointer ${isUnread ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{notif.title}</span>
                  {isUnread && (
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {notif.message}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
      </>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          aria-label={`Notifications${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread` : ''}`}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {totalUnreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              aria-hidden="true"
            >
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-semibold text-sm">Notifications</span>
          {totalUnreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[350px]">
          {/* Super Admin Notifications */}
          {isSuperAdmin && !effectiveIsClientAdmin && !effectiveIsAgent && 
            renderNotificationGroup(superAdminNotifications, 'System Alerts')}

          {/* Admin Notifications */}
          {effectiveIsClientAdmin && renderNotificationGroup(adminNotifications, 'Business Activity')}

          {/* Agent Notifications */}
          {effectiveIsAgent && renderNotificationGroup(agentNotifications, 'Your Activity')}

          {/* Communications */}
          {orgFeatures?.communications_enabled && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
                Messages
              </DropdownMenuLabel>
              {recentCommunications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No recent communications
                </div>
              ) : (
                recentCommunications.map((comm) => {
                  const Icon = channelIcons[comm.channel] || MessageSquare;
                  const isUnread = !comm.status || comm.status === 'unread';
                  
                  return (
                    <DropdownMenuItem
                      key={comm.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer ${isUnread ? 'bg-muted/50' : ''}`}
                      onClick={handleViewAll}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {channelLabels[comm.channel] || comm.channel}
                          </span>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {comm.subject || comm.content?.slice(0, 50) || 'New message'}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </>
          )}

          {/* Empty state */}
          {!orgFeatures?.communications_enabled && 
           superAdminNotifications.length === 0 && 
           adminNotifications.length === 0 && 
           agentNotifications.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        {orgFeatures?.communications_enabled && (
          <DropdownMenuItem onClick={handleViewAll} className="justify-center text-primary">
            View all communications
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { setIsOpen(false); navigate('/notifications'); }} className="justify-center text-muted-foreground">
          Notification history
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
