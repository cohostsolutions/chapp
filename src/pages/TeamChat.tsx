import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamChats, useTeamChatMessages, useHelpdeskTickets, TeamChat, TeamChatMessage } from '@/hooks/useTeamChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, 
  Plus, 
  Users, 
  Search, 
  Send, 
  Smile, 
  Paperclip,
  MoreVertical,
  HelpCircle,
  Hash,
  User,
  Settings,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  Download,
  CheckCheck,
  Pin,
  PinOff,
  Reply,
  ArrowLeft,
  Bell,
  BellOff,
  MessageCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, formatDistanceToNow, parseISO } from 'date-fns';
import { CreateGroupChatDialog } from '@/components/team-chat/CreateGroupChatDialog';
import { NewDirectMessageDialog } from '@/components/team-chat/NewDirectMessageDialog';
import { CreateHelpdeskTicketDialog } from '@/components/team-chat/CreateHelpdeskTicketDialog';
import { ChatSettingsDialog } from '@/components/team-chat/ChatSettingsDialog';
import EmojiPicker from 'emoji-picker-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SkipToContent } from '@/components/shared/SkipToContent';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseFunctionAuthHeaders } from '@/lib/supabaseFunctionHeaders';
import { buildChatPinStorageKey, readPinnedIdsFromStorage, writePinnedIdsToStorage } from '@/lib/chatPinStorage';

