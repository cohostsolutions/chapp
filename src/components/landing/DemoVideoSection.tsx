import { useState, useEffect } from 'react';
import { Facebook, MessageCircle, Instagram, Bot, User, ArrowRight, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AITestChat } from './AITestChat';

type LanguageCode = 'en' | 'tl' | 'ceb' | 'ja' | 'zh';

const languages: { code: LanguageCode; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
  { code: 'ceb', name: 'Cebuano', flag: '🇵🇭' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳' },
];

interface SocialMessage {
  id: number;
  platform: 'facebook' | 'whatsapp' | 'instagram';
  role: 'user' | 'ai';
  content: Record<LanguageCode, string>;
}

const socialConversation: SocialMessage[] = [
  { 
    id: 1, platform: 'facebook', role: 'user', 
    content: { 
      en: "Hi! I saw your ad. Do you have rooms available?",
      tl: "Hi! Nakita ko yung ad nyo. May available ba kayong rooms?",
      ceb: "Hi! Nakita nako ang inyong ad. Naa bay available nga rooms?",
      ja: "こんにちは！広告を見ました。空室はありますか？",
      zh: "你好！我看到了你们的广告。有空房吗？"
    }
  },
  { 
    id: 2, platform: 'facebook', role: 'ai', 
    content: { 
      en: "Hello! 👋 Yes, we have availability! What dates are you looking at?",
      tl: "Hello! 👋 Oo, meron kaming available! Anong dates ang gusto mo?",
      ceb: "Hello! 👋 Oo, naa mi available! Unsa nga mga petsa ang imong gipangita?",
      ja: "こんにちは！👋 はい、空室があります！いつのご予定ですか？",
      zh: "你好！👋 是的，我们有空房！您想要哪几天？"
    }
  },
  { 
    id: 3, platform: 'whatsapp', role: 'user', 
    content: { 
      en: "Can I order food for pickup?",
      tl: "Pwede ba akong mag-order ng food for pickup?",
      ceb: "Pwede ba ko mag-order ug pagkaon para pickup?",
      ja: "テイクアウトで注文できますか？",
      zh: "我可以点外卖自取吗？"
    }
  },
  { 
    id: 4, platform: 'whatsapp', role: 'ai', 
    content: { 
      en: "Of course! Today's special: Crispy Pork Belly for 280. When would you like to pick up?",
      tl: "Siyempre! Special ngayon: Crispy Pork Belly for 280. Anong oras mo gustong i-pickup?",
      ceb: "Oo! Special karon: Crispy Pork Belly for 280. Kanus-a nimo gusto i-pickup?",
      ja: "もちろんです！本日のスペシャル：クリスピーポークベリー 280。何時にお受け取りですか？",
      zh: "当然可以！今日特餐：脆皮五花肉 280。您想几点取餐？"
    }
  },
  { 
    id: 5, platform: 'instagram', role: 'user', 
    content: { 
      en: "What properties do you have under 3M?",
      tl: "Anong properties meron kayo na below 3M?",
      ceb: "Unsa nga mga properties ang naa mo ubos sa 3M?",
      ja: "300万以下の物件は何がありますか？",
      zh: "你们有300万以下的房产吗？"
    }
  },
  { 
    id: 6, platform: 'instagram', role: 'ai', 
    content: { 
      en: "We have 5 properties in that range! Want me to schedule a viewing? 🏠",
      tl: "Meron kaming 5 properties sa range na yan! Gusto mo ba mag-schedule ng viewing? 🏠",
      ceb: "Naa mi 5 ka properties sa maong range! Gusto ba nimo mag-schedule ug viewing? 🏠",
      ja: "その価格帯で5件あります！内見のスケジュールを組みましょうか？🏠",
      zh: "我们有5套这个价位的房产！需要我安排看房吗？🏠"
    }
  },
];

const platformConfig = {
  facebook: {
    icon: Facebook,
    bg: 'bg-blue-500',
    name: 'Messenger',
    headerBg: 'bg-gradient-to-r from-blue-500 to-blue-600',
  },
  whatsapp: {
    icon: MessageCircle,
    bg: 'bg-green-500',
    name: 'WhatsApp',
    headerBg: 'bg-gradient-to-r from-green-500 to-green-600',
  },
  instagram: {
    icon: Instagram,
    bg: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
    name: 'Instagram',
    headerBg: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
  },
};

interface SocialChatAnimationProps {
  language: LanguageCode;
}

function SocialChatAnimation({ language }: SocialChatAnimationProps) {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'facebook' | 'whatsapp' | 'instagram'>('facebook');

  // Reset animation when language changes
  useEffect(() => {
    setVisibleMessages([]);
    setCurrentIndex(0);
    setIsTyping(false);
  }, [language]);

  useEffect(() => {
    if (currentIndex >= socialConversation.length) {
      const resetTimer = setTimeout(() => {
        setVisibleMessages([]);
        setCurrentIndex(0);
      }, 4000);
      return () => clearTimeout(resetTimer);
    }

    const message = socialConversation[currentIndex];
    setActivePlatform(message.platform);

    if (message.role === 'ai') {
      setIsTyping(true);
      const typingTimer = setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => [...prev, message.id]);
        setCurrentIndex(prev => prev + 1);
      }, 1500);
      return () => clearTimeout(typingTimer);
    } else {
      const timer = setTimeout(() => {
        setVisibleMessages(prev => [...prev, message.id]);
        setCurrentIndex(prev => prev + 1);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, language]);

  const platformCfg = platformConfig[activePlatform];
  const PlatformIcon = platformCfg.icon;

  return (
    <div className="relative aspect-[4/3] flex flex-col">
      {/* Platform Indicators */}
      <div className="flex justify-center gap-3 mb-4">
        {(['facebook', 'whatsapp', 'instagram'] as const).map((platform) => {
          const cfg = platformConfig[platform];
          const Icon = cfg.icon;
          return (
            <div
              key={platform}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                activePlatform === platform 
                  ? `${cfg.bg} text-white scale-110 shadow-lg` 
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          );
        })}
      </div>

      {/* Chat Window */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden flex-1 flex flex-col">
        {/* Dynamic Header */}
        <div className={cn("flex items-center gap-3 px-4 py-3", platformCfg.headerBg)}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <PlatformIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{platformCfg.name}</p>
            <p className="text-xs text-white/70">AI Agent Active</p>
          </div>
          <div className="ml-auto">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 flex-1 overflow-hidden space-y-3 bg-background/50">
          <AnimatePresence>
            {socialConversation
              .filter(msg => visibleMessages.includes(msg.id))
              .map((message) => {
                const msgPlatform = platformConfig[message.platform];
                const MsgIcon = msgPlatform.icon;
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-2",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'ai' && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {message.role === 'user' && (
                        <div className="flex items-center gap-1 justify-end">
                          <MsgIcon className={cn("w-3 h-3", message.platform === 'facebook' ? 'text-blue-500' : message.platform === 'whatsapp' ? 'text-green-500' : 'text-pink-500')} />
                          <span className="text-[10px] text-muted-foreground">{msgPlatform.name}</span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[200px] px-3 py-2 rounded-2xl text-xs",
                          message.role === 'user'
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        )}
                      >
                        {message.content[language]}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
          </AnimatePresence>

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-3">
        One AI handles all your social channels automatically
      </p>
    </div>
  );
}

interface DemoVideoSectionProps {
  onGetStarted: () => void;
}

export function DemoVideoSection({ onGetStarted }: DemoVideoSectionProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();
  const [showTestChat, setShowTestChat] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  return (
    <>
      <section id="try-ai" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              See AI Integration in Action
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Watch how our AI agents seamlessly integrate with your social media channels, 
              or try chatting with them yourself!
            </p>
            
            {/* Language Selector */}
            <div className="flex justify-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 mr-2">
                <Languages className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Language:</span>
              </div>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-300",
                    selectedLanguage === lang.code
                      ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/50"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div ref={ref} className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Social Chat Animation */}
            <div 
              className={cn(
                "transition-all duration-700",
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
              )}
            >
              <SocialChatAnimation language={selectedLanguage} />
            </div>

            {/* Content + CTA */}
            <div 
              className={cn(
                "transition-all duration-700",
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
              )}
              style={{ transitionDelay: isVisible ? '100ms' : '0ms' }}
            >
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Connect Your Channels</h3>
                    <p className="text-sm text-muted-foreground">Link Facebook, WhatsApp, and Instagram in minutes</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Train Your AI</h3>
                    <p className="text-sm text-muted-foreground">Upload your knowledge base and customize responses</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Watch Leads Convert</h3>
                    <p className="text-sm text-muted-foreground">AI qualifies leads 24/7 while you focus on closing</p>
                  </div>
                </div>
              </div>

              <Button 
                size="lg" 
                variant="glow" 
                onClick={() => setShowTestChat(true)}
                className="w-full sm:w-auto"
              >
                Try Our AI Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Test Chat Dialog */}
      <Dialog open={showTestChat} onOpenChange={setShowTestChat}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Try Our AI Agents</DialogTitle>
          </DialogHeader>
          <AITestChat onGetStarted={() => {
            setShowTestChat(false);
            onGetStarted();
          }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
