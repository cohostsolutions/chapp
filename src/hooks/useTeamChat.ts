import { useState, useEffect, useCallback, useMemo } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TeamChat {
  id: string;
  organization_id: string;
  chat_type: 'direct' | 'group' | 'helpdesk';
  name: string | null;
  description: string | null;
  created_by: string;
  is_helpdesk_channel: boolean;
  created_at: string;
  updated_at: string;
  members?: TeamChatMember[];
  last_message?: TeamChatMessage;
  unread_count?: number;
}

export interface TeamChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'admin' | 'member';
  is_muted: boolean;
  last_read_at: string | null;
  joined_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface TeamChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'file' | 'image' | 'system';
  metadata: Record<string, unknown>;
  is_edited: boolean;
  edited_at: string | null;
  parent_message_id: string | null;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export function useTeamChats() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: chats = [], isLoading, refetch } = useQuery({
    queryKey: ['team-chats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all chats user is a member of
      const { data: memberChats, error: memberError } = await supabase
        .from('team_chat_members')
        .select(`
          chat_id,
          role,
          is_muted,
          last_read_at,
          team_chats:chat_id (
            id,
            organization_id,
            chat_type,
            name,
            description,
            created_by,
            is_helpdesk_channel,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // Get all chat members for each chat
      const chatIds = memberChats?.map(mc => mc.chat_id) || [];
      if (chatIds.length === 0) return [];

      const { data: allMembers, error: membersError } = await supabase
        .from('team_chat_members')
        .select(`
          id,
          chat_id,
          user_id,
          role,
          is_muted,
          last_read_at,
          joined_at
        `)
        .in('chat_id', chatIds);

      if (membersError) throw membersError;

      // Get member profiles
      const memberUserIds = [...new Set(allMembers?.map(m => m.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', memberUserIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get last message for each chat
      const { data: lastMessages, error: messagesError } = await supabase
        .from('team_chat_messages')
        .select('*')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Get unread counts
      const lastMessageMap = new Map<string, TeamChatMessage>();
      const unreadCounts = new Map<string, number>();
      
      chatIds.forEach(chatId => {
        const chatMessages = lastMessages?.filter(m => m.chat_id === chatId) || [];
        if (chatMessages.length > 0) {
          lastMessageMap.set(chatId, chatMessages[0] as TeamChatMessage);
        }
        
        const memberInfo = memberChats?.find(mc => mc.chat_id === chatId);
        const lastRead = memberInfo?.last_read_at;
        const unread = chatMessages.filter(m => 
          m.sender_id !== user.id && 
          (!lastRead || new Date(m.created_at) > new Date(lastRead))
        ).length;
        unreadCounts.set(chatId, unread);
      });

      // Build chat objects
      return memberChats
        ?.map(mc => {
          const chat = mc.team_chats as unknown as TeamChat;
          if (!chat) return null;
          
          const members = allMembers
            ?.filter(m => m.chat_id === chat.id)
            .map(m => ({
              ...m,
              role: m.role as 'admin' | 'member',
              profile: profileMap.get(m.user_id)
            })) || [];

          // For direct chats, set name to other user's name
          let chatName = chat.name;
          if (chat.chat_type === 'direct' && !chatName) {
            const otherMember = members.find(m => m.user_id !== user.id);
            chatName = otherMember?.profile?.full_name || otherMember?.profile?.email || 'Unknown';
          }

          return {
            ...chat,
            name: chatName,
            members,
            last_message: lastMessageMap.get(chat.id),
            unread_count: unreadCounts.get(chat.id) || 0
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = a?.last_message?.created_at || a?.created_at || '';
          const bTime = b?.last_message?.created_at || b?.created_at || '';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }) as TeamChat[];
    },
    enabled: !!user,
    staleTime: 30000
  });

  // Create group chat
  const createGroupChat = useMutation({
    mutationFn: async ({ name, description, memberIds }: { name: string; description?: string; memberIds: string[] }) => {
      if (!user || !profile?.organization_id) throw new Error('Not authenticated');

      const { data: chat, error: chatError } = await supabase
        .from('team_chats')
        .insert({
          organization_id: profile.organization_id,
          chat_type: 'group',
          name,
          description,
          created_by: user.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add creator as admin and avoid duplicate membership rows.
      const uniqueMemberIds = [...new Set(memberIds.filter((memberId) => memberId !== user.id))];
      const members = [
        { chat_id: chat.id, user_id: user.id, role: 'admin' },
        ...uniqueMemberIds.map(id => ({ chat_id: chat.id, user_id: id, role: 'member' }))
      ];

      const { error: membersError } = await supabase
        .from('team_chat_members')
        .insert(members);

      if (membersError) throw membersError;

      return chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-chats'] });
      toast({ title: 'Group created', description: 'Your group chat has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Create direct chat
  const createDirectChat = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user || !profile?.organization_id) throw new Error('Not authenticated');

      // Check if direct chat already exists
      const { data: existingChats } = await supabase
        .from('team_chat_members')
        .select('chat_id, team_chats!inner(chat_type)')
        .eq('user_id', user.id);

      for (const ec of existingChats || []) {
        const { data: otherMember } = await supabase
          .from('team_chat_members')
          .select('user_id')
          .eq('chat_id', ec.chat_id)
          .eq('user_id', otherUserId)
          .single();

        if (otherMember && (ec.team_chats as unknown as { chat_type?: string })?.chat_type === 'direct') {
          // Return existing chat
          const { data: existingChat } = await supabase
            .from('team_chats')
            .select('*')
            .eq('id', ec.chat_id)
            .single();
          return existingChat;
        }
      }

      const { data: chat, error: chatError } = await supabase
        .from('team_chats')
        .insert({
          organization_id: profile.organization_id,
          chat_type: 'direct',
          created_by: user.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      const { error: membersError } = await supabase
        .from('team_chat_members')
        .insert([
          { chat_id: chat.id, user_id: user.id, role: 'member' },
          { chat_id: chat.id, user_id: otherUserId, role: 'member' }
        ]);

      if (membersError) throw membersError;

      return chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-chats'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Total unread count
  const totalUnread = useMemo(() => 
    chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0),
    [chats]
  );

  return {
    chats,
    isLoading,
    refetch,
    createGroupChat,
    createDirectChat,
    totalUnread
  };
}

export function useTeamChatMessages(chatId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['team-chat-messages', chatId],
    queryFn: async () => {
      if (!chatId) return [];

      const { data, error } = await supabase
        .from('team_chat_messages')
        .select(`
          *,
          team_chat_reactions (*)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data?.map(m => ({
        ...m,
        message_type: m.message_type as 'text' | 'file' | 'image' | 'system',
        sender: profileMap.get(m.sender_id),
        reactions: m.team_chat_reactions || []
      })) as TeamChatMessage[];
    },
    enabled: !!chatId,
    staleTime: 10000
  });

  // Real-time subscription
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`team-chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_chat_messages',
          filter: `chat_id=eq.${chatId}`
        },
        () => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['team-chats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, refetch, queryClient]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, messageType = 'text', metadata = {}, parentMessageId }: { 
      content: string; 
      messageType?: 'text' | 'file' | 'image'; 
      metadata?: Record<string, unknown>;
      parentMessageId?: string | null;
    }) => {
      if (!chatId || !user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_chat_messages')
        .insert([{
          chat_id: chatId,
          sender_id: user.id,
          content,
          message_type: messageType,
          metadata: metadata as Json | null,
          parent_message_id: parentMessageId ?? null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['support-tickets-snapshot'] });
      // Update last_read_at
      if (chatId && user) {
        const { error } = await supabase
          .from('team_chat_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('chat_id', chatId)
          .eq('user_id', user.id);

        if (error) {
          devError('Failed to update chat read timestamp after sending message:', error);
        }
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Add reaction
  const addReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('team_chat_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        });

      if (error) throw error;
    },
    onSuccess: () => refetch()
  });

  // Remove reaction
  const removeReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('team_chat_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

      if (error) throw error;
    },
    onSuccess: () => refetch()
  });

  // Mark as read
  const markAsRead = useCallback(async () => {
    if (!chatId || !user) return;

    await supabase
      .from('team_chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', user.id);

    queryClient.invalidateQueries({ queryKey: ['team-chats'] });
  }, [chatId, user, queryClient]);

  return {
    messages,
    isLoading,
    sendMessage,
    addReaction,
    removeReaction,
    markAsRead,
    refetch
  };
}

export function useHelpdeskTickets(options?: { loadTickets?: boolean }) {
  const { user, profile, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const loadTickets = options?.loadTickets ?? true;

  const rollbackChatCreation = async (chatId: string) => {
    const { error } = await supabase
      .from('team_chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      throw new Error(`Failed to roll back helpdesk chat creation: ${error.message}`);
    }
  };

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['helpdesk-tickets', user?.id, isSuperAdmin],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('helpdesk_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq('requester_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user && loadTickets
  });

  // Create helpdesk ticket
  const createTicket = useMutation({
    mutationFn: async ({ subject, priority = 'normal' }: { subject: string; priority?: string }) => {
      if (!user || !profile?.organization_id) throw new Error('Not authenticated');

      // Create a helpdesk chat
      const { data: chat, error: chatError } = await supabase
        .from('team_chats')
        .insert({
          organization_id: profile.organization_id,
          chat_type: 'helpdesk',
          name: subject,
          created_by: user.id,
          is_helpdesk_channel: true
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add requester as member
      const { error: memberError } = await supabase
        .from('team_chat_members')
        .insert([{ chat_id: chat.id, user_id: user.id, role: 'member' }]);

      if (memberError) {
        try {
          await rollbackChatCreation(chat.id);
        } catch (rollbackError) {
          throw new Error(`${memberError.message}. ${rollbackError instanceof Error ? rollbackError.message : 'Rollback failed.'}`);
        }
        throw memberError;
      }

      // Create the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('helpdesk_tickets')
        .insert({
          organization_id: profile.organization_id,
          requester_id: user.id,
          subject,
          priority,
          chat_id: chat.id
        })
        .select()
        .single();

      if (ticketError) {
        try {
          await rollbackChatCreation(chat.id);
        } catch (rollbackError) {
          throw new Error(`${ticketError.message}. ${rollbackError instanceof Error ? rollbackError.message : 'Rollback failed.'}`);
        }
        throw ticketError;
      }

      return { ticket, chat };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['team-chats'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-snapshot'] });
      toast({ title: 'Ticket created', description: 'Your support request has been submitted.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Assign ticket (super admin only)
  const assignTicket = useMutation({
    mutationFn: async ({ ticketId, adminId }: { ticketId: string; adminId: string }) => {
      const { data: existingTicket, error: existingTicketError } = await supabase
        .from('helpdesk_tickets')
        .select('id, chat_id, assigned_admin_id, assigned_at, assigned_by_admin_id, status')
        .eq('id', ticketId)
        .single();

      if (existingTicketError) throw existingTicketError;

      const assignedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from('helpdesk_tickets')
        .update({
          assigned_admin_id: adminId,
          assigned_at: assignedAt,
          assigned_by_admin_id: user?.id ?? null,
          status: 'in_progress'
        })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) throw error;

      // Add admin to chat
      const ticket = data;
      if (ticket.chat_id) {
        const { error: memberError } = await supabase
          .from('team_chat_members')
          .upsert({ chat_id: ticket.chat_id, user_id: adminId, role: 'admin' }, { onConflict: 'chat_id,user_id' });

        if (memberError) {
          const { error: rollbackError } = await supabase
            .from('helpdesk_tickets')
            .update({
              assigned_admin_id: existingTicket.assigned_admin_id,
              assigned_at: existingTicket.assigned_at,
              assigned_by_admin_id: existingTicket.assigned_by_admin_id,
              status: existingTicket.status,
            })
            .eq('id', ticketId);

          if (rollbackError) {
            throw new Error(`${memberError.message}. Failed to roll back assignment: ${rollbackError.message}`);
          }

          throw memberError;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-snapshot'] });
      toast({ title: 'Ticket assigned' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Resolve ticket
  const resolveTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('helpdesk_tickets')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by_admin_id: user.id,
        })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-snapshot'] });
      toast({ title: 'Ticket resolved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return {
    tickets,
    isLoading,
    createTicket,
    assignTicket,
    resolveTicket,
    refetch
  };
}
