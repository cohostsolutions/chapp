import { Archive, ArrowUpDown, Bot, Inbox, Mail, MessageCircle, Plus, RefreshCw, Search, Sparkles, UserCheck, X, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@/hooks/useChatConversations';
import type { SortOption } from '@/hooks/useChatLogsState';
import { ChatConversationListItem } from '@/components/chats/ChatConversationListItem';

interface ChannelOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SortOptionItem {
  value: SortOption;
  label: string;
}

interface LinkConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

interface InboxStats {
  total: number;
  totalUnread: number;
  conversationsWithUnread: number;
  totalMessages: number;
  failedMessages: number;
  archivedUnread: number;
  resurfacedCount: number;
}

interface ChatInboxSidebarProps {
  useSinglePanelLayout: boolean;
  stats: InboxStats;
  onOpenNewMessage: () => void;
  selectedChannel: string;
  onSelectedChannelChange: (channel: string) => void;
  channels: ChannelOption[];
  unreadCounts: Record<string, number>;
  getChannelCount: (channelId: string) => number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  isRefreshing: boolean;
  isLoadingConversations: boolean;
  onRefresh: () => void;
  sortBy: SortOption;
  sortOptions: SortOptionItem[];
  onSortByChange: (sortBy: SortOption) => void;
  archivedOnly: boolean;
  onArchivedOnlyChange: (value: boolean) => void;
  unreadFilter: boolean;
  onUnreadFilterChange: (value: boolean) => void;
  agentManagedFilter: boolean | null;
  onAgentManagedFilterChange: (value: boolean | null) => void;
  agentManagedCounts: { agentManaged: number; aiManaged: number };
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filteredChats: ChatConversation[];
  selectedChatId?: string | null;
  pinnedConversations: Set<string>;
  selectedConversationIds: Set<string>;
  onSelectChat: (chat: ChatConversation) => void;
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
  linkConfig: LinkConfig;
  formatConversationTime: (isoString: string) => string;
}

export function ChatInboxSidebar(props: ChatInboxSidebarProps) {
  const {
    useSinglePanelLayout,
    stats,
    onOpenNewMessage,
    selectedChannel,
    onSelectedChannelChange,
    channels,
    unreadCounts,
    getChannelCount,
    searchTerm,
    onSearchTermChange,
    isRefreshing,
    isLoadingConversations,
    onRefresh,
    sortBy,
    sortOptions,
    onSortByChange,
    archivedOnly,
    onArchivedOnlyChange,
    unreadFilter,
    onUnreadFilterChange,
    agentManagedFilter,
    onAgentManagedFilterChange,
    agentManagedCounts,
    hasActiveFilters,
    onClearFilters,
    filteredChats,
    selectedChatId,
    pinnedConversations,
    selectedConversationIds,
    onSelectChat,
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
    linkConfig,
    formatConversationTime,
  } = props;

  const pinnedChats = filteredChats.filter((chat) => pinnedConversations.has(chat.id));
  const unpinnedChats = filteredChats.filter((chat) => !pinnedConversations.has(chat.id));

  const renderConversationList = (conversations: ChatConversation[], label: string, tone: 'pinned' | 'default') => {
    if (conversations.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1.5 pt-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <Badge
              variant="outline"
              className={cn(
                'h-5 rounded-full px-1.5 text-[10px]',
                tone === 'pinned'
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-border/60 bg-background/70 text-muted-foreground',
              )}
            >
              {conversations.length}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          {conversations.map((chat) => (
            <ChatConversationListItem
              key={chat.id}
              chat={chat}
              isSelected={selectedChatId === chat.id}
              isPinned={pinnedConversations.has(chat.id)}
              isBulkSelected={selectedConversationIds.has(chat.id)}
              linkConfig={linkConfig}
              formatConversationTime={formatConversationTime}
              onSelect={onSelectChat}
              onToggleConversationSelection={onToggleConversationSelection}
              onTogglePinConversation={onTogglePinConversation}
              onViewLead={onViewLead}
              onCallLead={onCallLead}
              onLinkConversation={onLinkConversation}
              onTakeover={onTakeover}
              onHandbackFromContext={onHandbackFromContext}
              onHandbackComplete={onHandbackComplete}
              onArchiveConversation={onArchiveConversation}
              onUnarchiveConversation={onUnarchiveConversation}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('flex flex-col rounded-none border-y-0 border-l-0 overflow-hidden bg-card/75 backdrop-blur-sm', useSinglePanelLayout ? 'w-full border-r-0' : 'border-r h-full shadow-[inset_-1px_0_0_hsl(var(--border))]')}>
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="px-4 py-3 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Inbox</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{stats.total} conversations across active channels</span>
                      {pinnedConversations.size > 0 && (
                        <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary">
                          {pinnedConversations.size} pinned
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-xl bg-background/80" onClick={onOpenNewMessage}>
                <Plus className="h-3.5 w-3.5" />
                {useSinglePanelLayout ? 'Compose' : 'New'}
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Unread</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.totalUnread}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Awaiting Reply</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.conversationsWithUnread}</p>
              </div>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-border/50">
            <Tabs value={selectedChannel} onValueChange={onSelectedChannelChange}>
              <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-transparent p-0">
                {channels.map((channel) => {
                  const unreadCount = unreadCounts[channel.id] || 0;
                  const channelCount = getChannelCount(channel.id);
                  return (
                    <TabsTrigger key={channel.id} value={channel.id} className="flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1.5 text-xs data-[state=active]:border-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <channel.icon className="w-3 h-3" />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]">{channel.label}</span>
                        <span className="text-[10px] opacity-70">({channelCount})</span>
                        {unreadCount > 0 && <Badge className="h-4 px-1 text-[10px] ml-0.5 bg-destructive text-destructive-foreground">{unreadCount}</Badge>}
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

          <div className="px-3 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search conversations..." value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} className="h-10 rounded-xl border-border/70 bg-background/70 pl-10" />
                {searchTerm && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => onSearchTermChange('')}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl border-border/70 bg-background/70" onClick={onRefresh} disabled={isLoadingConversations || isRefreshing}>
                    <RefreshCw className={cn('w-4 h-4', (isLoadingConversations || isRefreshing) && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sync messages from Facebook</TooltipContent>
              </Tooltip>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-2">
              <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                View Controls
              </div>

              <div className="flex items-center gap-2 flex-wrap">
              <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortOption)}>
                <SelectTrigger className="h-8 min-w-[120px] flex-1 rounded-xl border-border/70 bg-background/80 text-xs">
                  <ArrowUpDown className="w-3 h-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle size="sm" pressed={archivedOnly} onPressedChange={() => onArchivedOnlyChange(!archivedOnly)} className="h-8 rounded-xl px-2 text-xs gap-1 data-[state=on]:bg-muted data-[state=on]:text-foreground">
                      <Archive className="h-3 w-3" />
                      <span className="text-[10px]">Archived</span>
                      {stats.archivedUnread > 0 && <Badge className="bg-destructive text-destructive-foreground h-4 min-w-4 px-1 text-[10px]">{stats.archivedUnread}</Badge>}
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>{archivedOnly ? 'Showing archived only' : 'Showing active chats plus resurfaced archived conversations'}{stats.archivedUnread > 0 ? ` • ${stats.archivedUnread} unread archived` : ''}{stats.resurfacedCount > 0 && !archivedOnly ? ` • ${stats.resurfacedCount} resurfaced` : ''}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle size="sm" pressed={unreadFilter} onPressedChange={() => onUnreadFilterChange(!unreadFilter)} className="h-8 rounded-xl px-2 text-xs gap-1 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="text-[10px]">{stats.conversationsWithUnread}</span>
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Show unread only ({stats.conversationsWithUnread})</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle size="sm" pressed={agentManagedFilter === true} onPressedChange={() => onAgentManagedFilterChange(agentManagedFilter === true ? null : true)} className="h-8 rounded-xl px-2 text-xs gap-1 data-[state=on]:bg-amber-500 data-[state=on]:text-white">
                      <UserCheck className="h-3 w-3" />
                      <span className="text-[10px]">{agentManagedCounts.agentManaged}</span>
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Show agent-managed ({agentManagedCounts.agentManaged})</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle size="sm" pressed={agentManagedFilter === false} onPressedChange={() => onAgentManagedFilterChange(agentManagedFilter === false ? null : false)} className="h-8 rounded-xl px-2 text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                      <Bot className="h-3 w-3" />
                      <span className="text-[10px]">{agentManagedCounts.aiManaged}</span>
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Show AI-managed ({agentManagedCounts.aiManaged})</TooltipContent>
                </Tooltip>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 rounded-xl text-xs">
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoadingConversations ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-6 lg:p-8">
              <div className="rounded-3xl border border-dashed border-border/70 bg-gradient-to-b from-background to-muted/30 px-6 py-12 text-center text-muted-foreground">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="h-8 w-8 opacity-90" />
              </div>
              <p className="font-semibold text-foreground">No conversations</p>
              <p className="mt-2 text-sm">
                {hasActiveFilters
                  ? 'No conversations match your filters'
                  : selectedChannel === 'all'
                    ? 'Messages will appear here when leads contact you'
                    : `No ${channels.find((channel) => channel.id === selectedChannel)?.label} conversations yet`}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" className="mt-5 rounded-xl" onClick={onClearFilters}>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear filters
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-5 rounded-xl" onClick={onOpenNewMessage}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Start conversation
                </Button>
              )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-2.5 pb-4">
              {renderConversationList(pinnedChats, 'Pinned', 'pinned')}
              {renderConversationList(unpinnedChats, pinnedChats.length > 0 ? 'Recent' : 'Conversations', 'default')}
            </div>
          )}
        </ScrollArea>
      </Card>
  );
}