function TeamChatPageContent() {
  const { user, profile, effectiveRoles, isSuperAdmin } = useAuth();
  const { chats, isLoading: chatsLoading, totalUnread, createDirectChat } = useTeamChats();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showHelpdesk, setShowHelpdesk] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [pinnedChats, setPinnedChats] = useState<Set<string>>(new Set());
  const [hydratedTeamPinStorageKey, setHydratedTeamPinStorageKey] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<TeamChatMessage | null>(null);
  const teamChatPinStorageKey = useMemo(
    () => buildChatPinStorageKey({
      scope: 'team-chats',
      organizationId: profile?.organization_id,
      userId: user?.id,
    }),
    [profile?.organization_id, user?.id],
  );

  const selectedChat = chats.find(c => c.id === selectedChatId);
  const isClientAdmin = effectiveRoles.includes('client_admin');

  useEffect(() => {
    if (!teamChatPinStorageKey) {
      setPinnedChats(new Set());
      setHydratedTeamPinStorageKey(null);
      return;
    }

    setPinnedChats(readPinnedIdsFromStorage(teamChatPinStorageKey));
    setHydratedTeamPinStorageKey(teamChatPinStorageKey);
  }, [teamChatPinStorageKey]);

  useEffect(() => {
    if (!teamChatPinStorageKey || hydratedTeamPinStorageKey !== teamChatPinStorageKey) {
      return;
    }

    writePinnedIdsToStorage(teamChatPinStorageKey, pinnedChats);
  }, [hydratedTeamPinStorageKey, pinnedChats, teamChatPinStorageKey]);

  // Stats calculation
  const stats = useMemo(() => {
    const _totalMessages = chats.reduce((sum, chat) => sum + (chat.last_message ? 1 : 0), 0);
    const directCount = chats.filter(c => c.chat_type === 'direct').length;
    const groupCount = chats.filter(c => c.chat_type === 'group').length;
    const supportCount = chats.filter(c => c.chat_type === 'helpdesk' || c.is_helpdesk_channel).length;
    
    return {
      total: chats.length,
      totalUnread,
      direct: directCount,
      groups: groupCount,
      support: supportCount
    };
  }, [chats, totalUnread]);

  // Filter and sort chats
  const filteredChats = useMemo(() => {
    const result = chats.filter(chat => {
      if (!searchQuery) return true;
      const name = chat.name?.toLowerCase() || '';
      const members = chat.members?.map(m => m.profile?.full_name?.toLowerCase() || m.profile?.email?.toLowerCase()).join(' ') || '';
      return name.includes(searchQuery.toLowerCase()) || members.includes(searchQuery.toLowerCase());
    });

    // Sort: pinned first, then by last message time
    return result.sort((a, b) => {
      const aIsPinned = pinnedChats.has(a.id);
      const bIsPinned = pinnedChats.has(b.id);
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      const aTime = a.last_message?.created_at || a.created_at || '';
      const bTime = b.last_message?.created_at || b.created_at || '';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [chats, searchQuery, pinnedChats]);

  // Group chats by type
  const groupChats = filteredChats.filter(c => c.chat_type === 'group');
  const directChats = filteredChats.filter(c => c.chat_type === 'direct');
  const helpdeskChats = filteredChats.filter(c => c.chat_type === 'helpdesk' || c.is_helpdesk_channel);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setMobileShowChat(true);
    setReplyingTo(null);
  };

  const togglePinChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  };

  const clearSearch = () => setSearchQuery('');

  const pinnedCount = pinnedChats.size;

  return (
    <>
      {/* Accessibility: Skip to main content link */}
      <SkipToContent targetId="main-content" />
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Main landmark for accessibility */}
        <main
          id="main-content"
          tabIndex={-1}
          role="main"
          aria-label="Team Chat main content"
          className="flex-1 flex flex-col"
        >
          {/* Stats Header - Desktop Only */}
          <div className="hidden md:block p-4 border-b border-border bg-muted/30">
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Bell className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUnread}</p>
                  <p className="text-xs text-muted-foreground">Unread</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.groups}</p>
                  <p className="text-xs text-muted-foreground">Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <HelpCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.support}</p>
                  <p className="text-xs text-muted-foreground">Support</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

          <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Chat List */}
        <div className={cn(
          "w-full md:w-80 border-r border-border flex flex-col bg-muted/30",
          mobileShowChat && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">Team Chat</h1>
                  {pinnedCount > 0 && (
                    <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary">
                      {pinnedCount} pinned
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalUnread > 0 ? `${stats.totalUnread} unread messages` : 'Pinned chats stay at the top after refresh'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowNewDM(true)}>
                    <User className="h-4 w-4 mr-2" />
                    New Direct Message
                  </DropdownMenuItem>
                  {isClientAdmin && (
                    <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                      <Users className="h-4 w-4 mr-2" />
                      Create Group Chat
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowHelpdesk(true)}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Contact Support
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9 pr-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Chat List */}
          <ScrollArea className="flex-1">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start px-4 pt-2 bg-transparent">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  All {stats.total > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{stats.total}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="direct" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Direct {stats.direct > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{stats.direct}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="groups" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Groups {stats.groups > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{stats.groups}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="support" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Support {stats.support > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{stats.support}</Badge>}
                </TabsTrigger>
              </TabsList>

              {chatsLoading ? (
                <div className="p-2 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <TabsContent value="all" className="mt-0">
                    <ChatList 
                      chats={filteredChats} 
                      selectedId={selectedChatId} 
                      onSelect={handleSelectChat}
                      currentUserId={user?.id}
                      pinnedChats={pinnedChats}
                      onTogglePin={togglePinChat}
                      searchQuery={searchQuery}
                    />
                  </TabsContent>
                  <TabsContent value="direct" className="mt-0">
                    <ChatList 
                      chats={directChats} 
                      selectedId={selectedChatId} 
                      onSelect={handleSelectChat}
                      currentUserId={user?.id}
                      pinnedChats={pinnedChats}
                      onTogglePin={togglePinChat}
                      searchQuery={searchQuery}
                      emptyMessage="No direct messages yet"
                      emptyAction={() => setShowNewDM(true)}
                      emptyActionLabel="Start a conversation"
                    />
                  </TabsContent>
                  <TabsContent value="groups" className="mt-0">
                    <ChatList 
                      chats={groupChats} 
                      selectedId={selectedChatId} 
                      onSelect={handleSelectChat}
                      currentUserId={user?.id}
                      pinnedChats={pinnedChats}
                      onTogglePin={togglePinChat}
                      searchQuery={searchQuery}
                      emptyMessage="No group chats yet"
                      emptyAction={isClientAdmin ? () => setShowCreateGroup(true) : undefined}
                      emptyActionLabel="Create a group"
                    />
                  </TabsContent>
                  <TabsContent value="support" className="mt-0">
                    <ChatList 
                      chats={helpdeskChats} 
                      selectedId={selectedChatId} 
                      onSelect={handleSelectChat}
                      currentUserId={user?.id}
                      pinnedChats={pinnedChats}
                      onTogglePin={togglePinChat}
                      searchQuery={searchQuery}
                      emptyMessage="No support tickets yet"
                      emptyAction={() => setShowHelpdesk(true)}
                      emptyActionLabel="Contact support"
                    />
                  </TabsContent>
                </>
              )}
            </Tabs>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col bg-background",
          !mobileShowChat && "hidden md:flex"
        )}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-background">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden"
                    onClick={() => setMobileShowChat(false)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <ChatAvatar chat={selectedChat} currentUserId={user?.id} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{selectedChat.name}</h2>
                      {pinnedChats.has(selectedChat.id) && (
                        <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary">
                          <Pin className="mr-1 h-2.5 w-2.5 fill-current" />
                          Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.chat_type === 'direct' 
                        ? 'Direct message'
                        : selectedChat.chat_type === 'helpdesk'
                        ? 'Support chat'
                        : `${selectedChat.members?.length || 0} members`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={pinnedChats.has(selectedChat.id) ? 'outline' : 'ghost'} 
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => togglePinChat(selectedChat.id, e)}
                        >
                          {pinnedChats.has(selectedChat.id) ? (
                            <>
                              <PinOff className="h-4 w-4" />
                              <span className="hidden sm:inline">Unpin</span>
                            </>
                          ) : (
                            <>
                              <Pin className="h-4 w-4" />
                              <span className="hidden sm:inline">Pin</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {pinnedChats.has(selectedChat.id) ? 'Unpin chat' : 'Pin chat'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ChatMessages 
                chatId={selectedChatId!} 
                currentUserId={user?.id}
                replyingTo={replyingTo}
                onReply={setReplyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center max-w-sm px-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Welcome to Team Chat</h3>
                <p className="text-sm mb-6">Select a conversation from the sidebar or start a new one to get chatting.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => setShowNewDM(true)} variant="default">
                    <User className="h-4 w-4 mr-2" />
                    New Message
                  </Button>
                  {isClientAdmin && (
                    <Button onClick={() => setShowCreateGroup(true)} variant="outline">
                      <Users className="h-4 w-4 mr-2" />
                      Create Group
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateGroupChatDialog open={showCreateGroup} onOpenChange={setShowCreateGroup} />
      <NewDirectMessageDialog open={showNewDM} onOpenChange={setShowNewDM} onSelectUser={(userId) => {
        createDirectChat.mutate(userId);
        setShowNewDM(false);
      }} />
      <CreateHelpdeskTicketDialog open={showHelpdesk} onOpenChange={setShowHelpdesk} />
      {selectedChat && (
        <ChatSettingsDialog 
          open={showSettings} 
          onOpenChange={setShowSettings}
          chat={selectedChat}
        />
      )}
        </main>
      </div>
    </>
  );
}

// Chat List Component
function ChatList({ 
  chats, 
  selectedId, 
  onSelect,
  currentUserId,
  pinnedChats,
  onTogglePin,
  searchQuery,
  emptyMessage = "No conversations found",
  emptyAction,
  emptyActionLabel
}: { 
  chats: TeamChat[]; 
  selectedId: string | null; 
  onSelect: (id: string) => void;
  currentUserId?: string;
  pinnedChats: Set<string>;
  onTogglePin: (chatId: string, e: React.MouseEvent) => void;
  searchQuery?: string;
  emptyMessage?: string;
  emptyAction?: () => void;
  emptyActionLabel?: string;
}) {
  if (chats.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {searchQuery ? `No results for "${searchQuery}"` : emptyMessage}
        </p>
        {searchQuery ? (
          <p className="text-xs text-muted-foreground">Try a different search term</p>
        ) : emptyAction && emptyActionLabel && (
          <Button variant="outline" size="sm" onClick={emptyAction}>
            <Plus className="h-4 w-4 mr-2" />
            {emptyActionLabel}
          </Button>
        )}
      </div>
    );
  }

  const pinnedList = chats.filter((chat) => pinnedChats.has(chat.id));
  const unpinnedList = chats.filter((chat) => !pinnedChats.has(chat.id));

  const renderChatGroup = (groupChats: TeamChat[], label: string, tone: 'pinned' | 'default') => {
    if (groupChats.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
          <Badge
            variant="outline"
            className={cn(
              'h-5 rounded-full px-1.5 text-[10px]',
              tone === 'pinned'
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-border/60 bg-background/70 text-muted-foreground',
            )}
          >
            {groupChats.length}
          </Badge>
        </div>

        {groupChats.map(chat => {
          const isPinned = pinnedChats.has(chat.id);
          return (
            <div
              key={chat.id}
              className={cn(
                'group relative flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer border',
                selectedId === chat.id 
                  ? 'bg-accent border-primary/30' 
                  : 'hover:bg-muted border-transparent',
                isPinned && 'border-primary/20 bg-primary/5'
              )}
              onClick={() => onSelect(chat.id)}
            >
              <div className="relative">
                <ChatAvatar chat={chat} currentUserId={currentUserId} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">{chat.name}</span>
                    {isPinned && (
                      <Badge variant="outline" className="h-5 rounded-full border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary">
                        <Pin className="mr-1 h-2.5 w-2.5 fill-current" />
                        Pinned
                      </Badge>
                    )}
                  </div>
                  {chat.last_message && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatMessageTime(chat.last_message.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {chat.last_message ? (
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {chat.last_message.content}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic flex-1">No messages yet</p>
                  )}
                  {chat.unread_count && chat.unread_count > 0 && (
                    <Badge variant="default" className="shrink-0 h-5 min-w-[20px] flex items-center justify-center">
                      {chat.unread_count > 99 ? '99+' : chat.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'shrink-0 h-7 w-7 rounded-lg',
                  isPinned ? 'text-primary hover:text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
                )}
                onClick={(e) => onTogglePin(chat.id, e)}
              >
                {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-2 space-y-1">
      {renderChatGroup(pinnedList, 'Pinned', 'pinned')}
      {renderChatGroup(unpinnedList, pinnedList.length > 0 ? 'Recent' : 'Conversations', 'default')}
    </div>
  );
}

// Chat Avatar Component
function ChatAvatar({ chat, currentUserId }: { chat: TeamChat; currentUserId?: string }) {
  if (chat.chat_type === 'direct') {
    const otherMember = chat.members?.find(m => m.user_id !== currentUserId);
    return (
      <Avatar className="h-10 w-10">
        <AvatarImage src={otherMember?.profile?.avatar_url || undefined} />
        <AvatarFallback>
          {otherMember?.profile?.full_name?.charAt(0) || otherMember?.profile?.email?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>
    );
  }

  if (chat.chat_type === 'helpdesk' || chat.is_helpdesk_channel) {
    return (
      <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
        <HelpCircle className="h-5 w-5 text-amber-500" />
      </div>
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
      <Hash className="h-5 w-5 text-primary" />
    </div>
  );
}

// Chat Messages Component
function ChatMessages({ 
  chatId, 
  currentUserId,
  replyingTo,
  onReply,
  onCancelReply
}: { 
  chatId: string; 
  currentUserId?: string;
  replyingTo?: TeamChatMessage | null;
  onReply?: (message: TeamChatMessage) => void;
  onCancelReply?: () => void;
}) {
  const { messages, isLoading, sendMessage, addReaction, removeReaction, markAsRead, refetch } = useTeamChatMessages(chatId);
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    markAsRead();
  }, [chatId, markAsRead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  const messageMap = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage.mutate({ content: newMessage.trim(), parentMessageId: replyingTo?.id || null });
    setNewMessage('');
    onCancelReply?.();
  };

  const handleReactionToggle = (message: TeamChatMessage, emoji: string) => {
    const reactedByCurrentUser = message.reactions?.some(
      (reaction) => reaction.emoji === emoji && reaction.user_id === currentUserId,
    );

    if (reactedByCurrentUser) {
      removeReaction.mutate({ messageId: message.id, emoji });
      return;
    }

    addReaction.mutate({ messageId: message.id, emoji });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply?.();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);
      const functionHeaders = await getSupabaseFunctionAuthHeaders();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-chat-file`,
        {
          method: 'POST',
          headers: functionHeaders,
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      refetch();
    } catch (error) {
      devError('File upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload the selected file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {} as Record<string, TeamChatMessage[]>);

  return (
    <>
      {/* Messages Scroll Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8" />
            </div>
            <p className="font-medium text-foreground">No messages yet</p>
            <p className="text-sm">Send the first message to start the conversation!</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center gap-4 my-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground font-medium bg-background px-2">
                  {formatDateHeader(date)}
                </span>
                <Separator className="flex-1" />
              </div>
              {msgs.map((message, idx) => {
                const isOwn = message.sender_id === currentUserId;
                const showAvatar = idx === 0 || msgs[idx - 1].sender_id !== message.sender_id;
                const parentMessage = message.parent_message_id ? messageMap.get(message.parent_message_id) : null;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "group flex gap-3 mb-2",
                      isOwn && "flex-row-reverse"
                    )}
                  >
                    {showAvatar && !isOwn ? (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={message.sender?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {message.sender?.full_name?.charAt(0) || message.sender?.email?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}
                    <div className={cn("max-w-[70%] relative", isOwn && "items-end")}>
                      {showAvatar && !isOwn && (
                        <p className="text-xs text-muted-foreground mb-1 font-medium">
                          {message.sender?.full_name || message.sender?.email}
                        </p>
                      )}
                      {message.message_type === 'image' ? (
                        <div className="rounded-lg overflow-hidden max-w-[300px] shadow-sm">
                          <img 
                            src={(message.metadata as unknown as { file_url?: string }).file_url}
                            alt={message.content || 'Shared image'} 
                            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open((message.metadata as unknown as { file_url?: string }).file_url, '_blank')}
                          />
                        </div>
                      ) : message.message_type === 'file' ? (
                      <a 
                        href={(message.metadata as unknown as { file_url?: string }).file_url}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm",
                            isOwn 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-muted rounded-bl-sm"
                          )}
                        >
                          <FileText className="h-8 w-8 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{message.content}</p>
                            <p className="text-xs opacity-70">
                              {formatFileSize((message.metadata as unknown as { file_size?: number }).file_size)}
                            </p>
                          </div>
                          <Download className="h-4 w-4 shrink-0" />
                        </a>
                      ) : (
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2 shadow-sm",
                            isOwn 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-muted rounded-bl-sm"
                          )}
                        >
                          {parentMessage ? (
                            <div
                              className={cn(
                                'mb-2 rounded-lg border px-3 py-2 text-xs',
                                isOwn ? 'border-primary-foreground/20 bg-primary-foreground/10' : 'border-border/70 bg-background/60',
                              )}
                            >
                              <p className="font-medium">
                                {parentMessage.sender?.full_name || parentMessage.sender?.email || 'Previous message'}
                              </p>
                              <p className="truncate opacity-80">{parentMessage.content || 'Attachment'}</p>
                            </div>
                          ) : null}
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                      )}
                      <div className={cn("flex items-center gap-2 mt-1", isOwn && "justify-end")}>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), 'h:mm a')}
                        </span>
                        {message.is_edited && (
                          <span className="text-xs text-muted-foreground italic">(edited)</span>
                        )}
                        {/* Reply button - visible on hover */}
                        {onReply && (
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            onClick={() => onReply(message)}
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(
                            message.reactions.reduce((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              className={cn(
                                'text-xs rounded-full px-2 py-0.5 transition-colors',
                                message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.user_id === currentUserId)
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted hover:bg-muted/80',
                              )}
                              onClick={() => handleReactionToggle(message, emoji)}
                            >
                              {emoji} {count}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </ScrollArea>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/50 flex items-center gap-3">
          <Reply className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Replying to <span className="font-medium">{replyingTo.sender?.full_name || replyingTo.sender?.email}</span>
            </p>
            <p className="text-sm truncate">{replyingTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-background">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
          accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
        />
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Paperclip className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Popover open={showEmoji} onOpenChange={setShowEmoji}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="top">
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  setNewMessage(prev => prev + emoji.emoji);
                  setShowEmoji(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Input
            ref={inputRef}
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleSend} 
                  disabled={!newMessage.trim() || sendMessage.isPending}
                  size="icon"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}

// Helper functions
function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function TeamChatPage() {
  return (
    <ErrorBoundary fullPage>
      <TeamChatPageContent />
    </ErrorBoundary>
  );
}
