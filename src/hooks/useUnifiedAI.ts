import { useState, useCallback, useEffect, useRef } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  response?: string;
  responded?: boolean;
  ai_agent_type?: 'jay' | 'may' | 'cece';
  ai_agent_name?: string;
  error?: string;
  conversationId?: string;
  // Jay-specific
  lead_temperature?: string;
  qualification_status?: string;
  // May-specific
  orderCreated?: { id: string; status: string };
  // Cece-specific
  booking?: unknown;
  availability?: unknown;
}

interface UseUnifiedAIOptions {
  leadId?: string;
  conversationId?: string;
  organizationId?: string;
  platform?: string;
  simulateTyping?: boolean;
  minTypingDelayMs?: number;
  maxTypingDelayMs?: number;
}

async function getFunctionInvokeErrorDetails(err: unknown): Promise<{ status?: number; message: string }> {
  // supabase-js wraps non-2xx responses in FunctionsHttpError
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    const status = err.context.status;
    try {
      const json = await err.context.clone().json().catch(() => null);
      const message = (json as unknown as { error?: string; message?: string } | null)?.error || (json as unknown as { error?: string; message?: string } | null)?.message || `Request failed (${status})`;
      return { status, message };
    } catch {
      const text = await err.context.clone().text().catch(() => '');
      return { status, message: text || `Request failed (${status})` };
    }
  }

  if (err instanceof FunctionsRelayError) {
    return { message: 'Service temporarily unavailable. Please try again.' };
  }

  if (err instanceof FunctionsFetchError) {
    return { message: 'Network error. Please check your connection and try again.' };
  }

  return { message: err instanceof Error ? err.message : 'Unknown error' };
}

export function useUnifiedAI(options: UseUnifiedAIOptions = {}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentAgent, setCurrentAgent] = useState<{
    type: 'jay' | 'may' | 'cece';
    name: string;
  } | null>(null);

  const messagesRef = useRef<Message[]>(messages);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const sendMessage = useCallback(async (message: string, imageUrls?: string[]): Promise<AIResponse | null> => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && (!imageUrls || imageUrls.length === 0)) return null;

    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: trimmedMessage };

    // Keep history bounded to avoid backend validation failures (max 100 messages)
    const nextMessages = [...messagesRef.current, userMessage];
    const historyForRequest = nextMessages.slice(-80);
    setMessages(nextMessages);
    messagesRef.current = nextMessages;

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: trimmedMessage,
          imageUrls,
          leadId: options.leadId,
          conversationId: activeConversationIdRef.current || options.conversationId,
          organizationId: options.organizationId,
          platform: options.platform || 'web',
          conversationHistory: historyForRequest,
        },
      });

      if (error) {
        const details = await getFunctionInvokeErrorDetails(error);
        devLog('AI Chat invoke error:', { status: details.status, message: details.message, raw: error });

        // Handle specific status codes when available
        if (details.status === 429 || details.message.includes('429')) {
          toast({
            title: 'Rate Limit',
            description: 'Too many requests. Please wait a moment and try again.',
            variant: 'destructive',
          });
        } else if (details.status === 402 || details.message.includes('402')) {
          toast({
            title: 'Credits Exhausted',
            description: 'AI credits have run out. Please add more credits to continue.',
            variant: 'destructive',
          });
        } else if (details.status === 401) {
          toast({
            title: 'Session expired',
            description: 'Please sign in again and retry.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'AI Chat Error',
            description: details.message || 'Failed to get AI response. Please try again.',
            variant: 'destructive',
          });
        }
        return null;
      }

      // Update current agent info and conversation ID
      if (data?.ai_agent_type) {
        setCurrentAgent({
          type: data.ai_agent_type,
          name: data.ai_agent_name || getAgentDisplayName(data.ai_agent_type),
        });
      }

      // Store conversation ID for message continuity
      if (data?.conversationId) {
        setActiveConversationId(data.conversationId);
        activeConversationIdRef.current = data.conversationId;
      }

      // Add AI response to messages
      const responseContent = data?.response || data?.error || '';
      if (responseContent) {
        const assistantMessage: Message = { role: 'assistant', content: responseContent };
        if (options.simulateTyping) {
          const minDelay = options.minTypingDelayMs ?? 700;
          const maxDelay = options.maxTypingDelayMs ?? 2000;
          const lengthBased = Math.min(maxDelay, Math.max(minDelay, responseContent.length * 15));
          const jitter = Math.floor(Math.random() * 200);
          const waitMs = Math.min(maxDelay, lengthBased + jitter);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        setMessages(prev => {
          const updated = [...prev, assistantMessage];
          messagesRef.current = updated;
          return updated;
        });
      }

      return data as AIResponse;
    } catch (err) {
      const details = await getFunctionInvokeErrorDetails(err);
      devLog('AI Chat exception:', details, err);
      toast({
        title: 'AI Chat Error',
        description: details.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    options.leadId,
    options.conversationId,
    options.organizationId,
    options.platform,
    options.simulateTyping,
    options.minTypingDelayMs,
    options.maxTypingDelayMs,
    toast,
  ]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
  }, []);

  const setInitialMessages = useCallback((initialMessages: Message[]) => {
    setMessages(initialMessages);
    messagesRef.current = initialMessages;
  }, []);

  return {
    messages,
    isLoading,
    currentAgent,
    conversationId: activeConversationId,
    sendMessage,
    clearMessages,
    setInitialMessages,
  };
}

function getAgentDisplayName(type: string): string {
  switch (type) {
    case 'jay':
      return 'Jay';
    case 'may':
      return 'May';
    case 'cece':
      return 'Cece';
    default:
      return 'AI Assistant';
  }
}

export function getAgentDescription(type: 'jay' | 'may' | 'cece'): string {
  switch (type) {
    case 'jay':
      return 'Sales assistant for lead qualification and nurturing';
    case 'may':
      return 'Food ordering assistant for restaurants and cafes';
    case 'cece':
      return 'Hotel concierge for bookings and reservations';
    default:
      return 'AI Assistant';
  }
}

export function getAgentIcon(type: 'jay' | 'may' | 'cece'): string {
  switch (type) {
    case 'jay':
      return '💼';
    case 'may':
      return '🍽️';
    case 'cece':
      return '🏨';
    default:
      return '🤖';
  }
}
