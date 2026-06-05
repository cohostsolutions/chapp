import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  Utensils, 
  Hotel, 
  CheckCircle2, 
  Zap, 
  Clock, 
  MessageSquare, 
  Calendar,
  TrendingUp,
  Users,
  Brain,
  Shield,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: 'jay' | 'may' | 'cece' | null;
  onGetStarted: () => void;
}

const agentDetails = {
  jay: {
    name: 'Jay AI',
    role: 'Sales & Lead Qualification Agent',
    icon: Bot,
    gradient: 'from-primary to-primary/70',
    tagline: 'Your 24/7 Sales Team Member',
    description: "Jay is designed to be the first point of contact for your potential customers. With advanced conversational intelligence, Jay engages leads naturally, understands their needs, and nurtures them until they're ready to buy.",
    capabilities: [
      {
        icon: Brain,
        title: 'Intelligent Lead Qualification',
        description: 'Automatically assesses lead readiness using sophisticated conversation analysis, identifying hot prospects who are ready for human engagement.'
      },
      {
        icon: MessageSquare,
        title: 'Natural Conversations',
        description: 'Engages prospects in fluid, context-aware dialogues that feel genuinely human, building rapport and trust from the first interaction.'
      },
      {
        icon: TrendingUp,
        title: 'Progressive Lead Nurturing',
        description: "Continuously warms up cold leads through strategic follow-ups and personalized messaging tailored to each prospect's journey."
      },
      {
        icon: Calendar,
        title: 'Smart Scheduling',
        description: 'Automatically books callbacks and meetings with your sales team when leads reach peak interest, ensuring no opportunity slips away.'
      },
      {
        icon: Users,
        title: 'Seamless Agent Handoff',
        description: 'Knows exactly when to transition conversations to human agents, providing complete context so your team can close deals faster.'
      },
      {
        icon: Zap,
        title: 'Instant Response',
        description: 'Responds within seconds across all connected channels, capturing leads while their interest is at its peak.'
      }
    ],
    highlights: [
      'Works across Facebook, WhatsApp & Instagram',
      'Learns from your knowledge base',
      'Temperature-based lead scoring',
      'Real-time agent alerts for hot leads'
    ]
  },
  may: {
    name: 'May AI',
    role: 'Food Business Front Desk Agent',
    icon: Utensils,
    gradient: 'from-orange-500 to-amber-500',
    tagline: 'Your Restaurant Never Sleeps',
    description: 'May transforms how food businesses handle customer interactions. From answering menu questions to processing orders and scheduling pickups, May ensures your customers get instant service any time they reach out.',
    capabilities: [
      {
        icon: MessageSquare,
        title: 'Menu Intelligence',
        description: 'Answers detailed questions about dishes, ingredients, allergens, and recommendations with deep knowledge of your entire menu.'
      },
      {
        icon: Sparkles,
        title: 'Order Processing',
        description: 'Takes complete food orders conversationally, handling modifications, special requests, and multiple items with perfect accuracy.'
      },
      {
        icon: Calendar,
        title: 'Pickup Scheduling',
        description: 'Coordinates pickup times that work for both your kitchen capacity and customer preferences, reducing wait times and no-shows.'
      },
      {
        icon: Clock,
        title: 'Real-Time Availability',
        description: 'Knows which items are available and can suggest alternatives when something is out of stock, keeping orders flowing smoothly.'
      },
      {
        icon: Users,
        title: 'Customer Memory',
        description: 'Remembers regular customers and their preferences, creating personalized experiences that build loyalty and repeat orders.'
      },
      {
        icon: TrendingUp,
        title: 'Upselling Intelligence',
        description: 'Naturally suggests complementary items and promotions that increase average order value without being pushy.'
      }
    ],
    highlights: [
      'Integrated order management dashboard',
      'Menu items & pricing management',
      'Pickup time optimization',
      'Multi-language support for diverse customers'
    ]
  },
  cece: {
    name: 'Cece AI',
    role: 'Hotel & Hospitality Concierge',
    icon: Hotel,
    gradient: 'from-emerald-500 to-teal-500',
    tagline: 'Luxury Service, Automated',
    description: 'Cece brings the warmth and efficiency of a world-class concierge to your hospitality business. From handling booking inquiries to managing reservations, Cece delivers exceptional guest experiences around the clock.',
    capabilities: [
      {
        icon: Calendar,
        title: 'Booking Management',
        description: 'Handles the complete booking lifecycle from initial inquiry to confirmation, modifications, and even cancellations with grace.'
      },
      {
        icon: Clock,
        title: 'Real-Time Availability',
        description: 'Instantly checks room availability across your property, synced with your calendar to prevent double-bookings and maximize occupancy.'
      },
      {
        icon: MessageSquare,
        title: 'Property Expert',
        description: 'Answers detailed questions about rooms, amenities, policies, and local attractions with comprehensive knowledge of your property.'
      },
      {
        icon: Users,
        title: 'Guest Personalization',
        description: 'Remembers guest preferences and history, enabling personalized recommendations and VIP treatment for returning guests.'
      },
      {
        icon: Sparkles,
        title: 'Special Requests',
        description: 'Handles special accommodations, celebrations, and unique requests, ensuring every stay feels tailored and memorable.'
      },
      {
        icon: TrendingUp,
        title: 'Revenue Optimization',
        description: 'Suggests room upgrades and add-on services at the right moments, increasing revenue while enhancing guest satisfaction.'
      }
    ],
    highlights: [
      'Visual room availability calendar',
      'Google Calendar synchronization',
      'Room unit & amenity management',
      'Booking modification & cancellation handling'
    ]
  }
};

