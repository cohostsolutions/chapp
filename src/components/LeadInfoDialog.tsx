import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Calendar, Tag, MessageSquare, Bot, History, Edit2, Save, X, PhoneCall, Sparkles, ChevronRight, CalendarCheck, ShoppingBag, Link, Briefcase, UserCheck, ArrowLeftRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { devError } from '@/lib/logger';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
} from '@/components/shared/ResponsiveDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useContactAccessLogging } from '@/hooks/useContactAccessLogging';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ReturningGuestBadge } from '@/components/leads/ReturningGuestBadge';
import { LeadTemperatureBadge } from '@/components/LeadTemperatureBadge';
import { AgentTakeoverButton } from '@/components/AgentTakeoverButton';
import { AgentHandbackButton } from '@/components/AgentHandbackButton';
import { LinkToBookingDialog } from '@/components/conversations/LinkToBookingDialog';

export interface LeadInfo {
  id: string | number;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  source?: string | null;
  notes?: string | null;
  summary?: string | null;
  created_at?: string;
  assignedAgent?: { id: string; name: string } | null;
  lead_temperature?: 'hot' | 'warm' | 'cold' | null;
  qualification_status?: string | null;
  is_ai_managed?: boolean | null;
}

interface ActivityItem {
  id: string;
  type: 'call' | 'chat' | 'status_change' | 'ai_conversation' | 'booking' | 'order' | 'communication';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface LeadInfoDialogProps {
  lead: LeadInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCall?: (lead: LeadInfo) => void;
  onChat?: (lead: LeadInfo) => void;
  onUpdate?: (lead: LeadInfo) => void;
}

const statusColors: Record<string, string> = {
  new: 'bg-primary/20 text-primary border-primary/30',
  contacted: 'bg-warning/20 text-warning border-warning/30',
  qualified: 'bg-success/20 text-success border-success/30',
  converted: 'bg-success/20 text-success border-success/30',
  lost: 'bg-destructive/20 text-destructive border-destructive/30',
};

const statusOptions = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const sourceOptions = ['Facebook', 'Website', 'Referral', 'Instagram', 'Google Ads', 'WhatsApp', 'Other'];

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'call':
      return <PhoneCall className="h-4 w-4 text-success" />;
    case 'chat':
      return <MessageSquare className="h-4 w-4 text-primary" />;
    case 'ai_conversation':
      return <Bot className="h-4 w-4 text-primary" />;
    case 'status_change':
      return <History className="h-4 w-4 text-warning" />;
    case 'booking':
      return <CalendarCheck className="h-4 w-4 text-success" />;
    case 'order':
      return <ShoppingBag className="h-4 w-4 text-warning" />;
    case 'communication':
      return <Mail className="h-4 w-4 text-primary" />;
    default:
      return <History className="h-4 w-4 text-muted-foreground" />;
  }
};

interface RelatedBooking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  room?: { name: string } | null;
}

interface RelatedOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number | null;
}

interface StayStats {
  totalBookingsCount: number | null;
  totalNightsStayed: number | null;
  firstStayDate: string | null;
  lastStayDate: string | null;
}

