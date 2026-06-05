import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

interface MessageReactionsProps {
  reactions: Record<string, string[]>; // emoji -> array of user IDs
  onReact: (emoji: string) => void;
  currentUserId?: string;
  compact?: boolean;
  channel?: string; // Platform channel (messenger, whatsapp, instagram, etc.)
}

export function MessageReactions({ reactions, onReact, currentUserId, compact = false, channel }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReaction = (emoji: string) => {
    onReact(emoji);
    setShowPicker(false);
  };

  const reactionEntries = Object.entries(reactions).filter(([_, users]) => users.length > 0);

  // Meta doesn't support sending reactions from pages for Messenger/Instagram
  // Only WhatsApp supports sending reactions via API
  const canSendReactions = channel?.toLowerCase() === 'whatsapp';

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", compact ? "mt-1" : "mt-2")}>
      {/* Existing reactions */}
      {reactionEntries.map(([emoji, users]) => {
        const hasReacted = currentUserId && users.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => canSendReactions && handleReaction(emoji)}
            disabled={!canSendReactions}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors",
              hasReacted
                ? "bg-primary/20 border border-primary/40"
                : "bg-secondary/80 border border-transparent",
              canSendReactions && "hover:bg-secondary cursor-pointer",
              !canSendReactions && "cursor-default"
            )}
          >
            <span>{emoji}</span>
            <span className="text-muted-foreground">{users.length}</span>
          </button>
        );
      })}

      {/* Add reaction button - only show for WhatsApp */}
      {canSendReactions && (
        <Popover open={showPicker} onOpenChange={setShowPicker}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-secondary",
                compact ? "w-5 h-5" : "w-6 h-6"
              )}
            >
              <SmilePlus className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top" align="start">
            <div className="flex gap-1">
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
