import { useState } from 'react';
import { devError } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare, X, Send, Users, HelpCircle, Plus, ChevronLeft, Ticket, AlertCircle, Clock, CheckCircle, Building2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTeamChats, useTeamChatMessages, useHelpdeskTickets } from '@/hooks/useTeamChat';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface HelpdeskTicket {
  id: string;
  organization_id: string;
  requester_id: string;
  subject: string;
  priority: string;
  status: string;
  chat_id: string | null;
  assigned_admin_id: string | null;
  created_at: string;
}

export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<HelpdeskTicket | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  
  const { chats, totalUnread, isLoading } = useTeamChats();
  const { messages, sendMessage } = useTeamChatMessages(isSuperAdmin ? selectedTicket?.chat_id || null : selectedChatId);
  const { tickets, assignTicket, resolveTicket } = useHelpdeskTickets();
  
  const selectedChat = chats.find(c => c.id === selectedChatId);
  
  // Count open tickets for super admin badge
  const openTicketsCount = (tickets as HelpdeskTicket[]).filter(t => t.status === 'open' || t.status === 'in_progress').length;

  // Fetch organizations for ticket display
  const { data: organizations = [] } = useQuery({
    queryKey: ['orgs-for-tickets-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name');
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin && isOpen
  });

  // Fetch profiles for requester info
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-tickets-widget', tickets],
    queryFn: async () => {
      const requesterIds = [...new Set((tickets as HelpdeskTicket[]).map(t => t.requester_id))];
      if (requesterIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url');
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin && tickets.length > 0 && isOpen
  });

  const orgMap = new Map(organizations.map(o => [o.id, o.name]));
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    // For super admin, use ticket chat; for others, use selected chat
    if (isSuperAdmin && selectedTicket?.chat_id) {
      try {
        await sendMessage.mutateAsync({
          content: messageInput.trim(),
          messageType: 'text'
        });
        setMessageInput('');
      } catch (error) {
        devError('Failed to send message:', error);
      }
    } else if (selectedChatId) {
      try {
        await sendMessage.mutateAsync({
          content: messageInput.trim(),
          messageType: 'text'
        });
        setMessageInput('');
      } catch (error) {
        devError('Failed to send message:', error);
      }
    }
  };

  const getChatIcon = (chatType: string) => {
    switch (chatType) {
      case 'helpdesk':
        return <HelpCircle className="w-4 h-4" />;
      case 'group':
        return <Users className="w-4 h-4" />;
      default:
        return <MessagesSquare className="w-4 h-4" />;
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const handleAssignToMe = async (ticketId: string) => {
    if (!user) return;
    await assignTicket.mutateAsync({ ticketId, adminId: user.id });
  };

  const handleResolve = async (ticketId: string) => {
    await resolveTicket.mutateAsync(ticketId);
    setSelectedTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
  };

  // Super Admin: Show support tickets panel
  if (isSuperAdmin) {
    return (
      <>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-6 z-50 hidden xl:block"
        >
          <Button
            onClick={() => setIsOpen(!isOpen)}
            size="lg"
            className={cn(
              "rounded-full w-14 h-14 shadow-lg relative",
              isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
            title="Support Tickets"
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <>
                <Ticket className="w-6 h-6" />
                {openTicketsCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
                  >
                    {openTicketsCount > 9 ? '9+' : openTicketsCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </motion.div>

        {/* Support Tickets Panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-24 right-6 z-50 hidden xl:flex w-96 h-[550px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-border bg-muted/50 flex items-center gap-3">
                {selectedTicket && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="shrink-0"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {selectedTicket ? selectedTicket.subject : 'Support Tickets'}
                  </h3>
                  {selectedTicket && (
                    <p className="text-xs text-muted-foreground">
                      {orgMap.get(selectedTicket.organization_id) || 'Unknown Org'}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/support-tickets')}
                  title="Open full view"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              {!selectedTicket ? (
                // Ticket List
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {(tickets as HelpdeskTicket[]).length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Ticket className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No support tickets</p>
                      </div>
                    ) : (
                      (tickets as HelpdeskTicket[]).slice(0, 20).map(ticket => {
                        const requester = profileMap.get(ticket.requester_id);
                        return (
                          <button
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket)}
                            className="w-full flex flex-col gap-1 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              {getStatusIcon(ticket.status)}
                              <span className="font-medium text-sm text-foreground truncate flex-1">
                                {ticket.subject}
                              </span>
                              <Badge variant={getPriorityColor(ticket.priority) as unknown as React.ComponentProps<typeof Badge>['variant']} className="text-xs shrink-0">
                                {ticket.priority}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                              <span className="truncate">{requester?.full_name || requester?.email || 'Unknown'}</span>
                              <span>•</span>
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{orgMap.get(ticket.organization_id) || 'Unknown'}</span>
                            </div>
                            <div className="text-xs text-muted-foreground pl-6">
                              {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              ) : (
                // Ticket Detail / Chat
                <>
                  {/* Ticket Actions */}
                  <div className="p-3 border-b border-border flex gap-2">
                    {selectedTicket.status === 'open' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleAssignToMe(selectedTicket.id)}
                      >
                        Assign to Me
                      </Button>
                    )}
                    {selectedTicket.status !== 'resolved' && (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="flex-1"
                        onClick={() => handleResolve(selectedTicket.id)}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <MessagesSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map(msg => {
                          const isOwnMessage = msg.sender_id === user?.id;
                          return (
                            <div
                              key={msg.id}
                              className={cn(
                                "flex flex-col max-w-[85%]",
                                isOwnMessage ? "ml-auto items-end" : "items-start"
                              )}
                            >
                              <div className="text-xs text-muted-foreground mb-1">
                                {msg.sender?.full_name || msg.sender?.email || 'Unknown'}
                              </div>
                              <div
                                className={cn(
                                  "px-3 py-2 rounded-lg text-sm",
                                  isOwnMessage
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground"
                                )}
                              >
                                {msg.content}
                              </div>
                              <span className="text-xs text-muted-foreground mt-1">
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Reply Input */}
                  {selectedTicket.status !== 'resolved' && selectedTicket.chat_id && (
                    <div className="p-3 border-t border-border">
                      <form 
                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                        className="flex gap-2"
                      >
                        <Input
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder="Type a reply..."
                          className="flex-1"
                          disabled={sendMessage.isPending}
                        />
                        <Button 
                          type="submit" 
                          size="icon" 
                          disabled={!messageInput.trim() || sendMessage.isPending}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Regular users: Show team chat widget
  return (
    <>
      {/* Floating Button - only visible on xl+ screens (desktop) where bottom nav is hidden */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50 hidden xl:block"
      >
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className={cn(
            "rounded-full w-14 h-14 shadow-lg relative",
            isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
          )}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <>
              <MessagesSquare className="w-6 h-6" />
              {totalUnread > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </Badge>
              )}
            </>
          )}
        </Button>
      </motion.div>

      {/* Chat Panel - only on desktop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 hidden xl:flex w-80 sm:w-96 h-[500px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-border bg-muted/50 flex items-center gap-3">
              {selectedChatId && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => setSelectedChatId(null)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {selectedChat ? (selectedChat.name || 'Direct Message') : 'Team Chat'}
                </h3>
                {selectedChat && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedChat.chat_type}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = '/team-chat'}
                title="Open full chat"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            {!selectedChatId ? (
              // Chat List
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {isLoading ? (
                    <div className="p-4 text-center text-muted-foreground">Loading...</div>
                  ) : chats.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No conversations yet
                    </div>
                  ) : (
                    chats.map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedChatId(chat.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {getChatIcon(chat.chat_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {chat.name || 'Direct Message'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {chat.chat_type}
                          </p>
                        </div>
                        {(chat.unread_count || 0) > 0 && (
                          <Badge variant="default" className="shrink-0">
                            {chat.unread_count}
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            ) : (
              // Messages View
              <>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[85%]",
                          msg.sender_id === user?.id ? "ml-auto items-end" : "items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm",
                            msg.sender_id === user?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-border">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex gap-2"
                  >
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={sendMessage.isPending}
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={!messageInput.trim() || sendMessage.isPending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
