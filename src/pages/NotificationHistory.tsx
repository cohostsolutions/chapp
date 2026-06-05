import { useState, useMemo } from 'react';
import { useNotificationHistory, NotificationHistoryItem } from '@/hooks/useNotificationHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  MessageSquare, 
  Phone, 
  Mail, 
  MessageCircle,
  AlertCircle,
  Info,
  Loader2,
  Search,
  Users,
  ShoppingBag,
  Calendar,
  Shield,
  Building2,
  TrendingUp,
  BookOpen,
  UserCheck,
  Bot,
  Filter,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

// Comprehensive notification type configuration
const notificationConfig: Record<string, { icon: typeof Bell; color: string; label: string; route: string }> = {
  // Communication channels
  sms: { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', label: 'SMS', route: '/communications' },
  call: { icon: Phone, color: 'text-green-500 bg-green-500/10', label: 'Call', route: '/communications' },
  email: { icon: Mail, color: 'text-orange-500 bg-orange-500/10', label: 'Email', route: '/communications' },
  whatsapp: { icon: MessageCircle, color: 'text-emerald-500 bg-emerald-500/10', label: 'WhatsApp', route: '/communications' },
  messenger: { icon: MessageCircle, color: 'text-blue-600 bg-blue-600/10', label: 'Messenger', route: '/communications' },
  // Agent notifications
  lead_assignment: { icon: Users, color: 'text-blue-500 bg-blue-500/10', label: 'Assignment', route: '/sales-operations?tab=leads' },
  lead_status_change: { icon: TrendingUp, color: 'text-orange-500 bg-orange-500/10', label: 'Status Change', route: '/sales-operations?tab=leads' },
  new_message: { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', label: 'Message', route: '/communications' },
  training_reminder: { icon: BookOpen, color: 'text-indigo-500 bg-indigo-500/10', label: 'Training', route: '/ai-training' },
  // Client Admin notifications
  new_lead: { icon: Users, color: 'text-blue-500 bg-blue-500/10', label: 'New Lead', route: '/sales-operations?tab=leads' },
  new_order: { icon: ShoppingBag, color: 'text-green-500 bg-green-500/10', label: 'New Order', route: '/menu-and-orders?tab=orders' },
  new_booking: { icon: Calendar, color: 'text-purple-500 bg-purple-500/10', label: 'New Booking', route: '/accommodation' },
  agent_takeover: { icon: UserCheck, color: 'text-amber-500 bg-amber-500/10', label: 'Takeover', route: '/chats' },
  agent_handback: { icon: Bot, color: 'text-primary bg-primary/10', label: 'Handback', route: '/chats' },
  agent_performance: { icon: TrendingUp, color: 'text-red-500 bg-red-500/10', label: 'Performance', route: '/ai-training' },
  daily_summary: { icon: Mail, color: 'text-muted-foreground bg-muted', label: 'Summary', route: '/reporting' },
  // Super Admin notifications
  cross_org_alert: { icon: Building2, color: 'text-red-500 bg-red-500/10', label: 'Cross-Org Alert', route: '/organizations' },
  new_organization: { icon: Building2, color: 'text-green-500 bg-green-500/10', label: 'New Org', route: '/organizations' },
  security_alert: { icon: Shield, color: 'text-red-500 bg-red-500/10', label: 'Security', route: '/security' },
  system_health: { icon: AlertCircle, color: 'text-amber-500 bg-amber-500/10', label: 'System Health', route: '/dashboard' },
  // Generic fallbacks
  communication: { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', label: 'Communication', route: '/communications' },
  alert: { icon: AlertCircle, color: 'text-red-500 bg-red-500/10', label: 'Alert', route: '/dashboard' },
  system: { icon: Info, color: 'text-muted-foreground bg-muted', label: 'System', route: '/dashboard' },
};

const allNotificationTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'lead_assignment', label: 'Assignments' },
  { value: 'new_message', label: 'Messages' },
  { value: 'new_lead', label: 'New Leads' },
  { value: 'new_order', label: 'New Orders' },
  { value: 'new_booking', label: 'New Bookings' },
  { value: 'agent_takeover', label: 'Agent Takeover' },
  { value: 'security_alert', label: 'Security' },
  { value: 'system_health', label: 'System Health' },
];

// Helper to group notifications by date
function groupNotificationsByDate(notifications: NotificationHistoryItem[]) {
  const groups: { label: string; date: Date; notifications: NotificationHistoryItem[] }[] = [];
  
  notifications.forEach(notification => {
    const notifDate = startOfDay(new Date(notification.created_at));
    let label: string;
    
    if (isToday(notifDate)) {
      label = 'Today';
    } else if (isYesterday(notifDate)) {
      label = 'Yesterday';
    } else if (isThisWeek(notifDate)) {
      label = format(notifDate, 'EEEE');
    } else {
      label = format(notifDate, 'MMMM d, yyyy');
    }
    
    const existingGroup = groups.find(g => g.label === label);
    if (existingGroup) {
      existingGroup.notifications.push(notification);
    } else {
      groups.push({ label, date: notifDate, notifications: [notification] });
    }
  });
  
  return groups;
}

function NotificationItem({ 
  notification, 
  onMarkRead, 
  onDelete,
  onNavigate,
  isSelected,
  onSelect,
  showCheckbox = false
}: { 
  notification: NotificationHistoryItem;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (notification: NotificationHistoryItem) => void;
  isSelected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  showCheckbox?: boolean;
}) {
  const config = notificationConfig[notification.channel || notification.type] || notificationConfig.system;
  const Icon = config.icon;
  const [colorClass, bgClass] = config.color.split(' ');

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`group flex items-start gap-3 p-4 border-b last:border-b-0 transition-all hover:bg-muted/50 cursor-pointer ${
        notification.is_read ? 'bg-background' : 'bg-primary/5'
      }`}
      onClick={() => onNavigate(notification)}
    >
      {showCheckbox && (
        <div className="flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect?.(notification.id, checked as boolean)}
          />
        </div>
      )}
      
      <div className={`p-2.5 rounded-xl ${bgClass || 'bg-muted'} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${colorClass || 'text-muted-foreground'}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className={`font-medium text-sm line-clamp-1 ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
            {notification.title}
          </h4>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />
          )}
        </div>
        {notification.message && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-1.5">
            {notification.message}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>
          <Badge variant="outline" className={`text-xs ${colorClass}`}>
            {config.label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMarkRead(notification.id)}
            title="Mark as read"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(notification.id)}
          title="Delete notification"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