export function LeadInfoDialog({ lead, open, onOpenChange, onCall, onChat, onUpdate }: LeadInfoDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logContactAccess } = useContactAccessLogging();
  const { profile } = useAuth();
  const formatCurrency = useFormatCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<LeadInfo | null>(null);
  const [activeTab, setActiveTab] = useState('info');
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [relatedBookings, setRelatedBookings] = useState<RelatedBooking[]>([]);
  const [relatedOrders, setRelatedOrders] = useState<RelatedOrder[]>([]);
  const [stayStats, setStayStats] = useState<StayStats | null>(null);
  const hasLoggedAccess = useRef(false);
  const [isAiManaged, setIsAiManaged] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [organizationType, setOrganizationType] = useState<string | null>(null);
  const [fullLeadData, setFullLeadData] = useState<LeadInfo | null>(null);

  // Log access to contact information when dialog opens
  useEffect(() => {
    if (open && lead?.id && (lead.email || lead.phone) && !hasLoggedAccess.current) {
      hasLoggedAccess.current = true;
      logContactAccess(String(lead.id), lead.name);
    }
    if (!open) {
      hasLoggedAccess.current = false;
      setFullLeadData(null);
    }
  }, [open, lead?.id, lead?.email, lead?.phone, lead?.name, logContactAccess]);

  useEffect(() => {
    if (open && lead?.id) {
      fetchFullLeadData(String(lead.id));
      fetchActivity(String(lead.id));
      fetchRelatedRecords(String(lead.id));
      fetchStayStats(String(lead.id));
      fetchAiManagedStatus(String(lead.id));
      fetchOrganizationType(String(lead.id));
    }
  }, [open, lead?.id]);

  const fetchFullLeadData = async (leadId: string) => {
    try {
      const { data } = await supabase
        .from('leads')
        .select(`
          id, name, email, phone, status, source, notes, 
          ai_summary, created_at, lead_temperature, 
          qualification_status, is_ai_managed, assigned_agent_id
        `)
        .eq('id', leadId)
        .single();

      if (data) {
        // Get assigned agent name if exists
        let assignedAgent = null;
        if (data.assigned_agent_id) {
          const { data: agentData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', data.assigned_agent_id)
            .single();
          if (agentData) {
            assignedAgent = { id: agentData.id, name: agentData.full_name || agentData.email };
          }
        }

        setFullLeadData({
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          status: data.status,
          source: data.source,
          notes: data.notes,
          summary: data.ai_summary,
          created_at: data.created_at,
          lead_temperature: data.lead_temperature,
          qualification_status: data.qualification_status,
          is_ai_managed: data.is_ai_managed,
          assignedAgent,
        });
      }
    } catch (error) {
      devError('Error fetching full lead data:', error);
    }
  };

  const fetchAiManagedStatus = async (leadId: string) => {
    try {
      const { data: leadData } = await supabase
        .from('leads')
        .select('is_ai_managed')
        .eq('id', leadId)
        .single();
      
      setIsAiManaged(leadData?.is_ai_managed ?? null);

      // Get conversation ID if exists
      const { data: convData } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setConversationId(convData?.id ?? null);
    } catch (error) {
      devError('Error fetching AI managed status:', error);
    }
  };

  const fetchOrganizationType = async (leadId: string) => {
    try {
      const { data } = await supabase
        .from('leads')
        .select('organization_id, organizations(ai_agent_type)')
        .eq('id', leadId)
        .single();
      
      const orgData = data?.organizations as { ai_agent_type?: string } | null;
      setOrganizationType(orgData?.ai_agent_type ?? null);
    } catch (error) {
      devError('Error fetching organization type:', error);
    }
  };

  const handleTakeoverComplete = () => {
    setIsAiManaged(false);
  };

  const handleHandbackComplete = () => {
    setIsAiManaged(true);
  };

  const getLinkActionConfig = () => {
    // Jay orgs: link to offerings (sales/services)
    if (organizationType === 'jay') {
      return { label: 'Link to Offering', icon: Briefcase, color: 'text-primary' };
    }
    // May orgs: link to orders (food/restaurant)
    if (organizationType === 'may') {
      return { label: 'Link to Order', icon: ShoppingBag, color: 'text-warning' };
    }
    // Cece orgs: link to booking (hotel/accommodation)
    return { label: 'Link to Booking', icon: Link, color: 'text-success' };
  };

  const fetchStayStats = async (leadId: string) => {
    try {
      const { data } = await supabase
        .from('leads')
        .select('total_bookings_count, total_nights_stayed, first_stay_date, last_stay_date')
        .eq('id', leadId)
        .single();

      if (data) {
        setStayStats({
          totalBookingsCount: data.total_bookings_count,
          totalNightsStayed: data.total_nights_stayed,
          firstStayDate: data.first_stay_date,
          lastStayDate: data.last_stay_date,
        });
      }
    } catch (error) {
      devError('Error fetching stay stats:', error);
    }
  };

  const fetchRelatedRecords = async (leadId: string) => {
    try {
      // Fetch related bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, check_in, check_out, status, room_unit_id')
        .eq('lead_id', leadId)
        .order('check_in', { ascending: false })
        .limit(5);

      if (bookings) {
        // Fetch room names
        const roomIds = bookings.map(b => b.room_unit_id).filter(Boolean);
        const { data: rooms } = await supabase
          .from('room_units')
          .select('id, name')
          .in('id', roomIds);

        const roomMap = new Map(rooms?.map(r => [r.id, r.name]) || []);
        
        setRelatedBookings(bookings.map(b => ({
          id: b.id,
          check_in: b.check_in,
          check_out: b.check_out,
          status: b.status,
          room: b.room_unit_id ? { name: roomMap.get(b.room_unit_id) || 'Unknown' } : null,
        })));
      }

      // Fetch related orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, status, total_amount')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (orders) {
        setRelatedOrders(orders);
      }
    } catch (error) {
      devError('Error fetching related records:', error);
    }
  };

  const fetchActivity = async (leadId: string) => {
    setIsLoadingActivity(true);
    const activities: ActivityItem[] = [];

    try {
      // Fetch call logs
      const { data: callLogs } = await supabase
        .from('call_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (callLogs) {
        callLogs.forEach((call) => {
          const duration = call.duration_seconds 
            ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
            : 'No duration';
          activities.push({
            id: `call-${call.id}`,
            type: 'call',
            description: `${call.status === 'completed' ? 'Completed' : 'Attempted'} call - ${duration}${call.notes ? `: ${call.notes}` : ''}`,
            timestamp: call.created_at,
          });
        });
      }

      // Fetch chat messages (group by date for summary)
      const { data: chatMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (chatMessages && chatMessages.length > 0) {
        // Group messages by hour to avoid too many entries
        const messagesByHour: Record<string, typeof chatMessages> = {};
        chatMessages.forEach((msg) => {
          const hour = format(new Date(msg.created_at), 'yyyy-MM-dd HH:00');
          if (!messagesByHour[hour]) messagesByHour[hour] = [];
          messagesByHour[hour].push(msg);
        });

        Object.entries(messagesByHour).forEach(([hour, msgs]) => {
          const userMsgs = msgs.filter(m => m.role === 'user').length;
          const agentMsgs = msgs.filter(m => m.role !== 'user').length;
          activities.push({
            id: `chat-${hour}`,
            type: 'chat',
            description: `Chat session: ${userMsgs} lead message${userMsgs !== 1 ? 's' : ''}, ${agentMsgs} response${agentMsgs !== 1 ? 's' : ''}`,
            timestamp: msgs[0].created_at,
          });
        });
      }

      // Fetch AI conversations
      const { data: aiConversations } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('lead_id', leadId)
        .order('started_at', { ascending: false });

      if (aiConversations) {
        aiConversations.forEach((conv) => {
          activities.push({
            id: `ai-${conv.id}`,
            type: 'ai_conversation',
            description: `AI conversation via ${conv.platform} - ${conv.status}`,
            timestamp: conv.started_at,
            metadata: { conversationId: conv.id, platform: conv.platform },
          });
        });
      }

      // Fetch bookings for this lead
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, check_in, check_out, status, created_at, room_unit_id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (bookings) {
        for (const booking of bookings) {
          const { data: room } = await supabase
            .from('room_units')
            .select('name')
            .eq('id', booking.room_unit_id)
            .single();
          
          activities.push({
            id: `booking-${booking.id}`,
            type: 'booking',
            description: `Booking ${booking.status}: ${room?.name || 'Room'} (${format(new Date(booking.check_in), 'MMM d')} - ${format(new Date(booking.check_out), 'MMM d')})`,
            timestamp: booking.created_at,
          });
        }
      }

      // Fetch orders for this lead
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (orders) {
        orders.forEach((order) => {
          activities.push({
            id: `order-${order.id}`,
            type: 'order',
            description: `Order ${order.status}${order.total_amount ? ` - ${formatCurrency(order.total_amount)}` : ''}`,
            timestamp: order.created_at,
          });
        });
      }

      // Fetch communications for this lead
      const { data: communications } = await supabase
        .from('communications')
        .select('id, channel, direction, content, subject, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (communications) {
        communications.forEach((comm) => {
          const directionLabel = comm.direction === 'inbound' ? 'Received' : 'Sent';
          const channelLabel = comm.channel.charAt(0).toUpperCase() + comm.channel.slice(1);
          const preview = comm.subject || (comm.content ? comm.content.substring(0, 50) + (comm.content.length > 50 ? '...' : '') : '');
          activities.push({
            id: `comm-${comm.id}`,
            type: 'communication',
            description: `${directionLabel} ${channelLabel}${preview ? `: ${preview}` : ''}`,
            timestamp: comm.created_at,
          });
        });
      }

      // Fetch audit logs for status changes
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('id, action, details, created_at')
        .eq('resource_id', leadId)
        .eq('resource_type', 'lead')
        .order('created_at', { ascending: false })
        .limit(20);

      if (auditLogs) {
        auditLogs.forEach((log) => {
          if (log.action.includes('status') || log.action.includes('update')) {
            const details = log.details as Record<string, unknown> | null;
            const description = details?.description || `Lead ${log.action}`;
            activities.push({
              id: `audit-${log.id}`,
              type: 'status_change',
              description: String(description),
              timestamp: log.created_at,
            });
          }
        });
      }

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(activities);

      // Show notification if no activity found
      if (activities.length === 0) {
        toast({
          title: 'No Activity Found',
          description: 'This lead has no recorded activity yet.',
        });
      }
    } catch (error) {
      devError('Error fetching activity:', error);
      toast({
        title: 'Error',
        description: 'Failed to load activity history',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingActivity(false);
    }
  };

  if (!lead) return null;

  const handleEdit = () => {
    setEditedLead({ ...lead });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedLead(null);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (editedLead && onUpdate) {
      onUpdate(editedLead);
      toast({
        title: "Lead Updated",
        description: `${editedLead.name}'s information has been saved`,
      });
    }
    setIsEditing(false);
    setEditedLead(null);
  };

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!lead) return;

    try {
      // Update in database if it's a real lead
      const leadIdStr = String(lead.id);
      if (leadIdStr.length > 10) { // UUID check
        const { error } = await supabase
          .from('leads')
          .update({ status: newStatus as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' })
          .eq('id', leadIdStr);

        if (error) throw error;
      }

      // Update local state
      if (onUpdate) {
        onUpdate({ ...lead, status: newStatus });
      }

      // Add activity item for the status change
      const statusChangeActivity: ActivityItem = {
        id: `status-${Date.now()}`,
        type: 'status_change',
        description: `Status changed from "${lead.status}" to "${newStatus}"`,
        timestamp: new Date().toISOString(),
      };
      setActivity(prev => [statusChangeActivity, ...prev]);

      toast({
        title: "Status Updated",
        description: `Lead status changed to ${newStatus}`,
      });
    } catch (error) {
      devError('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleNavigateToChats = () => {
    onOpenChange(false);
    navigate(`/chats?leadId=${lead.id}`);
  };

  const handleNavigateToAIConversations = () => {
    onOpenChange(false);
    navigate('/chats');
  };

  // Use fullLeadData when available, fallback to passed lead prop
  const currentLead = isEditing && editedLead ? editedLead : (fullLeadData || lead);

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      maxWidth="sm:max-w-lg"
      maxHeight="max-h-[75vh]"
    >
      <ResponsiveDialogHeader>
        <div className="flex items-center justify-between">
          <ResponsiveDialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            {isEditing ? (
              <Input
                value={editedLead?.name || ''}
                onChange={(e) => setEditedLead(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="max-w-[200px]"
              />
            ) : (
              <span>{lead.name}</span>
            )}
          </ResponsiveDialogTitle>
          {!isEditing ? (
            <Button variant="ghost" size="icon" onClick={handleEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={handleCancel} title="Cancel editing">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSave}>
                <Save className="h-4 w-4 text-success" />
              </Button>
            </div>
          )}
        </div>
        <ResponsiveDialogDescription>Lead Information & Activity</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {/* Status & Source */}
                <div className="flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <Select
                        value={editedLead?.status || ''}
                        onValueChange={(value) => setEditedLead(prev => prev ? { ...prev, status: value } : null)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={editedLead?.source || ''}
                        onChange={(e) => setEditedLead(prev => prev ? { ...prev, source: e.target.value } : null)}
                        placeholder="Source"
                        className="w-[140px]"
                      />
                    </>
                  ) : (
                    <>
                      {currentLead.status && (
                        <Badge variant="outline" className={cn(statusColors[currentLead.status])}>
                          {currentLead.status.charAt(0).toUpperCase() + currentLead.status.slice(1)}
                        </Badge>
                      )}
                      {currentLead.lead_temperature && (
                        <LeadTemperatureBadge temperature={currentLead.lead_temperature} />
                      )}
                      {currentLead.source && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {currentLead.source}
                        </Badge>
                      )}
                      {currentLead.is_ai_managed && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          AI Managed
                        </Badge>
                      )}
                      {stayStats && (
                        <ReturningGuestBadge
                          totalBookingsCount={stayStats.totalBookingsCount}
                          totalNightsStayed={stayStats.totalNightsStayed}
                          firstStayDate={stayStats.firstStayDate}
                          lastStayDate={stayStats.lastStayDate}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* AI Summary */}
                {currentLead.summary && (
                  <>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                        <Sparkles className="h-4 w-4" />
                        AI Summary
                      </div>
                      <p className="text-sm text-muted-foreground">{currentLead.summary}</p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Contact Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {isEditing ? (
                      <Input
                        type="email"
                        value={editedLead?.email || ''}
                        onChange={(e) => setEditedLead(prev => prev ? { ...prev, email: e.target.value } : null)}
                        placeholder="Email address"
                        className="flex-1"
                      />
                    ) : currentLead.email ? (
                      <a href={`mailto:${currentLead.email}`} className="text-primary hover:underline">
                        {currentLead.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No email</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {isEditing ? (
                      <Input
                        type="tel"
                        value={editedLead?.phone || ''}
                        onChange={(e) => setEditedLead(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        placeholder="Phone number"
                        className="flex-1"
                      />
                    ) : currentLead.phone ? (
                      <a href={`tel:${currentLead.phone}`} className="text-primary hover:underline">
                        {currentLead.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No phone</span>
                    )}
                  </div>
                  {currentLead.created_at && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Added {format(new Date(currentLead.created_at), 'PPP')}</span>
                    </div>
                  )}
                  {currentLead.assignedAgent && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Assigned to {currentLead.assignedAgent.name}</span>
                    </div>
                  )}
                </div>

                {/* Connected Bookings & Orders */}
                {(relatedBookings.length > 0 || relatedOrders.length > 0) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {relatedBookings.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-primary" />
                            Connected Bookings
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {relatedBookings.map((booking) => (
                              <Badge
                                key={booking.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate('/accommodation');
                                }}
                              >
                                <CalendarCheck className="h-3 w-3 mr-1" />
                                {booking.room?.name || 'Booking'} • {format(new Date(booking.check_in), 'MMM d')} - {format(new Date(booking.check_out), 'MMM d')}
                                <span className={cn(
                                  "ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  booking.status === 'upcoming' ? 'bg-success/20 text-success' :
                                  booking.status === 'pending' ? 'bg-warning/20 text-warning' :
                                  booking.status === 'cancelled' ? 'bg-destructive/20 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                )}>
                                  {booking.status}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {relatedOrders.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                            Connected Orders
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {relatedOrders.map((order) => (
                              <Badge
                                key={order.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate('/menu-and-orders?tab=orders');
                                }}
                              >
                                <ShoppingBag className="h-3 w-3 mr-1" />
                                {format(new Date(order.created_at), 'MMM d, yyyy')}
                                {order.total_amount && ` • ${formatCurrency(order.total_amount)}`}
                                <span className={cn(
                                  "ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  order.status === 'completed' ? 'bg-success/20 text-success' :
                                  order.status === 'pending' ? 'bg-warning/20 text-warning' :
                                  order.status === 'cancelled' ? 'bg-destructive/20 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                )}>
                                  {order.status}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Notes */}
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Notes</p>
                  {isEditing ? (
                    <Textarea
                      value={editedLead?.notes || ''}
                      onChange={(e) => setEditedLead(prev => prev ? { ...prev, notes: e.target.value } : null)}
                      placeholder="Add notes about this lead..."
                      className="min-h-[80px]"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {currentLead.notes || 'No notes yet'}
                    </p>
                  )}
                </div>

                {/* Quick Actions */}
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {/* View Conversations */}
                    <Button variant="outline" size="sm" onClick={handleNavigateToChats}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Conversations
                    </Button>
                    
                    {/* Call - only if phone exists */}
                    {currentLead.phone && onCall && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onCall(currentLead);
                          onOpenChange(false);
                        }}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Call
                      </Button>
                    )}
                    
                    {/* Takeover/Handback */}
                    {isAiManaged === true && (
                      <AgentTakeoverButton
                        leadId={String(lead.id)}
                        leadName={lead.name}
                        conversationId={conversationId || undefined}
                        onTakeover={handleTakeoverComplete}
                      />
                    )}
                    {isAiManaged === false && (
                      <AgentHandbackButton
                        leadId={String(lead.id)}
                        leadName={lead.name}
                        conversationId={conversationId || undefined}
                        onHandback={handleHandbackComplete}
                      />
                    )}
                    
                    {/* Link to Booking/Order/Offering */}
                    {(() => {
                      const config = getLinkActionConfig();
                      const IconComponent = config.icon;
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLinkDialogOpen(true)}
                          className={config.color}
                        >
                          <IconComponent className="h-4 w-4 mr-2" />
                          {config.label}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {/* Quick Status Change */}
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm font-medium mb-2">Quick Status Change</p>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <Button
                        key={status}
                        variant={currentLead.status === status ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleQuickStatusChange(status)}
                        className={cn(
                          "text-xs",
                          currentLead.status === status && "pointer-events-none"
                        )}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        {currentLead.status !== status && (
                          <ChevronRight className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <p className="text-sm text-muted-foreground">Recent activity for this lead</p>
                
                {isLoadingActivity ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading activity...</p>
                  </div>
                ) : activity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                    
                    <div className="space-y-4">
                      {activity.map((item) => (
                        <div key={item.id} className="flex gap-3 relative">
                          <div className="w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center z-10">
                            {getActivityIcon(item.type)}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm">{item.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.timestamp), 'PPp')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </ResponsiveDialogBody>

      {/* Link Dialog */}
      <LinkToBookingDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        leadId={String(lead.id)}
        leadName={lead.name}
        conversationDate={lead.created_at || new Date().toISOString()}
      />
    </ResponsiveDialog>
  );
}

interface ClickableLeadNameProps {
  lead: LeadInfo;
  onSelect: (lead: LeadInfo) => void;
  className?: string;
}

export function ClickableLeadName({ lead, onSelect, className }: ClickableLeadNameProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect(lead);
      }}
      className={cn(
        "font-medium text-foreground hover:text-primary hover:underline transition-colors text-left",
        className
      )}
    >
      {lead.name}
    </button>
  );
}
