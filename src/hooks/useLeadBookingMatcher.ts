import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { useState, useCallback } from 'react';

export interface PotentialMatch {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  conversation: {
    id: string;
    platform: string;
    started_at: string;
    updated_at: string;
  };
  matchScore: number;
  matchReasons: string[];
}

export interface BookingForMatching {
  id: string;
  check_in: string;
  check_out: string;
  room_unit_id: string;
  room_name: string;
  lead_id: string;
  lead_name: string;
  status: string;
}

// Find potential conversation leads that could match a booking
export function usePotentialMatches(booking: BookingForMatching | null) {
  return useQuery({
    queryKey: ['potential-matches', booking?.id],
    queryFn: async (): Promise<PotentialMatch[]> => {
      if (!booking) return [];

      // Get conversations with leads that have messages around the booking dates
      // We're looking for leads that are NOT already linked to a booking
      const checkInDate = parseISO(booking.check_in);
      const searchStart = subDays(checkInDate, 14); // 2 weeks before check-in
      const searchEnd = addDays(checkInDate, 3); // 3 days after check-in

      // Get conversations with their messages
      const { data: conversations, error } = await supabase
        .from('ai_conversations')
        .select(`
          id,
          platform,
          started_at,
          updated_at,
          lead_id,
          lead:leads!inner(id, name, email, phone)
        `)
        .gte('started_at', searchStart.toISOString())
        .lte('started_at', searchEnd.toISOString())
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get messages for these conversations to analyze for check-in keywords
      const conversationIds = conversations?.map(c => c.id) || [];
      
      let messagesData: {
        lead_id: string | null;
        content: string | null;
        metadata: Record<string, unknown> | null;
      }[] = [];
      const convLeadIds = conversations?.map(c => c.lead_id).filter(Boolean) as string[];
      if (convLeadIds.length > 0) {
        const { data: messages } = await supabase
          .from('communications')
          .select('lead_id, content, metadata')
          .in('lead_id', convLeadIds);
        messagesData = messages || [];
      }

      // Prefer exact conversation_id grouping when the channel persists it on communication metadata.
      // Fall back to lead-level grouping for channels that only store lead_id.
      const messagesByConversation: Record<string, string[]> = {};
      const messagesByLead: Record<string, string[]> = {};
      for (const message of messagesData) {
        const normalizedContent = (message.content || '').toLowerCase();
        const conversationId = typeof message.metadata?.conversation_id === 'string'
          ? message.metadata.conversation_id
          : null;

        if (conversationId) {
          if (!messagesByConversation[conversationId]) {
            messagesByConversation[conversationId] = [];
          }
          messagesByConversation[conversationId].push(normalizedContent);
        }

        if (!message.lead_id) continue;
        if (!messagesByLead[message.lead_id]) {
          messagesByLead[message.lead_id] = [];
        }
        messagesByLead[message.lead_id].push(normalizedContent);
      }

      // Score each conversation
      const potentialMatches: PotentialMatch[] = [];

      for (const conv of conversations || []) {
        const lead = conv.lead as { id: string; name: string; email: string | null; phone: string | null };
        if (!lead || lead.id === booking.lead_id) continue;

        const messages = messagesByConversation[conv.id] || messagesByLead[lead.id] || [];
        const allContent = messages.join(' ');
        
        let score = 0;
        const reasons: string[] = [];

        // Check for room name mentions
        const roomNameLower = booking.room_name.toLowerCase();
        if (allContent.includes(roomNameLower)) {
          score += 30;
          reasons.push(`Mentions "${booking.room_name}"`);
        }

        // Check for date mentions
        const checkInFormatted = format(checkInDate, 'MMMM d').toLowerCase();
        const checkInShort = format(checkInDate, 'MMM d').toLowerCase();
        if (allContent.includes(checkInFormatted) || allContent.includes(checkInShort)) {
          score += 25;
          reasons.push('Mentions check-in date');
        }

        // Check for check-in related keywords
        const checkInKeywords = ['check in', 'checkin', 'check-in', 'arrival', 'arriving', 'book', 'booking', 'reservation', 'reserve'];
        for (const keyword of checkInKeywords) {
          if (allContent.includes(keyword)) {
            score += 10;
            reasons.push('Contains booking-related keywords');
            break;
          }
        }

        // Conversation timing - closer to check-in is better
        const convDate = new Date(conv.started_at);
        const daysBeforeCheckIn = Math.abs((checkInDate.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysBeforeCheckIn <= 3) {
          score += 20;
          reasons.push('Conversation near check-in date');
        } else if (daysBeforeCheckIn <= 7) {
          score += 10;
          reasons.push('Conversation within a week of check-in');
        }

        // Platform preference (Facebook Messenger is common)
        if (conv.platform === 'facebook' || conv.platform === 'whatsapp') {
          score += 5;
        }

        if (score > 0) {
          potentialMatches.push({
            lead,
            conversation: {
              id: conv.id,
              platform: conv.platform,
              started_at: conv.started_at,
              updated_at: conv.updated_at,
            },
            matchScore: score,
            matchReasons: [...new Set(reasons)], // Remove duplicates
          });
        }
      }

      // Sort by score descending
      potentialMatches.sort((a, b) => b.matchScore - a.matchScore);

      return potentialMatches.slice(0, 10); // Return top 10 matches
    },
    enabled: !!booking,
    staleTime: 30000,
  });
}

// Search all conversations regardless of date
export function useSearchConversations(organizationId?: string) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PotentialMatch[]>([]);

  const search = useCallback(async (query: string): Promise<PotentialMatch[]> => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);
    try {
      // Search conversations by lead name, email, phone
      const { data: conversations, error } = await supabase
        .from('ai_conversations')
        .select(`
          id,
          platform,
          started_at,
          updated_at,
          lead_id,
          lead:leads!inner(id, name, email, phone)
        `)
        .or(`lead.name.ilike.%${query}%,lead.email.ilike.%${query}%,lead.phone.ilike.%${query}%`, { foreignTable: 'leads' })
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        // Fallback: search leads directly then get their conversations
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, name, email, phone')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(20);

        if (leadsError) throw leadsError;

        const leadIds = leads?.map(l => l.id) || [];
        if (leadIds.length === 0) {
          setSearchResults([]);
          return [];
        }

        const { data: convs } = await supabase
          .from('ai_conversations')
          .select('id, platform, started_at, updated_at, lead_id')
          .in('lead_id', leadIds)
          .order('updated_at', { ascending: false });

        const results: PotentialMatch[] = (convs || []).map(conv => {
          const lead = leads?.find(l => l.id === conv.lead_id);
          return {
            lead: lead || { id: '', name: 'Unknown', email: null, phone: null },
            conversation: {
              id: conv.id,
              platform: conv.platform,
              started_at: conv.started_at,
              updated_at: conv.updated_at,
            },
            matchScore: 0, // No scoring for search results
            matchReasons: ['Search result'],
          };
        });

        setSearchResults(results);
        return results;
      }

      const results: PotentialMatch[] = (conversations || []).map(conv => {
        const lead = conv.lead as { id: string; name: string; email: string | null; phone: string | null };
        return {
          lead,
          conversation: {
            id: conv.id,
            platform: conv.platform,
            started_at: conv.started_at,
            updated_at: conv.updated_at,
          },
          matchScore: 0,
          matchReasons: ['Search result'],
        };
      });

      setSearchResults(results);
      return results;
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  return { search, searchResults, isSearching, clearSearch };
}

