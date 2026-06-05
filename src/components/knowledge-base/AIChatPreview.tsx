import { useState, useRef, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  Bot, 
  User,
  RefreshCw,
  X,
  BedDouble,
  Briefcase,
  UtensilsCrossed,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useUnifiedAI } from '@/hooks/useUnifiedAI';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getAgentOnboardingContent } from '@/lib/agent-onboarding';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

// Parse message content and render images inline
function parseMessageWithImages(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  
  const cleanedContent = content
    .replace(/Here['']s (?:an |the )?image[:\s]*/gi, '')
    .replace(/Here is (?:an |the )?image[:\s]*/gi, '')
    .replace(/\[IMAGE_URL\]/gi, '')
    .replace(/IMAGE_URL:\s*/gi, '');
  
  const imagePattern = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\]|(https?:\/\/[^\s\]]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s]*)?)/gi;
  
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  const processedUrls = new Set<string>();

  while ((match = imagePattern.exec(cleanedContent)) !== null) {
    const imageUrl = match[1] || match[2];
    
    if (processedUrls.has(imageUrl)) continue;
    processedUrls.add(imageUrl);
    
    if (match.index > lastIndex) {
      const textBefore = cleanedContent.slice(lastIndex, match.index)
        .replace(/:\s*$/, '')
        .replace(/\[\s*$/, '')
        .trim();
      if (textBefore) {
        parts.push(<span key={`text-${keyIndex++}`}>{textBefore} </span>);
      }
    }
    
    parts.push(
      <div key={`img-${keyIndex++}`} className="my-2">
        <img 
          src={imageUrl} 
          alt="Shared image" 
          className="max-w-full max-h-48 rounded-lg border border-border object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < cleanedContent.length) {
    const remainingText = cleanedContent.slice(lastIndex)
      .replace(/^\s*\]\s*/, '')
      .replace(/^\s*:\s*/, '')
      .trim();
    if (remainingText) {
      parts.push(<span key={`text-${keyIndex++}`}>{remainingText}</span>);
    }
  }
  
  if (parts.length === 0) {
    return [<span key="content">{cleanedContent}</span>];
  }
  
  return parts;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const agentConfig = {
  jay: {
    icon: Briefcase,
    bgColor: 'bg-primary/20',
    textColor: 'text-primary',
  },
  may: {
    icon: UtensilsCrossed,
    bgColor: 'bg-warning/20',
    textColor: 'text-warning',
  },
  cece: {
    icon: BedDouble,
    bgColor: 'bg-success/20',
    textColor: 'text-success',
  },
};

type AgentType = keyof typeof agentConfig;

interface AIChatPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIChatPreview({ open, onOpenChange }: AIChatPreviewProps) {
  const { profile, aiAgentType: orgAgentType } = useAuth();
  const { toast } = useToast();
  const { isLoading, sendMessage, clearMessages } = useUnifiedAI({
    organizationId: profile?.organization_id || undefined,
  });
  
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [customOpeningMessage, setCustomOpeningMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentType: AgentType = (orgAgentType || 'jay') as AgentType;
  const config = agentConfig[agentType] || agentConfig.jay;
  const onboardingContent = getAgentOnboardingContent(agentType);
  const IconComponent = config.icon;

  // Fetch custom opening message
  useEffect(() => {
    const fetchOpeningMessage = async () => {
      if (!profile?.organization_id) return;
      
      try {
        const { data } = await supabase
          .from('organizations')
          .select('sales_process_config')
          .eq('id', profile.organization_id)
          .single();
        
        const configData = data?.sales_process_config as { 
          opening?: { enabled?: boolean; message?: string } 
        } | null;
        const openingMessage = configData?.opening?.enabled && configData?.opening?.message
          ? configData.opening.message.trim()
          : null;
        setCustomOpeningMessage(openingMessage);
      } catch (error) {
        devError('Failed to fetch opening message:', error);
      }
    };
    
    fetchOpeningMessage();
  }, [profile?.organization_id]);

  // Initialize with greeting
  useEffect(() => {
    const greeting = customOpeningMessage || onboardingContent.previewGreeting;
    setDisplayMessages([{
      id: '1',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    }]);
  }, [customOpeningMessage, onboardingContent.previewGreeting, orgAgentType]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setDisplayMessages(prev => [...prev, userMessage]);
    const messageText = input.trim();
    setInput('');

    const response = await sendMessage(messageText);

    if (response) {
      const assistantMessage: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response || response.error || "I couldn't process your request.",
        timestamp: new Date(),
      };

      setDisplayMessages(prev => [...prev, assistantMessage]);
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetConversation = () => {
    clearMessages();
    const greeting = customOpeningMessage || onboardingContent.previewGreeting;
    setDisplayMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    }]);
    setInput('');
    toast({
      title: "Conversation Reset",
      description: `Starting a new test conversation with ${onboardingContent.name}`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className={cn(
          "p-0 flex flex-col transition-all duration-300",
          isExpanded ? "sm:max-w-[600px]" : "sm:max-w-[400px]"
        )}
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.bgColor)}>
                <IconComponent className={cn("w-5 h-5", config.textColor)} />
              </div>
              <div>
                <SheetTitle className="text-base flex items-center gap-2">
                  Test {onboardingContent.name}
                  <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30">
                    Preview
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Preview the live opening message and knowledge base behavior
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="hidden sm:flex"
                aria-label={isExpanded ? "Minimize chat" : "Expand chat"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetConversation}
                aria-label="Reset conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
            {displayMessages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' && "flex-row-reverse"
                )}
              >
                <Avatar className={cn(
                  "w-8 h-8 shrink-0",
                  message.role === 'assistant' ? config.bgColor : "bg-secondary"
                )}>
                  <AvatarFallback>
                    {message.role === 'assistant' ? (
                      <Bot className={cn("w-4 h-4", config.textColor)} />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "flex flex-col max-w-[80%]",
                  message.role === 'user' && "items-end"
                )}>
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    message.role === 'assistant' 
                      ? "bg-secondary text-foreground rounded-tl-none" 
                      : "bg-primary text-primary-foreground rounded-tr-none"
                  )}>
                    <div className="whitespace-pre-wrap">
                      {parseMessageWithImages(message.content)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className={cn("w-8 h-8", config.bgColor)}>
                  <AvatarFallback>
                    <Bot className={cn("w-4 h-4", config.textColor)} />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-secondary rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
                  placeholder={onboardingContent.chatPlaceholder}
              disabled={isLoading}
              className="flex-1"
              aria-label="Test message input"
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isLoading}
              size="icon"
              aria-label="Send test message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              Testing: {config.name} • Press Enter to send
            </p>
            <Badge variant="outline" className="text-xs">
              {displayMessages.length - 1} messages
            </Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
