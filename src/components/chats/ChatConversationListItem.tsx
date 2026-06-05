import { lazy, Suspense } from 'react';
import { Archive, BedDouble, Bot, Facebook, Instagram, Mail, MessageCircle, MessageSquare, Phone, Pin, Undo2, User, UserCheck, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getTemperatureDisplay } from '@/lib/chatConfig';
import { isArchivedConversationResurfaced } from '@/lib/chatConversationSummary';
import type { ChatConversation } from '@/hooks/useChatConversations';

const AgentHandbackButton = lazy(() => import('@/components/AgentHandbackButton').then((module) => ({ default: module.AgentHandbackButton })));

interface LinkConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

interface ChatConversationListItemProps {
  chat: ChatConversation;
  isSelected: boolean;
  isPinned: boolean;
  isBulkSelected: boolean;
  linkConfig: LinkConfig;
  formatConversationTime: (isoString: string) => string;
  onSelect: (chat: ChatConversation) => void;
  onToggleConversationSelection: (chatId: string, leadId?: string | null) => void;
  onTogglePinConversation: (conversationId: string) => void;
  onViewLead: (chat: ChatConversation) => void;
  onCallLead: (chat: ChatConversation) => void;
  onLinkConversation: (chat: ChatConversation, event?: React.MouseEvent) => void;
  onTakeover: (chat: ChatConversation, event?: React.MouseEvent) => void;
  onHandbackFromContext: (chat: ChatConversation) => void;
  onHandbackComplete: () => void;
  onArchiveConversation: (chat: ChatConversation) => void;
  onUnarchiveConversation: (chat: ChatConversation) => void;
}

function getChannelIcon(channel: string) {
  switch (channel.toLowerCase()) {
    case 'sms': return MessageSquare;
    case 'whatsapp': return MessageCircle;
    case 'messenger': return Facebook;
    case 'instagram': return Instagram;
    case 'email': return Mail;
    default: return MessageSquare;
  }
}

