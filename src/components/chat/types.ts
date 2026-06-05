// Chat component types for the refactored architecture
import type { ChatMessage as BaseChatMessage } from '@/hooks/useChatConversations';

export interface MessageBubbleProps {
  message: BaseChatMessage;
  isHighlighted?: boolean;
  onReaction?: (messageId: string, emoji: string, externalId?: string) => void;
  onRetry?: (messageId: string) => void;
  reactions?: Record<string, string[]>;
  currentUserId?: string;
  channel?: string;
  agentName?: string;
}

// Re-export for convenience
export type { BaseChatMessage as ChatMessage };
