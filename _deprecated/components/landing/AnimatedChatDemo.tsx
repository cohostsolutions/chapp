import { useState, useEffect } from 'react';
import { Bot, Utensils, Hotel, User, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface AgentDemo {
  name: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
  messages: Message[];
}

const agentDemos: AgentDemo[] = [
  {
    name: 'Jay',
    icon: Bot,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    messages: [
      { role: 'user', content: 'Hi, I saw your ad about investment properties' },
      { role: 'ai', content: 'Hello! Thanks for reaching out. I\'d love to help you find the perfect investment property. Are you looking for residential or commercial?' },
      { role: 'user', content: 'Residential, around 2-3M budget' },
      { role: 'ai', content: 'Great choice! We have several properties in that range. I\'ll connect you with one of our specialists who can show you our top picks. When\'s a good time for a call?' },
    ],
  },
  {
    name: 'May',
    icon: Utensils,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    messages: [
      { role: 'user', content: 'What\'s on your menu today?' },
      { role: 'ai', content: 'Hi! Today\'s specials: Crispy Pork Belly (₱280), Grilled Salmon (₱350), and our famous Sinigang na Baboy (₱220). What sounds good?' },
      { role: 'user', content: 'I\'ll take the pork belly and sinigang for pickup' },
      { role: 'ai', content: 'Perfect! Crispy Pork Belly + Sinigang = ₱500. What time would you like to pick up? We can have it ready in 30 mins!' },
    ],
  },
  {
    name: 'Cece',
    icon: Hotel,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    messages: [
      { role: 'user', content: 'Do you have rooms available this weekend?' },
      { role: 'ai', content: 'Hi! Let me check for you. For this weekend (Dec 7-8), we have: Deluxe Room (₱3,500/night), Suite (₱5,200/night). How many guests?' },
      { role: 'user', content: '2 adults, we\'d like the suite please' },
      { role: 'ai', content: 'Excellent choice! Suite for 2 adults, Dec 7-8 = ₱5,200. Includes breakfast & pool access. Should I book this for you?' },
    ],
  },
];

export function AnimatedChatDemo() {
  const [activeAgent, setActiveAgent] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const currentDemo = agentDemos[activeAgent];

  useEffect(() => {
    setVisibleMessages(0);
    setIsTyping(false);
  }, [activeAgent]);

  useEffect(() => {
    if (visibleMessages < currentDemo.messages.length) {
      const isAIMessage = currentDemo.messages[visibleMessages]?.role === 'ai';
      
      if (isAIMessage) {
        setIsTyping(true);
        const typingTimer = setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages(prev => prev + 1);
        }, 1500);
        return () => clearTimeout(typingTimer);
      } else {
        const timer = setTimeout(() => {
          setVisibleMessages(prev => prev + 1);
        }, 1000);
        return () => clearTimeout(timer);
      }
    } else {
      // Cycle to next agent after showing all messages
      const cycleTimer = setTimeout(() => {
        setActiveAgent(prev => (prev + 1) % agentDemos.length);
      }, 3000);
      return () => clearTimeout(cycleTimer);
    }
  }, [visibleMessages, currentDemo.messages.length, activeAgent]);

  return (
    <section className="py-24 bg-card/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            See Our AI Agents in Action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Watch how Jay, May, and Cece handle real customer conversations automatically.
          </p>
        </div>

        {/* Agent Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {agentDemos.map((agent, index) => (
            <button
              key={agent.name}
              onClick={() => setActiveAgent(index)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
                activeAgent === index
                  ? `${agent.bgColor} ${agent.color} font-medium`
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <agent.icon className="w-4 h-4" />
              <span>{agent.name}</span>
            </button>
          ))}
        </div>

        {/* Chat Window */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
            {/* Chat Header */}
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 border-b border-border",
              currentDemo.bgColor
            )}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-card",
                currentDemo.color
              )}>
                <currentDemo.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{currentDemo.name} AI</p>
                <p className="text-xs text-foreground/70">Online • Responds instantly</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-foreground/70">Active</span>
              </div>
            </div>

            {/* Messages */}
            <div className="p-4 min-h-[320px] space-y-4 bg-muted/20">
              {currentDemo.messages.slice(0, visibleMessages).map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 animate-fade-in",
                    message.role === 'user' ? "flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    message.role === 'user' 
                      ? "bg-muted" 
                      : currentDemo.bgColor
                  )}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <currentDemo.icon className={cn("w-4 h-4", currentDemo.color)} />
                    )}
                  </div>
                  <div className={cn(
                    "max-w-[75%] px-4 py-2 rounded-2xl text-sm",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm text-foreground"
                  )}>
                    {message.content}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    currentDemo.bgColor
                  )}>
                    <currentDemo.icon className={cn("w-4 h-4", currentDemo.color)} />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar (Decorative) */}
            <div className="px-4 py-3 border-t border-border bg-card flex items-center gap-2">
              <div className="flex-1 px-4 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground">
                Type a message...
              </div>
              <button aria-label="Send message" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {agentDemos.map((agent, index) => (
              <button
                key={index}
                onClick={() => setActiveAgent(index)}
                aria-label={`View ${agent.name} AI demo`}
                className={cn(
                  "h-6 min-w-6 p-2 rounded-full transition-all duration-300 flex items-center justify-center",
                  activeAgent === index ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "block rounded-full",
                  activeAgent === index ? "w-4 h-1 bg-primary-foreground" : "w-1 h-1 bg-foreground/50"
                )} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
