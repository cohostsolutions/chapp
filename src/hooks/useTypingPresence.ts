import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  id: string;
  name: string;
  isTyping: boolean;
}

export function useTypingPresence(conversationId: string | null, userId: string | null, userName: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ isTyping: boolean; name: string }>();
        const users: TypingUser[] = [];
        
        Object.entries(state).forEach(([id, presences]) => {
          if (id !== userId && presences[0]?.isTyping) {
            users.push({
              id,
              name: presences[0].name || 'Someone',
              isTyping: true,
            });
          }
        });
        
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ isTyping: false, name: userName || 'Agent' });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, userId, userName]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !userName) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    channelRef.current.track({ isTyping, name: userName });

    // Auto-stop typing after 3 seconds of no input
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.track({ isTyping: false, name: userName });
      }, 3000);
    }
  }, [userName]);

  return { typingUsers, setTyping };
}
