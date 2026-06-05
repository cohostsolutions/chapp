import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Ticket, MessageCircle, CheckCircle, Clock, AlertCircle, Filter, User, Building2, ArrowUpDown, Inbox } from 'lucide-react';
import { useHelpdeskTickets, useTeamChatMessages } from '@/hooks/useTeamChat';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface HelpdeskTicket {
  id: string;
  organization_id: string;
  organization_name: string;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_avatar_url: string | null;
  subject: string;
  priority: string;
  status: string;
  chat_id: string | null;
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  assigned_admin_email: string | null;
  assigned_at: string | null;
  assigned_by_admin_id: string | null;
  assigned_by_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by_admin_id: string | null;
  resolved_by_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  last_message_sender_name: string | null;
  needs_admin_reply: boolean;
  waiting_on: 'admin' | 'requester' | 'resolved';
}

type QueueView = 'all' | 'unassigned' | 'mine' | 'needs_reply';
type SortMode = 'recent_activity' | 'oldest_open' | 'priority';

const priorityRank: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const queueViewLabels: Record<QueueView, string> = {
  all: 'All Tickets',
  unassigned: 'Unassigned',
  mine: 'My Queue',
  needs_reply: 'Needs Reply',
};

const waitingOnLabels: Record<HelpdeskTicket['waiting_on'], string> = {
  admin: 'Waiting on Admin',
  requester: 'Waiting on Requester',
  resolved: 'Resolved',
};

