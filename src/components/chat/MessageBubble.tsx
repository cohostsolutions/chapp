import { memo, forwardRef } from 'react';
import { Bot, User, Phone, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChatMessageContent } from '@/components/communications/ChatMessageContent';
import { MessageStatus } from '@/components/communications/MessageStatus';
import { MessageReactions } from '@/components/communications/MessageReactions';
import type { MessageBubbleProps } from './types';

/**
 * MessageBubble - Pure presentation component for rendering chat messages
 * Follows atomic design pattern - smallest visual unit of chat
 */
export const MessageBubble = memo(forwardRef<HTMLDivElement, MessageBubbleProps>(({
  message,
  isHighlighted = false,
  onReaction,
  onRetry,
  reactions,
  currentUserId,
  channel,
  agentName = 'AI',
}, ref) => {
  const isAI = message.role === 'assistant';
  const isAgent = message.source === 'communications' && message.role === 'agent';
  const isCall = message.source === 'call';
  const isUser = message.role === 'user';
  // Show retry for any failed message
  const hasFailed = message.status === 'failed';

  // Special rendering for call messages
  if (isCall) {
    return (
      <div
        ref={ref}
        role="listitem"
        aria-label={`Call: ${message.content}`}
        className={cn(
          "flex justify-center transition-all duration-300",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full border border-border text-sm text-muted-foreground">
          <Phone className="w-4 h-4 text-green-500" aria-hidden="true" />
          <span>{message.content}</span>
          <span className="text-xs">• {message.timestamp}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="listitem"
      aria-label={`${isUser ? 'You' : isAI ? agentName : 'Agent'} said: ${message.content.slice(0, 100)}${message.content.length > 100 ? '...' : ''}`}
      className={cn(
        "flex gap-2 lg:gap-3 group transition-all duration-300",
        isUser ? "justify-end" : "justify-start",
        isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg"
      )}
    >
      {/* Avatar - Left side for non-user messages */}
      {!isUser && (
        <div 
          className={cn(
            "w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center shrink-0",
            isAI ? "bg-primary/20" : "bg-success/20"
          )}
          aria-hidden="true"
        >
          {isAI ? (
            <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary" />
          ) : (
            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-success" />
          )}
        </div>
      )}

      {/* Message content */}
      <div className="flex flex-col max-w-[85%] lg:max-w-[70%]">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 lg:px-4 lg:py-3 shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : isAgent
              ? "bg-emerald-500/15 text-foreground rounded-bl-md border border-emerald-500/30"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          <ChatMessageContent 
            content={message.content} 
            isUser={isUser} 
            metadata={message.metadata} 
          />
          
          {/* Footer with timestamp - shows on hover for cleaner look */}
          <div className={cn(
            "flex items-center justify-between gap-2 mt-1.5 pt-1.5 text-[10px] transition-opacity",
            isUser ? "border-t border-primary-foreground/10" : "border-t border-border/30"
          )}>
            <div className="flex items-center gap-1 min-w-0">
              {isAI && (
                <span className="font-medium text-primary shrink-0">({agentName})</span>
              )}
              {isAgent && (
                <span className="font-medium text-emerald-600 truncate max-w-[100px] lg:max-w-[160px]">
                  ({message.senderName || 'Agent'})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn(
                isUser ? "text-primary-foreground/60" : "text-muted-foreground"
              )}>
                {message.timestamp}
              </span>
              {!isUser && (
                <div className="flex items-center gap-1">
                  <MessageStatus status={message.status} />
                  {hasFailed && onRetry && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Retry sending message"
                      onClick={() => onRetry(message.id)}
                      aria-label="Retry sending this message"
                      className="h-5 w-5 hover:bg-destructive/10"
                    >
                      <RefreshCw className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reactions */}
        {onReaction && (
          <MessageReactions
            reactions={{ ...message.reactions, ...reactions }}
            onReact={(emoji) => onReaction(message.id, emoji, message.externalId)}
            currentUserId={currentUserId}
            compact
            channel={channel}
          />
        )}
      </div>

      {/* Avatar - Right side for user messages */}
      {isUser && (
        <div 
          className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-secondary flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-foreground" />
        </div>
      )}
    </div>
  );
}));

MessageBubble.displayName = 'MessageBubble';