const agentOrder: Array<'jay' | 'may' | 'cece'> = ['jay', 'may', 'cece'];

export function AgentDetailsDialog({ open, onOpenChange, agent, onGetStarted }: AgentDetailsDialogProps) {
  const [currentAgent, setCurrentAgent] = useState<'jay' | 'may' | 'cece' | null>(agent);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (agent) {
      setCurrentAgent(agent);
    }
  }, [agent]);

  if (!currentAgent) return null;
  
  const details = agentDetails[currentAgent];
  const Icon = details.icon;
  const currentIndex = agentOrder.indexOf(currentAgent);

  const navigateAgent = (dir: 'prev' | 'next') => {
    const newIndex = dir === 'next' 
      ? (currentIndex + 1) % agentOrder.length 
      : (currentIndex - 1 + agentOrder.length) % agentOrder.length;
    setDirection(dir === 'next' ? 1 : -1);
    setCurrentAgent(agentOrder[newIndex]);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id="agent-details-dialog" className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {/* Navigation Arrows */}
        <button
          onClick={() => navigateAgent('prev')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-card/80 border border-border hover:bg-muted transition-colors"
          aria-label="Previous agent"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button
          onClick={() => navigateAgent('next')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-card/80 border border-border hover:bg-muted transition-colors"
          aria-label="Next agent"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>

        {/* Agent Indicator Dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
          {agentOrder.map((agentKey) => (
            <button
              key={agentKey}
              onClick={() => {
                setDirection(agentOrder.indexOf(agentKey) > currentIndex ? 1 : -1);
                setCurrentAgent(agentKey);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                currentAgent === agentKey 
                  ? "w-6 bg-primary" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`View ${agentDetails[agentKey].name}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentAgent}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
          >
            <DialogHeader className="pb-4 border-b border-border mt-4">
              <div className="flex items-center gap-4">
                <motion.div 
                  className={cn(
                    "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                    details.gradient
                  )}
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Icon className="w-8 h-8 text-white" />
                </motion.div>
                <div>
                  <DialogTitle className="text-2xl font-bold">{details.name}</DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground">
                    {details.role}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-8 py-6">
              {/* Tagline */}
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p className="text-xl font-semibold gradient-text">{details.tagline}</p>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                  {details.description}
                </p>
              </motion.div>

              {/* Capabilities Grid */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Core Capabilities
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {details.capabilities.map((capability, index) => (
                    <motion.div 
                      key={capability.title}
                      className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + index * 0.05 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0",
                          details.gradient
                        )}>
                          <capability.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{capability.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{capability.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Highlights */}
              <motion.div 
                className="bg-muted/30 rounded-xl p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  What You Get
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {details.highlights.map((highlight, index) => (
                    <motion.div 
                      key={highlight} 
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + index * 0.05 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-foreground">{highlight}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* CTA */}
              <motion.div 
                className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-muted-foreground text-center">
                  Ready to put {details.name} to work for your business?
                </p>
                <Button 
                  variant="glow" 
                  onClick={() => {
                    onOpenChange(false);
                    onGetStarted();
                  }}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