export default function SupportTickets() {
  const { user, profile, isSuperAdmin } = useAuth();
  const { assignTicket, resolveTicket } = useHelpdeskTickets({ loadTickets: false });
  const [selectedTicket, setSelectedTicket] = useState<HelpdeskTicket | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterOrganization, setFilterOrganization] = useState<string>('all');
  const [queueView, setQueueView] = useState<QueueView>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent_activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  const { data: supportTickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets-snapshot'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_support_tickets_snapshot');
      if (error) throw error;
      return (data ?? []) as HelpdeskTicket[];
    },
    enabled: isSuperAdmin
  });

  // Chat messages for selected ticket
  const { messages, sendMessage, isLoading: messagesLoading } = useTeamChatMessages(selectedTicket?.chat_id || null);

  const organizations = useMemo(
    () => Array.from(new Map(supportTickets.map(ticket => [ticket.organization_id, ticket.organization_name])).entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [supportTickets]
  );

  useEffect(() => {
    if (!selectedTicket) return;

    const refreshedTicket = supportTickets.find(ticket => ticket.id === selectedTicket.id) ?? null;
    setSelectedTicket(refreshedTicket);
  }, [selectedTicket?.id, supportTickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const visibleTickets = supportTickets.filter(ticket => {
      if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
      if (filterPriority !== 'all' && ticket.priority !== filterPriority) return false;
      if (filterOrganization !== 'all' && ticket.organization_id !== filterOrganization) return false;

      if (queueView === 'unassigned' && ticket.assigned_admin_id) return false;
      if (queueView === 'mine' && ticket.assigned_admin_id !== user?.id) return false;
      if (queueView === 'needs_reply' && !ticket.needs_admin_reply) return false;

      if (normalizedSearch) {
        return [
          ticket.subject,
          ticket.requester_name,
          ticket.requester_email,
          ticket.organization_name,
          ticket.assigned_admin_name,
          ticket.last_message_preview,
        ].some(value => value?.toLowerCase().includes(normalizedSearch));
      }

      return true;
    });

    return visibleTickets.sort((left, right) => {
      if (sortMode === 'priority') {
        return (priorityRank[left.priority] ?? 99) - (priorityRank[right.priority] ?? 99)
          || new Date(left.last_message_at ?? left.updated_at ?? left.created_at).getTime()
          - new Date(right.last_message_at ?? right.updated_at ?? right.created_at).getTime();
      }

      if (sortMode === 'oldest_open') {
        return new Date(left.last_message_at ?? left.created_at).getTime()
          - new Date(right.last_message_at ?? right.created_at).getTime();
      }

      return new Date(right.last_message_at ?? right.updated_at ?? right.created_at).getTime()
        - new Date(left.last_message_at ?? left.updated_at ?? left.created_at).getTime();
    });
  }, [filterOrganization, filterPriority, filterStatus, queueView, searchQuery, sortMode, supportTickets, user?.id]);

  const stats = useMemo(() => {
    const allTickets = supportTickets;
    return {
      total: allTickets.length,
      open: allTickets.filter(t => t.status === 'open').length,
      inProgress: allTickets.filter(t => t.status === 'in_progress').length,
      needsReply: allTickets.filter(t => t.needs_admin_reply).length,
      unassigned: allTickets.filter(t => !t.assigned_admin_id && t.status !== 'resolved').length,
    };
  }, [supportTickets]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  const handleAssignToMe = async (ticketId: string) => {
    if (!user) return;
    await assignTicket.mutateAsync({ ticketId, adminId: user.id });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? {
        ...prev,
        assigned_admin_id: user.id,
        assigned_admin_name: profile?.full_name || profile?.email || 'You',
        assigned_admin_email: profile?.email || null,
        assigned_at: new Date().toISOString(),
        assigned_by_admin_id: user.id,
        assigned_by_name: profile?.full_name || profile?.email || 'You',
        status: 'in_progress'
      } : null);
    }
  };

  const handleResolve = async (ticketId: string) => {
    await resolveTicket.mutateAsync(ticketId);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? {
        ...prev,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: user?.id ?? null,
        resolved_by_name: profile?.full_name || profile?.email || null,
        waiting_on: 'resolved',
        needs_admin_reply: false,
      } : null);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket?.chat_id) return;
    await sendMessage.mutateAsync({ content: replyMessage });
    setReplyMessage('');
  };

  const renderRelativeTime = (value: string | null) => {
    if (!value) return 'No activity yet';
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  };

  const renderWaitingBadge = (ticket: HelpdeskTicket) => (
    <Badge variant={ticket.waiting_on === 'admin' ? 'destructive' : ticket.waiting_on === 'requester' ? 'secondary' : 'outline'}>
      {waitingOnLabels[ticket.waiting_on]}
    </Badge>
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Access denied. Super admin only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-6 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
            <p className="text-muted-foreground">Manage support requests from all organizations</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.open}</p>
                  <p className="text-xs text-muted-foreground">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.needsReply}</p>
                  <p className="text-xs text-muted-foreground">Needs Reply</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOrganization} onValueChange={setFilterOrganization}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent_activity">Recent Activity</SelectItem>
              <SelectItem value="oldest_open">Stalest First</SelectItem>
              <SelectItem value="priority">Priority First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {(['all', 'unassigned', 'mine', 'needs_reply'] as QueueView[]).map(view => (
            <Button
              key={view}
              variant={queueView === view ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQueueView(view)}
            >
              {queueViewLabels[view]}
              {view === 'unassigned' && stats.unassigned > 0 ? ` (${stats.unassigned})` : ''}
              {view === 'needs_reply' && stats.needsReply > 0 ? ` (${stats.needsReply})` : ''}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Ticket List */}
        <div className={cn(
          "border-r border-border transition-all",
          selectedTicket ? "w-1/3 hidden md:block" : "w-full"
        )}>
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center">
                <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tickets found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTickets.map(ticket => {
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-accent/50 transition-colors",
                        selectedTicket?.id === ticket.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ticket.status)}
                          <span className="font-medium text-foreground line-clamp-1">
                            {ticket.subject}
                          </span>
                        </div>
                        <Badge variant={getPriorityColor(ticket.priority)} className="shrink-0 text-xs">
                          {ticket.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="truncate">{ticket.requester_name || ticket.requester_email || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{ticket.organization_name || 'Unknown Org'}</span>
                        <span className="ml-auto">{renderRelativeTime(ticket.last_message_at || ticket.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {renderWaitingBadge(ticket)}
                        {ticket.assigned_admin_name ? (
                          <Badge variant="outline">{ticket.assigned_admin_name}</Badge>
                        ) : (
                          <Badge variant="outline">Unassigned</Badge>
                        )}
                        {ticket.needs_admin_reply && ticket.status !== 'resolved' ? (
                          <Badge variant="destructive">Needs reply</Badge>
                        ) : null}
                      </div>
                      {ticket.last_message_preview ? (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{ticket.last_message_preview}</p>
                      ) : null}
                      <div className="text-[11px] text-muted-foreground mt-2">
                        Created {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Ticket Detail / Chat */}
        {selectedTicket && (
          <div className="flex-1 flex flex-col">
            {/* Ticket Header */}
            <div className="p-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="md:hidden -ml-2"
                      onClick={() => setSelectedTicket(null)}
                    >
                      ← Back
                    </Button>
                    {getStatusIcon(selectedTicket.status)}
                    <h2 className="font-semibold text-foreground truncate">{selectedTicket.subject}</h2>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>From: {selectedTicket.requester_name || selectedTicket.requester_email || 'Unknown'}</span>
                    <span>•</span>
                    <span>{selectedTicket.organization_name || 'Unknown Org'}</span>
                    <span>•</span>
                    <Badge variant={getPriorityColor(selectedTicket.priority)}>{selectedTicket.priority}</Badge>
                    {renderWaitingBadge(selectedTicket)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                    <span>Assigned to: {selectedTicket.assigned_admin_name || 'Unassigned'}</span>
                    <span>Last activity: {renderRelativeTime(selectedTicket.last_message_at || selectedTicket.updated_at || selectedTicket.created_at)}</span>
                    <span>Last sender: {selectedTicket.last_message_sender_name || 'No replies yet'}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {selectedTicket.status !== 'resolved' && selectedTicket.assigned_admin_id !== user?.id && (
                    <Button size="sm" onClick={() => handleAssignToMe(selectedTicket.id)}>
                      Assign to Me
                    </Button>
                  )}
                  {selectedTicket.status !== 'resolved' && (
                    <Button size="sm" variant="outline" onClick={() => handleResolve(selectedTicket.id)}>
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-xs mt-2">This ticket is {selectedTicket.waiting_on === 'admin' ? 'waiting for an admin reply.' : 'waiting for the requester.'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map(msg => {
                    const isOwnMessage = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3",
                          isOwnMessage && "flex-row-reverse"
                        )}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={msg.sender?.avatar_url || undefined} />
                          <AvatarFallback>
                            {msg.sender?.full_name?.[0] || msg.sender?.email?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "max-w-[70%]",
                          isOwnMessage && "text-right"
                        )}>
                          <div className="text-xs text-muted-foreground mb-1">
                            {msg.sender?.full_name || msg.sender?.email}
                            <span className="ml-2">{format(new Date(msg.created_at), 'h:mm a')}</span>
                          </div>
                          <div className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            isOwnMessage 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted text-foreground"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Reply Input */}
            {selectedTicket.status !== 'resolved' && selectedTicket.chat_id && (
              <div className="p-4 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="min-h-[60px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <Button 
                    onClick={handleSendReply} 
                    disabled={!replyMessage.trim() || sendMessage.isPending}
                    className="shrink-0"
                  >
                    Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
