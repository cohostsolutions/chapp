import { lazy, Suspense } from 'react';
import { ArrowLeft, BedDouble, Bot, Phone, UserCheck, type LucideIcon, Facebook, Instagram, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSearch } from '@/components/communications/MessageSearch';
import { cn } from '@/lib/utils';
import { getTemperatureDisplay } from '@/lib/chatConfig';
import type { ChatConversation } from '@/hooks/useChatConversations';

const AgentHandbackButton = lazy(() => import('@/components/AgentHandbackButton').then((module) => ({ default: module.AgentHandbackButton })));

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

interface SearchMessage {
  id: string;
  content: string;
  timestamp: string;
  role: string;
}

interface LinkConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

interface ChatThreadHeaderProps {
  selectedChat: ChatConversation;
  useSinglePanelLayout: boolean;
  agentName: string;
  linkConfig: LinkConfig;
  messages: SearchMessage[];
  onBackToList: () => void;
  onViewLead: (chat: ChatConversation) => void;
  onTakeover: (chat: ChatConversation, event?: React.MouseEvent) => void;
  onLinkConversation: (chat: ChatConversation, event?: React.MouseEvent) => void;
  onCallLead: (chat: ChatConversation) => void;
  onSearchResultClick: (messageId: string) => void;
  onHandbackComplete: () => void;
}

export function ChatThreadHeader({
  selectedChat,
  useSinglePanelLayout,
  agentName,
  linkConfig,
  messages,
  onBackToList,
  onViewLead,
  onTakeover,
  onLinkConversation,
  onCallLead,
  onSearchResultClick,
  onHandbackComplete,
}: ChatThreadHeaderProps) {
  const ChannelIcon = getChannelIcon(selectedChat.channel);

  return (
    <div className={cn('flex gap-3', useSinglePanelLayout ? 'flex-col' : 'items-center justify-between')}>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {useSinglePanelLayout && (
          <Button variant="ghost" size="icon" onClick={onBackToList} className="shrink-0 h-9 w-9 rounded-xl border border-border/60 bg-background/80">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className={cn('min-w-0 flex-1', useSinglePanelLayout && 'rounded-2xl border border-border/60 bg-muted/15 p-3') }>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (selectedChat.leadId) {
                  onViewLead(selectedChat);
                }
              }}
              className={cn(
                'text-sm lg:text-lg font-semibold truncate transition-colors max-w-[160px] lg:max-w-none',
                selectedChat.leadId ? 'hover:text-primary hover:underline cursor-pointer' : 'cursor-default'
              )}
            >
              {selectedChat.leadName}
            </button>
            <Badge variant="outline" className="gap-1 text-[10px] lg:text-xs shrink-0 px-1.5 py-0.5">
              <ChannelIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{selectedChat.channel}</span>
            </Badge>
            {selectedChat.leadTemperature && (() => {
              const tempDisplay = getTemperatureDisplay(selectedChat.leadTemperature);
              if (!tempDisplay) return null;
              const TempIcon = tempDisplay.icon;
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className={cn('gap-1 text-[10px] shrink-0 px-1.5 py-0.5', tempDisplay.bg, tempDisplay.color)}>
                      <TempIcon className="w-3 h-3" />
                      <span className="hidden sm:inline capitalize">{selectedChat.leadTemperature}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="capitalize">{selectedChat.leadTemperature} lead</TooltipContent>
                </Tooltip>
              );
            })()}
            {selectedChat.isAiManaged === false ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-0.5 shrink-0 px-1.5 py-0.5">
                    <UserCheck className="h-3 w-3" />
                    <span className="hidden sm:inline">Agent</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Agent-managed conversation</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] gap-0.5 shrink-0 px-1.5 py-0.5">
                    <Bot className="h-3 w-3" />
                    <span className="hidden sm:inline">{agentName}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>AI-managed by {agentName}</TooltipContent>
              </Tooltip>
            )}
            {selectedChat.linkedBooking && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-0.5 shrink-0 px-1.5 py-0.5">
                    <BedDouble className="h-3 w-3" />
                    <span className="hidden sm:inline">{selectedChat.linkedBooking.room_name}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Booking: {selectedChat.linkedBooking.room_name} ({selectedChat.linkedBooking.status})
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="mt-1 text-[11px] lg:text-sm text-muted-foreground truncate max-w-[220px] lg:max-w-none">
            {selectedChat.phone || selectedChat.email}
          </p>
        </div>
      </div>

      <div className={cn('flex items-center gap-1 lg:gap-2 shrink-0', useSinglePanelLayout && 'flex-wrap justify-end pl-11')}>
        <MessageSearch messages={messages} onResultClick={onSearchResultClick} />
        {selectedChat.leadId && (
          selectedChat.isAiManaged !== false ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-amber-500/70 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  onClick={(event) => onTakeover(selectedChat, event)}
                >
                  <UserCheck className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Take over conversation</TooltipContent>
            </Tooltip>
          ) : (
            <Suspense fallback={null}>
              <AgentHandbackButton
                leadId={selectedChat.leadId}
                leadName={selectedChat.leadName}
                onHandback={onHandbackComplete}
              />
            </Suspense>
          )
        )}
        {selectedChat.leadId && !selectedChat.linkedBooking && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn('h-9 w-9 rounded-xl', linkConfig.color)}
                onClick={(event) => onLinkConversation(selectedChat, event)}
              >
                <linkConfig.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{linkConfig.label}</TooltipContent>
          </Tooltip>
        )}
        {selectedChat.phone && (
          <Button variant="glow" size="icon" className="shrink-0 h-9 w-9 rounded-xl lg:w-auto lg:px-3" onClick={() => onCallLead(selectedChat)}>
            <Phone className="w-4 h-4 lg:mr-2" />
            <span className="hidden lg:inline">Call</span>
          </Button>
        )}
      </div>
    </div>
  );
}