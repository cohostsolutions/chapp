import { useState, useRef, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Bot, Utensils, Hotel, User, Send, AlertCircle, Languages, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackEvent } from '@/hooks/useAnalyticsTracking';

type AIType = 'jay' | 'may' | 'cece';
type LanguageCode = 'en' | 'tl' | 'ceb' | 'ja' | 'zh';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const languages: { code: LanguageCode; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
  { code: 'ceb', name: 'Cebuano', flag: '🇵🇭' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳' },
];

const aiAgentConfig = {
  jay: {
    name: 'Jay',
    role: 'Sales Agent',
    icon: Bot,
    color: 'from-primary to-primary/70',
    bgColor: 'bg-primary/10',
    textColor: 'text-primary',
    defaultPrompt: 'I am a sales agent for a real estate investment company. We offer:\n- Luxury Condo (from 5.0M) [IMAGE: https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400]\n- Family Home (from 8.0M) [IMAGE: https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400]\n- Commercial Space (from 10.0M) [IMAGE: https://images.unsplash.com/photo-1497366216548-37526070297c?w=400]\nI help qualify leads, answer questions about properties, and schedule viewings.',
  },
  may: {
    name: 'May',
    role: 'Food Business',
    icon: Utensils,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
    defaultPrompt: 'I am a food ordering assistant for a Filipino restaurant. Our menu includes:\n- Crispy Pork Belly (from 280) [IMAGE: https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=400]\n- Grilled Salmon (from 350) [IMAGE: https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400]\n- Sinigang na Baboy (from 220) [IMAGE: https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400]\n- Chicken Adobo (from 180) [IMAGE: https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400]\nI take orders and schedule pickups.',
  },
  cece: {
    name: 'Cece',
    role: 'Hotel Concierge',
    icon: Hotel,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    defaultPrompt: 'I am a hotel concierge for a beachside resort. We have:\n- Deluxe Room (from 3,500 per night) [IMAGE: https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400]\n- Ocean Suite (from 5,200 per night) [IMAGE: https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400]\n- Beach Villa (from 8,000 per night) [IMAGE: https://images.unsplash.com/photo-1602002418082-dd4a7347534f?w=400]\nAll rooms include breakfast and pool access. I help with bookings and guest inquiries.',
  },
};

const MAX_AI_RESPONSES = 5;

// Parse message content to extract and render images
function parseMessageContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match image URLs in format: [IMAGE: url] or "Here's an image: url"
  const imagePatterns = [
    /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\]/gi,
    /Here's an image:\s*(https?:\/\/[^\s]+)/gi,
    /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?)/gi,
  ];
  
  let lastIndex = 0;
  const imageMatches: { index: number; length: number; url: string }[] = [];
  
  // Find all image matches
  for (const pattern of imagePatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      const url = match[1];
      if (url && !imageMatches.some(m => m.url === url)) {
        imageMatches.push({
          index: match.index,
          length: match[0].length,
          url,
        });
      }
    }
  }
  
  // Sort by index
  imageMatches.sort((a, b) => a.index - b.index);
  
  // Build parts array
  for (const img of imageMatches) {
    if (img.index > lastIndex) {
      const textBefore = content.slice(lastIndex, img.index).trim();
      if (textBefore) {
        parts.push(<span key={`text-${lastIndex}`}>{textBefore}</span>);
      }
    }
    parts.push(
      <img
        key={`img-${img.index}`}
        src={img.url}
        alt="Shared content"
        className="rounded-lg max-w-full mt-2 mb-1 shadow-sm"
        style={{ maxHeight: '150px' }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
    lastIndex = img.index + img.length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      parts.push(<span key={`text-${lastIndex}`}>{remainingText}</span>);
    }
  }
  
  return parts.length > 0 ? parts : [<span key="content">{content}</span>];
}

interface AITestChatProps {
  onGetStarted: () => void;
}

