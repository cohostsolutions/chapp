import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { trackEvent } from '@/hooks/useAnalyticsTracking';
import { LeadCaptureDialog, type LeadCapturePrefilledAgent } from '@/components/landing/LeadCaptureDialog';
import { AgentDetailsDialog } from '@/components/landing/AgentDetailsDialog';
import { AITestChat } from '@/components/landing/AITestChat';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { Footer } from '@/components/landing/Footer';
import { PageTransition } from '@/components/landing/PageTransition';
import { CursorGlow } from '@/components/landing/CursorGlow';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { BackToTop } from '@/components/shared/BackToTop';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { aiAgentsHeaderLinks } from '@/constants/publicSite';
import { WebPageSchema, ProductSchema, BreadcrumbSchema, SEOMeta } from '@/components/seo/StructuredData';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useParallax } from '@/hooks/useParallax';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, MessageSquare, Calendar, Users, Zap, Shield, Globe, Clock, Check, AlertCircle, Bot } from 'lucide-react';
import { AGENTS } from '@/constants/agents';
import { AgentComparisonTable } from '@/components/ai-agents/AgentComparisonTable';
import { TestimonialsSection } from '@/components/ai-agents/TestimonialsSection';
import { AgentVideoDemo } from '@/components/ai-agents/AgentVideoDemo';

const sharedFeatures = [
  { icon: MessageSquare, title: 'Meta Integration', description: 'Connect to Facebook Messenger, WhatsApp, and Instagram DMs' },
  { icon: Calendar, title: 'Google Calendar Sync', description: 'Automatic scheduling and calendar management' },
  { icon: Globe, title: 'Multi-Language', description: 'Support for English, Tagalog, and code-mixed languages' },
  { icon: Users, title: 'Configurable Handoff Workflow', description: 'Switch between AI and human agents using your organization\'s takeover and handback rules' },
  { icon: Zap, title: '24/7 Availability', description: 'Never miss a lead or customer inquiry' },
  { icon: Shield, title: 'Knowledge Base', description: 'Train your AI with your business information' },
];