// Find potential bookings that could match a conversation lead
export function usePotentialBookings(leadId: string | null, conversationDate: string | null) {
  return useQuery({
    queryKey: ['potential-bookings', leadId, conversationDate],
    queryFn: async (): Promise<(BookingForMatching & { matchScore: number; matchReasons: string[] })[]> => {
      if (!leadId || !conversationDate) return [];

      const convDate = parseISO(conversationDate);
      const searchStart = subDays(convDate, 3);
      const searchEnd = addDays(convDate, 30); // Look up to 30 days ahead

      // Get bookings with placeholder leads (calendar-synced ones typically have generic names)
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          room_unit_id,
          lead_id,
          status,
          lead:leads!inner(id, name),
          room:room_units!inner(id, name)
        `)
        .gte('check_in', searchStart.toISOString().split('T')[0])
        .lte('check_in', searchEnd.toISOString().split('T')[0])
        .in('status', ['pending', 'confirmed', 'upcoming', 'checked_in']);

      if (error) throw error;

      // Get messages for this lead's conversation to match with bookings
      const { data: conversations } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('lead_id', leadId);

      const convIds = conversations?.map(c => c.id) || [];
      
      let messagesData: { content: string }[] = [];
      if (leadId) {
        const { data: messages } = await supabase
          .from('communications')
          .select('content')
          .eq('lead_id', leadId);
        messagesData = messages || [];
      }

      const allContent = messagesData.map(m => m.content.toLowerCase()).join(' ');

      // Score bookings
      const scoredBookings = (bookings || []).map(booking => {
        const lead = booking.lead as { id: string; name: string };
        const room = booking.room as { id: string; name: string };
        
        let score = 0;
        const reasons: string[] = [];

        // Placeholder lead detection (likely from calendar sync)
        const placeholderNames = ['booked', 'blocked', 'reserved', 'guest', 'airbnb', 'booking.com'];
        if (placeholderNames.some(p => lead.name.toLowerCase().includes(p))) {
          score += 15;
          reasons.push('Placeholder booking (likely from calendar sync)');
        }

        // Check if room name mentioned in conversation
        if (allContent.includes(room.name.toLowerCase())) {
          score += 30;
          reasons.push(`Room "${room.name}" mentioned in conversation`);
        }

        // Check if dates mentioned
        const checkInDate = parseISO(booking.check_in);
        const checkInFormatted = format(checkInDate, 'MMMM d').toLowerCase();
        const checkInShort = format(checkInDate, 'MMM d').toLowerCase();
        if (allContent.includes(checkInFormatted) || allContent.includes(checkInShort)) {
          score += 25;
          reasons.push('Check-in date mentioned in conversation');
        }

        // Timing match - conversation should be before or around check-in
        const daysToCheckIn = (checkInDate.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysToCheckIn >= 0 && daysToCheckIn <= 14) {
          score += 20;
          reasons.push('Timing matches (conversation before check-in)');
        }

        return {
          id: booking.id,
          check_in: booking.check_in,
          check_out: booking.check_out,
          room_unit_id: booking.room_unit_id,
          room_name: room.name,
          lead_id: lead.id,
          lead_name: lead.name,
          status: booking.status,
          matchScore: score,
          matchReasons: reasons,
        };
      });

      // Sort by score and filter out zero scores
      return scoredBookings
        .filter(b => b.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
    },
    enabled: !!leadId && !!conversationDate,
    staleTime: 30000,
  });
}

// Search all bookings regardless of date
export function useSearchBookings() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<(BookingForMatching & { matchScore: number; matchReasons: string[] })[]>([]);

  const search = useCallback(async (query: string): Promise<(BookingForMatching & { matchScore: number; matchReasons: string[] })[]> => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);
    try {
      // Search bookings by room name, lead name, or dates
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          room_unit_id,
          lead_id,
          status,
          lead:leads!inner(id, name),
          room:room_units!inner(id, name)
        `)
        .or(`lead.name.ilike.%${query}%`, { foreignTable: 'leads' })
        .order('check_in', { ascending: false })
        .limit(20);

      if (error) {
        // Fallback: search by room name
        const { data: rooms } = await supabase
          .from('room_units')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .limit(10);

        const roomIds = rooms?.map(r => r.id) || [];
        
        // Also search leads
        const { data: leads } = await supabase
          .from('leads')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .limit(20);

        const leadIds = leads?.map(l => l.id) || [];

        if (roomIds.length === 0 && leadIds.length === 0) {
          setSearchResults([]);
          return [];
        }

        const orConditions = [];
        if (roomIds.length > 0) orConditions.push(`room_unit_id.in.(${roomIds.join(',')})`);
        if (leadIds.length > 0) orConditions.push(`lead_id.in.(${leadIds.join(',')})`);

        const { data: fallbackBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            check_in,
            check_out,
            room_unit_id,
            lead_id,
            status,
            lead:leads(id, name),
            room:room_units(id, name)
          `)
          .or(orConditions.join(','))
          .order('check_in', { ascending: false })
          .limit(20);

        const results = (fallbackBookings || []).map(booking => {
          const lead = booking.lead as { id: string; name: string } | null;
          const room = booking.room as { id: string; name: string } | null;
          return {
            id: booking.id,
            check_in: booking.check_in,
            check_out: booking.check_out,
            room_unit_id: booking.room_unit_id,
            room_name: room?.name || 'Unknown',
            lead_id: lead?.id || '',
            lead_name: lead?.name || 'Unknown',
            status: booking.status,
            matchScore: 0,
            matchReasons: ['Search result'],
          };
        });

        setSearchResults(results);
        return results;
      }

      const results = (bookings || []).map(booking => {
        const lead = booking.lead as { id: string; name: string };
        const room = booking.room as { id: string; name: string };
        return {
          id: booking.id,
          check_in: booking.check_in,
          check_out: booking.check_out,
          room_unit_id: booking.room_unit_id,
          room_name: room.name,
          lead_id: lead.id,
          lead_name: lead.name,
          status: booking.status,
          matchScore: 0,
          matchReasons: ['Search result'],
        };
      });

      setSearchResults(results);
      return results;
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  return { search, searchResults, isSearching, clearSearch };
}

// Merge lead data from conversation lead to booking lead and update booking
export function useMergeLeadToBooking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      sourceLeadId,
      targetLeadId,
    }: {
      bookingId: string;
      sourceLeadId: string;
      targetLeadId: string;
    }) => {
      if (sourceLeadId === targetLeadId) {
        return { bookingId, mergedLeadId: sourceLeadId };
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, lead_id')
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;
      if (!booking) {
        throw new Error('Booking not found');
      }

      const { error: updateBookingError } = await supabase
        .from('bookings')
        .update({ lead_id: sourceLeadId })
        .eq('id', bookingId);

      if (updateBookingError) throw updateBookingError;

      return { bookingId, mergedLeadId: sourceLeadId };
    },
    onSuccess: () => {
      toast({
        title: 'Booking Linked Successfully',
        description: 'The booking is now linked to the selected guest conversation record',
      });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      queryClient.invalidateQueries({ queryKey: ['potential-bookings'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Linking Booking',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