export function AITestChat({ onGetStarted }: AITestChatProps) {
  const [selectedAI, setSelectedAI] = useState<AIType>('jay');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [knowledgeBase, setKnowledgeBase] = useState(aiAgentConfig.jay.defaultPrompt);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  

  const config = aiAgentConfig[selectedAI];
  const aiResponseCount = messages.filter(m => m.role === 'assistant').length;
  const hasReachedLimit = aiResponseCount >= MAX_AI_RESPONSES;

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Reset when AI changes
  useEffect(() => {
    // Show notification when switching agents if there are messages
    if (messages.length > 0) {
      toast.info(`Switched to ${aiAgentConfig[selectedAI].name}. Chat history cleared.`);
    }
    
    setMessages([]);
    setKnowledgeBase(aiAgentConfig[selectedAI].defaultPrompt);
    setInputValue('');
    // Note: Language persists across agent switches for better UX
  }, [selectedAI]);

  // Scroll to bottom on new messages - only within the chat container
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    // Check if user is online
    if (!isOnline) {
      toast.error('Demo requires internet connection. Please check your connection.');
      return;
    }

    if (!inputValue.trim() || hasReachedLimit || isTyping) return;

    // Track message send
    trackEvent({
      eventType: 'interaction',
      eventCategory: 'demo_chat',
      eventAction: 'message_sent',
      eventLabel: selectedAI,
      metadata: {
        language: selectedLanguage,
        messageLength: inputValue.trim().length,
        totalMessages: messages.length + 1
      }
    });

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      // Call the demo AI edge function
      const { data, error } = await supabase.functions.invoke('demo-ai-chat', {
        body: {
          message: userMessage.content,
          agentType: selectedAI,
          language: selectedLanguage,
          knowledgeBase,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) {
        throw error;
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response || "I'm sorry, I couldn't process that request.",
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      devError('Demo AI error:', error);
      
      // Remove the user message since we failed to get a response
      setMessages(messages);
      
      // Determine error type and provide specific feedback
      let errorMessage = 'Demo temporarily unavailable. Please try again.';
      let showRetry = true;
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('time')) {
          errorMessage = 'Request took too long. Please try with a shorter message.';
        } else if (error.message.includes('rate')) {
          errorMessage = 'Too many requests. Please wait a moment before trying again.';
          showRetry = false;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection.';
        }
      }
      
      toast.error(errorMessage);
      
      // Show retry UI if appropriate
      if (showRetry) {
        const retryMessage: Message = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${errorMessage}\n\nYou can try again now.`,
        };
        setMessages(prev => [...prev, retryMessage]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* AI Selection Tabs */}
      <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
        {(Object.keys(aiAgentConfig) as AIType[]).map((ai) => {
          const agentConfig = aiAgentConfig[ai];
          return (
            <button
              key={ai}
              onClick={() => {
                if (selectedAI !== ai) {
                  trackEvent({
                    eventType: 'interaction',
                    eventCategory: 'demo_chat',
                    eventAction: 'agent_switched',
                    eventLabel: `${selectedAI}_to_${ai}`
                  });
                }
                setSelectedAI(ai);
              }}
              aria-current={selectedAI === ai ? 'page' : undefined}
              aria-label={`Select ${agentConfig.name} AI agent`}
              type="button"
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-300 text-sm sm:text-base",
                selectedAI === ai
                  ? `${agentConfig.bgColor} ${agentConfig.textColor} font-medium ring-2 ring-offset-2 ring-offset-background ring-current`
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <agentConfig.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{agentConfig.name}</span>
            </button>
          );
        })}
      </div>

      {/* Language Selection */}
      <div className="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2">
          <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          <span className="text-xs sm:text-sm text-muted-foreground">Language:</span>
        </div>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => {
              if (selectedLanguage !== lang.code) {
                trackEvent({
                  eventType: 'interaction',
                  eventCategory: 'demo_chat',
                  eventAction: 'language_changed',
                  eventLabel: `${selectedLanguage}_to_${lang.code}`,
                  metadata: { agent: selectedAI }
                });
              }
              setSelectedLanguage(lang.code);
            }}
            aria-current={selectedLanguage === lang.code ? 'page' : undefined}
            aria-label={`Select ${lang.name}`}
            type="button"
            className={cn(
              "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-all duration-300",
              selectedLanguage === lang.code
                ? "bg-primary/20 text-primary font-medium ring-1 ring-primary/50"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>{lang.flag}</span>
            <span className="hidden xs:inline sm:inline">{lang.name}</span>
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto">
        <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">
          Knowledge Base (customize what {config.name} knows)
        </label>
        <Textarea
          value={knowledgeBase}
          onChange={(e) => setKnowledgeBase(e.target.value)}
          placeholder={`Enter information ${config.name} should know about your business...`}
          className="min-h-[60px] sm:min-h-[80px] text-xs sm:text-sm bg-muted/30"
        />
      </div>

      {/* Chat Window */}
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-lg sm:shadow-xl overflow-hidden">
          {/* Chat Header */}
          <div className={cn("flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-border", config.bgColor)}>
            <div className={cn(
              "w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br flex items-center justify-center",
              config.color
            )}>
              <config.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-sm sm:text-base">{config.name} AI</p>
              <p className="text-[10px] sm:text-xs text-foreground/70 truncate">
                Live Demo • {MAX_AI_RESPONSES - aiResponseCount} responses left
              </p>
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={chatContainerRef} 
            className="p-3 sm:p-4 min-h-[220px] sm:min-h-[280px] max-h-[280px] sm:max-h-[350px] overflow-y-auto space-y-2 sm:space-y-3 bg-muted/20"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center p-4 sm:p-8">
                <div className="space-y-2">
                  <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Send the first message to start chatting with {config.name}!
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground/70">
                    Try: "Hello" or ask about pricing/availability
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-2",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className={cn(
                      "w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0",
                      config.color
                    )}>
                      <config.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] px-3 py-2 rounded-2xl text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    )}
                  >
                    {message.role === 'assistant' 
                      ? parseMessageContent(message.content)
                      : message.content
                    }
                  </div>
                  {message.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2"
              >
                <div className={cn(
                  "w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0",
                  config.color
                )}>
                  <config.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2">
                  <div className="flex gap-1 items-center">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

          {/* Input Bar */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-border bg-card flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={hasReachedLimit ? "Demo limit reached" : "Type a message..."}
              disabled={hasReachedLimit || isTyping}
              className="flex-1 px-3 sm:px-4 py-2 rounded-full bg-muted/50 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || hasReachedLimit || isTyping}
              aria-label="Send message"
              aria-disabled={!inputValue.trim() || hasReachedLimit || isTyping}
              type="button"
              className={cn(
                "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors shrink-0",
                inputValue.trim() && !hasReachedLimit && !isTyping
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Get Started CTA when limit reached */}
        {hasReachedLimit && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
            onAnimationComplete={() => {
              trackEvent({
                eventType: 'interaction',
                eventCategory: 'demo_chat',
                eventAction: 'limit_reached',
                eventLabel: selectedAI,
                metadata: { language: selectedLanguage }
              });
            }}
          >
            <Button 
              variant="glow" 
              size="lg" 
              onClick={() => {
                trackEvent({
                  eventType: 'conversion',
                  eventCategory: 'demo_chat',
                  eventAction: 'get_started_after_limit',
                  eventLabel: config.name.toLowerCase()
                });
                onGetStarted();
              }}
            >
              Get Started with {config.name}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