export default function NotificationHistory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    isClearing,
  } = useNotificationHistory();

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkSelect, setShowBulkSelect] = useState(false);

  // Filter and search notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Read/unread filter
      if (filter === 'unread' && n.is_read) return false;
      if (filter === 'read' && !n.is_read) return false;
      
      // Type filter
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(query) ||
          n.message?.toLowerCase().includes(query) ||
          n.type.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [notifications, filter, typeFilter, searchQuery]);

  // Group filtered notifications by date
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);

  const handleMarkAllRead = () => {
    markAllAsRead();
    toast({
      title: 'All notifications marked as read',
    });
  };

  const handleClearAll = () => {
    clearAllNotifications();
    toast({
      title: 'All notifications cleared',
    });
  };

  const handleNavigate = (notification: NotificationHistoryItem) => {
    // Mark as read when navigating
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate to the appropriate route
    const config = notificationConfig[notification.channel || notification.type] || notificationConfig.system;
    
    // If there's a related_id, try to navigate to the specific item
    if (notification.related_id) {
      navigate(`${config.route}?highlight=${notification.related_id}`);
    } else {
      navigate(config.route);
    }
  };

  const handleSelectNotification = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkMarkRead = () => {
    selectedIds.forEach(id => {
      const notif = notifications.find(n => n.id === id);
      if (notif && !notif.is_read) {
        markAsRead(id);
      }
    });
    setSelectedIds(new Set());
    toast({ title: `${selectedIds.size} notifications marked as read` });
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteNotification(id));
    setSelectedIds(new Set());
    toast({ title: `${selectedIds.size} notifications deleted` });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Card>
          <CardContent className="p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 py-4 border-b last:border-b-0">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notification History
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Read all</span>
            </Button>
          )}
          
          {notifications.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Clear all</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your notifications. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} disabled={isClearing}>
                    {isClearing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      'Clear all'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {allNotificationTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Bulk Select Toggle */}
            <Button 
              variant={showBulkSelect ? "default" : "outline"} 
              size="sm"
              onClick={() => {
                setShowBulkSelect(!showBulkSelect);
                if (showBulkSelect) setSelectedIds(new Set());
              }}
              className="hidden sm:flex"
            >
              <Checkbox className="h-4 w-4 mr-2" checked={showBulkSelect} />
              Select
            </Button>
          </div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {showBulkSelect && selectedIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 mt-3 pt-3 border-t"
              >
                <Checkbox
                  checked={selectedIds.size === filteredNotifications.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={handleBulkMarkRead}>
                  <Check className="h-4 w-4 mr-1" />
                  Mark read
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Tabs & Notifications List */}
      <Card>
        <CardHeader className="pb-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="flex-1 sm:flex-none">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex-1 sm:flex-none">
                Unread ({unreadCount})
              </TabsTrigger>
              <TabsTrigger value="read" className="flex-1 sm:flex-none">
                Read ({notifications.length - unreadCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {searchQuery || typeFilter !== 'all' 
                  ? 'No matching notifications'
                  : filter === 'all' 
                  ? 'No notifications yet' 
                  : `No ${filter} notifications`}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || typeFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : filter === 'all' 
                  ? "When you receive notifications, they'll appear here."
                  : filter === 'unread'
                  ? "You've read all your notifications."
                  : "No read notifications to show."}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <AnimatePresence mode="popLayout">
                {groupedNotifications.map((group) => (
                  <div key={group.label}>
                    {/* Date Header */}
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 border-b z-10">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                    
                    {/* Notifications in this group */}
                    {group.notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onDelete={deleteNotification}
                        onNavigate={handleNavigate}
                        isSelected={selectedIds.has(notification.id)}
                        onSelect={handleSelectNotification}
                        showCheckbox={showBulkSelect}
                      />
                    ))}
                  </div>
                ))}
              </AnimatePresence>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