export function ChatConversationListItem({
  chat,
  isSelected,
  isPinned,
  isBulkSelected,
  linkConfig,
  formatConversationTime,
  onSelect,
  onToggleConversationSelection,
  onTogglePinConversation,
  onViewLead,
  onCallLead,
  onLinkConversation,
  onTakeover,
  onHandbackFromContext,
  onHandbackComplete,
  onArchiveConversation,
  onUnarchiveConversation,
}: ChatConversationListItemProps) {
  const ChannelIcon = getChannelIcon(chat.channel);
  const isResurfaced = isArchivedConversationResurfaced(chat);
  const initials = chat.leadName.trim().split(/\s+/).length >= 2
    ? (chat.leadName.trim().split(/\s+/)[0][0] + chat.leadName.trim().split(/\s+/).pop()?.[0]).toUpperCase()
    : chat.leadName.slice(0, 2).toUpperCase();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => onSelect(chat)}
          className={cn(
            'w-full rounded-2xl border px-3 py-3 pr-14 text-left transition-all cursor-pointer group relative',
            isSelected
              ? 'border-primary/40 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]'
              : 'border-border/60 bg-background/60 hover:border-border hover:bg-accent/30',
            isPinned && !isSelected && 'bg-primary/5'
          )}
        >
          <input
            type="checkbox"
            aria-label="Select conversation"
            checked={isBulkSelected}
            onChange={(event) => {
              event.stopPropagation();
              onToggleConversationSelection(chat.id, chat.leadId);
            }}
            className="absolute left-2 top-3.5 h-3.5 w-3.5 rounded border-border opacity-0 transition-opacity group-hover:opacity-100"
          />

          {isPinned && (
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
              <Pin className="h-2.5 w-2.5 fill-current" />
              <span>Pinned</span>
            </div>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <div className={cn(
              'row-span-2 flex h-11 w-11 items-center justify-center rounded-2xl border text-xs font-semibold',
              isSelected ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border/60 bg-muted/70 text-muted-foreground'
            )}>
              <span>{initials}</span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (chat.leadId) {
                        onViewLead(chat);
                      }
                    }}
                    className={cn(
                      'font-semibold text-foreground transition-colors truncate text-sm',
                      chat.leadId ? 'hover:text-primary hover:underline cursor-pointer' : 'cursor-default'
                    )}
                  >
                    {chat.leadName}
                  </button>

                  {chat.isAiManaged === false ? (
                    <UserCheck className="h-3 w-3 text-amber-600 shrink-0" />
                  ) : (
                    <Bot className="h-3 w-3 text-primary shrink-0" />
                  )}

                  {chat.leadTemperature && (() => {
                    const tempDisplay = getTemperatureDisplay(chat.leadTemperature);
                    if (!tempDisplay) return null;
                    const TempIcon = tempDisplay.icon;
                    return <TempIcon className={cn('w-3 h-3 shrink-0', tempDisplay.color)} />;
                  })()}

                  <ChannelIcon className="w-3 h-3 text-muted-foreground shrink-0" />

                  {isPinned && (
                    <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary">
                      Priority
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatConversationTime(chat.lastMessageAt)}
                  </span>
                  {chat.unread > 0 && (
                    <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground flex items-center justify-center">
                      {chat.unread}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 min-w-0">
                <p className="flex-1 break-words text-sm leading-5 text-muted-foreground line-clamp-2">
                  {chat.lastMessage}
                </p>

                <div className="flex items-center gap-1 shrink-0">
                  {isResurfaced && (
                    <Badge variant="outline" className="h-5 border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] text-amber-700">
                      New reply
                    </Badge>
                  )}
                  {chat.linkedBooking && (
                    <Badge variant="outline" className="h-5 border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-600">
                      <BedDouble className="h-2.5 w-2.5 shrink-0" />
                    </Badge>
                  )}
                  {chat.conversationStatus === 'archived' && <Archive className="w-3 h-3 text-muted-foreground" />}
                </div>
              </div>
            </div>

            <div className={cn(
              'absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-xl border border-border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm transition-opacity',
              isSelected ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6',
                      isPinned ? 'text-primary hover:text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePinConversation(chat.id);
                    }}
                  >
                    <Pin className={cn('h-3 w-3', isPinned && 'fill-current')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">{isPinned ? 'Unpin conversation' : 'Pin conversation'}</TooltipContent>
              </Tooltip>

              {chat.phone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-green-600 hover:bg-green-500/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCallLead(chat);
                      }}
                    >
                      <Phone className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">Call</TooltipContent>
                </Tooltip>
              )}

              {chat.leadId && !chat.linkedBooking && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                      onClick={(event) => onLinkConversation(chat, event)}
                    >
                      <linkConfig.icon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">{linkConfig.label}</TooltipContent>
                </Tooltip>
              )}

              {chat.leadId && (
                chat.isAiManaged !== false ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                        onClick={(event) => onTakeover(chat, event)}
                      >
                        <UserCheck className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">Take over</TooltipContent>
                  </Tooltip>
                ) : (
                  <Suspense fallback={null}>
                    <AgentHandbackButton
                      leadId={chat.leadId}
                      leadName={chat.leadName}
                      onHandback={onHandbackComplete}
                      variant="icon"
                      className="h-6 w-6"
                    />
                  </Suspense>
                )
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {chat.conversationStatus === 'archived' ? (
          <ContextMenuItem onClick={() => onUnarchiveConversation(chat)} className="gap-2">
            <Undo2 className="h-4 w-4" />
            Unarchive conversation
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => onArchiveConversation(chat)} className="gap-2">
            <Archive className="h-4 w-4" />
            Archive conversation
          </ContextMenuItem>
        )}

        <ContextMenuItem onClick={() => onTogglePinConversation(chat.id)} className="gap-2">
          <Pin className={cn('h-4 w-4', isPinned && 'fill-current')} />
          {isPinned ? 'Unpin conversation' : 'Pin conversation'}
        </ContextMenuItem>

        {chat.phone && (
          <ContextMenuItem onClick={() => onCallLead(chat)} className="gap-2 text-green-600">
            <Phone className="h-4 w-4" />
            Call {chat.leadName}
          </ContextMenuItem>
        )}

        {chat.leadId && !chat.linkedBooking && (
          <ContextMenuItem onClick={() => onLinkConversation(chat)} className={cn('gap-2', linkConfig.color)}>
            <linkConfig.icon className="h-4 w-4" />
            {linkConfig.label}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {chat.leadId && (
          chat.isAiManaged !== false ? (
            <ContextMenuItem onClick={() => onTakeover(chat)} className="gap-2 text-amber-600">
              <UserCheck className="h-4 w-4" />
              Take over conversation
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => onHandbackFromContext(chat)} className="gap-2 text-primary">
              <Undo2 className="h-4 w-4" />
              Hand back to AI
            </ContextMenuItem>
          )
        )}

        {chat.leadId && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onViewLead(chat)} className="gap-2">
              <User className="h-4 w-4" />
              View lead details
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}