export default function AIAgents() {
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [prefilledAgent, setPrefilledAgent] = useState<LeadCapturePrefilledAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<typeof AGENTS[0] | null>(null);
  
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation<HTMLDivElement>();
  const parallaxOffset = useParallax(0.3);
  const liveDemoRef = useRef<HTMLElement | null>(null);
  
  // Scroll to top on page load
  useScrollRestoration();

  const openLeadDialog = (agent: typeof AGENTS[number] | null = null) => {
    setPrefilledAgent(agent ? {
      type: agent.name.toLowerCase() as LeadCapturePrefilledAgent['type'],
      name: agent.name,
      role: agent.role,
    } : null);
    setLeadDialogOpen(true);
  };

  const handleLeadDialogOpenChange = (open: boolean) => {
    setLeadDialogOpen(open);
    if (!open) {
      setPrefilledAgent(null);
    }
  };

  const scrollToLiveDemo = () => {
    liveDemoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background overflow-hidden">
        <SkipToContent targetId="main-content" />
        {/* SEO Meta Tags */}
        <SEOMeta
          title="AI Agents - Meet Jay, May & Cece"
          description="Meet our AI team: Jay for sales, May for food businesses, and Cece for hotels. Ready-to-deploy AI agents with 24/7 availability."
          url="https://alcornexus.com/ai-agents"
        />
        <WebPageSchema
          title="AlCor Nexus AI Agents"
          description="Meet our AI team: Jay for sales qualification, May for food ordering, and Cece for hotel concierge. Deploy in hours, not weeks."
          url="https://alcornexus.com/ai-agents"
        />
        {AGENTS.map(agent => (
          <ProductSchema
            key={agent.name}
            name={`${agent.name} AI Agent - ${agent.role}`}
            description={agent.description}
            price={agent.price}
          />
        ))}
        <BreadcrumbSchema
          items={[
            { name: 'Home', url: 'https://alcornexus.com' },
            { name: 'AI Agents', url: 'https://alcornexus.com/ai-agents' },
          ]}
        />
        <ScrollProgress />
        <CursorGlow />
        
        {/* Background Effects */}
        <div 
          className="fixed inset-0 pointer-events-none" 
          aria-hidden="true"
          style={{ transform: `translateY(${parallaxOffset}px)` }}
        >
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
        </div>

        <StickyHeader
          links={aiAgentsHeaderLinks}
          ctaLabel="Get Started"
          onCtaClick={() => openLeadDialog()}
        />

        <BackToTop />

        <main id="main-content" tabIndex={-1} className="relative z-10" role="main" aria-label="AI agents page main content">
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-6 pt-16 pb-24">
            <div className="text-center max-w-3xl mx-auto animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Bot className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">Standard AI Agents</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
                <span className="text-foreground">Meet Your</span>
                <br />
                <span className="gradient-text">AI Team</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                Ready-to-deploy AI agents for sales, food businesses, and hospitality. 
                Set up in hours, not weeks.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="xl" 
                  variant="glow" 
                  onClick={() => {
                    trackEvent({
                      eventType: 'interaction',
                      eventCategory: 'ai_agents',
                      eventAction: 'demo_scrolled',
                      eventLabel: 'hero_section'
                    });
                    scrollToLiveDemo();
                  }}
                >
                  Try Live Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="xl" 
                  variant="outline" 
                  asChild
                  onClick={() => {
                    trackEvent({
                      eventType: 'navigation',
                      eventCategory: 'ai_agents',
                      eventAction: 'pricing_clicked',
                      eventLabel: 'hero_section'
                    });
                  }}
                >
                  <Link to="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Agent Cards */}
          <section className="py-16 bg-card/30">
            <div className="max-w-7xl mx-auto px-6">
              <div 
                ref={cardsRef}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                {AGENTS.map((agent, index) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={cardsVisible ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      trackEvent({
                        eventType: 'interaction',
                        eventCategory: 'ai_agents',
                        eventAction: 'agent_selected',
                        eventLabel: agent.name.toLowerCase()
                      });
                      setSelectedAgent(agent);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        trackEvent({
                          eventType: 'interaction',
                          eventCategory: 'ai_agents',
                          eventAction: 'agent_selected',
                          eventLabel: agent.name.toLowerCase()
                        });
                        setSelectedAgent(agent);
                      }
                    }}
                    aria-label={`Learn more about ${agent.name}, the ${agent.role} AI agent`}
                    aria-expanded={selectedAgent?.name === agent.name}
                    aria-haspopup="dialog"
                    aria-controls="agent-details-dialog"
                    className={cn(
                      "relative p-8 rounded-3xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      agent.popular 
                        ? `bg-card ${agent.borderColor} shadow-lg`
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    )}
                  >
                    {/* Popular Badge with Animation */}
                    {agent.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <motion.span 
                          className="relative bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full shadow-lg shadow-primary/30"
                          initial={{ scale: 1 }}
                          animate={{ 
                            scale: [1, 1.05, 1],
                            boxShadow: [
                              '0 10px 15px -3px rgba(var(--primary), 0.3)',
                              '0 10px 25px -3px rgba(var(--primary), 0.5)',
                              '0 10px 15px -3px rgba(var(--primary), 0.3)'
                            ]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          <span className="relative z-10">⭐ Most Popular</span>
                          <motion.span 
                            className="absolute inset-0 rounded-full bg-primary"
                            animate={{ 
                              opacity: [0.5, 0.8, 0.5]
                            }}
                            transition={{ 
                              duration: 2, 
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        </motion.span>
                      </div>
                    )}
                    
                    <div className={cn(
                      "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-6",
                      agent.color
                    )}>
                      <agent.icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground">{agent.name}</h3>
                    <p className={cn("text-sm font-medium mb-4", agent.textColor)}>{agent.role}</p>
                    
                    <p className="text-muted-foreground text-sm mb-6">{agent.description}</p>
                    
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-bold text-foreground">${agent.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    
                    <ul className="space-y-2 mb-6">
                      {agent.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className={cn("w-4 h-4", agent.textColor)} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      className="w-full" 
                      variant={agent.popular ? "glow" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        trackEvent({
                          eventType: 'conversion',
                          eventCategory: 'ai_agents',
                          eventAction: 'get_started_clicked',
                          eventLabel: agent.name.toLowerCase(),
                          metadata: { location: 'agent_card' }
                        });
                        openLeadDialog(agent);
                      }}
                    >
                      Get Started with {agent.name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Agent Comparison Table */}
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-6">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-center">Compare Our AI Agents</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-center mb-8">
                See which features are included with each standard agent.
              </p>
              <AgentComparisonTable />
            </div>
          </section>

          {/* Testimonials Section */}
          <TestimonialsSection />

          {/* Agent Video Demo */}
          <AgentVideoDemo />

          {/* Shared Features */}
          <section className="py-24">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  All Agents Include
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Every standard AI agent comes with these powerful features out of the box
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sharedFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Live Demo Section */}
          <section ref={liveDemoRef} className="py-24 bg-gradient-to-b from-card/30 to-background">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500 font-medium">Live Demo</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Try Before You Buy
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Chat with our AI agents in real-time. Customize the knowledge base and 
                  see how they respond in different languages.
                </p>
              </div>

              <ErrorBoundary
                fallback={
                  <div className="max-w-2xl mx-auto p-6 text-center">
                    <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/30">
                      <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">Demo Temporarily Unavailable</h3>
                      <p className="text-muted-foreground mb-4">
                        We're having trouble loading the demo. Please try refreshing the page or contact support.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => window.location.reload()}
                      >
                        Refresh Page
                      </Button>
                    </div>
                  </div>
                }
              >
                <AITestChat onGetStarted={() => openLeadDialog()} />
              </ErrorBoundary>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <div className="p-12 rounded-3xl bg-gradient-to-b from-card to-background border border-border/50">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Ready to Automate Your Business?
                </h2>
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                  Get started with a standard AI agent today, or explore custom solutions for your unique needs.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="xl" 
                    variant="glow" 
                    onClick={() => {
                      trackEvent({
                        eventType: 'conversion',
                        eventCategory: 'ai_agents',
                        eventAction: 'get_started_clicked',
                        eventLabel: 'cta_section'
                      });
                      openLeadDialog();
                    }}
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button 
                    size="xl" 
                    variant="outline" 
                    asChild
                    onClick={() => {
                      trackEvent({
                        eventType: 'navigation',
                        eventCategory: 'ai_agents',
                        eventAction: 'custom_solutions_clicked',
                        eventLabel: 'cta_section'
                      });
                    }}
                  >
                    <Link to="/custom-solutions">
                      <Sparkles className="w-5 h-5 mr-2" />
                      Custom Solutions
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer
          links={[
            { to: '/', label: 'Home' },
            { to: '/pricing', label: 'Pricing' },
            { to: '/custom-solutions', label: 'Custom Solutions' },
            { to: '/privacy', label: 'Privacy Policy' },
            { to: '/terms', label: 'Terms & Data Usage' },
          ]}
        />

        {/* Lead Capture Dialog */}
        <LeadCaptureDialog
          open={leadDialogOpen}
          onOpenChange={handleLeadDialogOpenChange}
          prefilledAgent={prefilledAgent}
        />
        
        {/* Agent Details Dialog */}
        {selectedAgent && (
          <AgentDetailsDialog
            open={!!selectedAgent}
            onOpenChange={(open) => !open && setSelectedAgent(null)}
            agent={selectedAgent.name.toLowerCase() as 'jay' | 'may' | 'cece'}
            onGetStarted={() => {
              const currentAgent = selectedAgent;
              setSelectedAgent(null);
              openLeadDialog(currentAgent);
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}
