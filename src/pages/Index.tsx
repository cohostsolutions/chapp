import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { Footer } from '@/components/landing/Footer';
import { ParticleBackground } from '@/components/landing/ParticleBackground';
import { MorphingBlobs } from '@/components/landing/MorphingBlobs';
import { PageTransition } from '@/components/landing/PageTransition';
import { CursorGlow } from '@/components/landing/CursorGlow';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { TextReveal, TextRevealByWord } from '@/components/landing/TextReveal';
import { landingFaqs } from '@/components/landing/faqData';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { BackToTop } from '@/components/shared/BackToTop';
import { homeHeaderLinks } from '@/constants/publicSite';
import { SoftwareApplicationSchema, FAQSchema, SEOMeta } from '@/components/seo/StructuredData';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useParallax } from '@/hooks/useParallax';
import { useCounterAnimation } from '@/hooks/useCounterAnimation';
import { useTypingAnimation } from '@/hooks/useTypingAnimation';
import { useMagnetic } from '@/hooks/useMagnetic';
import { cn } from '@/lib/utils';

// Lazy load heavy below-the-fold components
const FAQSection = lazy(() => import('@/components/landing/FAQSection').then(m => ({ default: m.FAQSection })));
const TestimonialsCarousel = lazy(() => import('@/components/landing/TestimonialsCarousel').then(m => ({ default: m.TestimonialsCarousel })));
const LeadCaptureDialog = lazy(() => import('@/components/landing/LeadCaptureDialog').then(m => ({ default: m.LeadCaptureDialog })));
const AgentDetailsDialog = lazy(() => import('@/components/landing/AgentDetailsDialog').then(m => ({ default: m.AgentDetailsDialog })));
const DemoVideoSection = lazy(() => import('@/components/landing/DemoVideoSection').then(m => ({ default: m.DemoVideoSection })));
const ROICalculator = lazy(() => import('@/components/pricing/ROICalculator').then(m => ({ default: m.ROICalculator })));
const FeatureDetailDialog = lazy(() => import('@/components/pricing/FeatureDetailDialog').then(m => ({ default: m.FeatureDetailDialog })));
const CookieConsent = lazy(() => import('@/components/landing/CookieConsent').then(m => ({ default: m.CookieConsent })));
import heroIllustration from '@/assets/hero-illustration.png';
import heroIllustrationWebp from '@/assets/hero-illustration.webp';
import heroIllustrationMobileWebp from '@/assets/hero-illustration-mobile.webp';
import { 
  ArrowRight, 
  MessageSquare, 
  Phone, 
  Shield, 
  Zap, 
  Users, 
  Bot,
  Utensils,
  Hotel,
  Facebook,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Clock,
  Sparkles,
  Languages,
  Globe,
  Calculator
} from 'lucide-react';

const aiAgents = [
  {
    name: 'Jay',
    role: 'Sales Agent',
    icon: Bot,
    color: 'from-primary to-primary/70',
    description: 'Qualifies leads 24/7, nurtures prospects, and hands off hot leads to your team with scheduled callbacks.',
    features: ['Lead qualification', 'Configurable handoff', 'Calendar scheduling'],
  },
  {
    name: 'May',
    role: 'Food Business',
    icon: Utensils,
    color: 'from-orange-500 to-amber-500',
    description: 'Takes food orders, answers menu questions, and schedules pickups automatically for restaurants.',
    features: ['Order taking', 'Menu management', 'Pickup scheduling'],
  },
  {
    name: 'Cece',
    role: 'Hotel Concierge',
    icon: Hotel,
    color: 'from-emerald-500 to-teal-500',
    description: 'Manages room bookings, checks availability in real-time, and handles guest inquiries for hotels.',
    features: ['Room booking', 'Availability check', 'Guest management'],
  },
];

const channels = [
  { name: 'Facebook Messenger', icon: Facebook, color: 'text-blue-500' },
  { name: 'WhatsApp', icon: MessageSquare, color: 'text-green-500' },
  { name: 'Instagram DMs', icon: MessageSquare, color: 'text-pink-500' },
];

const features = [
  {
    id: 'ai-agents',
    icon: Bot,
    title: 'AI Agents That Work 24/7',
    description: 'Jay, May, or Cece engage your customers instantly, qualify leads, and never miss an opportunity.',
    benefits: [
      'Instant response to customer inquiries',
      'Automatic lead qualification',
      'Configurable handoff workflow',
      'Industry-specific AI training',
      'Consistent brand voice',
    ],
    details: 'Our AI agents are pre-trained for specific industries - Jay for sales, May for food businesses, and Cece for hospitality. They understand context, handle objections, and know when to escalate to your human team.',
  },
  {
    id: 'multi-channel',
    icon: MessageSquare,
    title: 'Multi-Channel Messaging',
    description: 'Connect Facebook Messenger, WhatsApp, and Instagram DMs in one unified inbox.',
    benefits: [
      'Single dashboard for all channels',
      'Unified conversation history',
      'Cross-channel customer profiles',
      'Automatic message routing',
      'Real-time notifications',
    ],
    details: 'All your social media conversations flow into one place. Your AI agent responds consistently across platforms while maintaining context from previous interactions.',
  },
  {
    id: 'calling',
    icon: Phone,
    title: 'Browser-to-Phone Calling',
    description: 'Call leads directly from your browser with Twilio integration. No phone needed.',
    benefits: [
      'One-click calling from CRM',
      'Call recording and logging',
      'Philippine number support (+63)',
      'No hardware required',
      'Call notes and follow-ups',
    ],
    details: 'Your agents can call leads directly from the browser interface. All calls are logged automatically with duration and notes, keeping your CRM data complete.',
  },
  {
    id: 'calendar',
    icon: Calendar,
    title: 'Google Calendar Integration',
    description: 'Automatic callback scheduling for hot leads and booking management for hospitality businesses.',
    benefits: [
      'Automatic event creation for qualified leads',
      'Hot lead callback scheduling on agent calendars',
      'Real-time room booking calendar sync',
      'Agent availability management',
      'Secure OAuth 2.0 connection',
    ],
    details: 'AlCor Nexus integrates with Google Calendar to schedule callbacks when AI qualifies hot leads, sync hotel room bookings, and manage food order pickups. We access your calendar only to create, view, and modify events related to your business operations. Your calendar data is encrypted and you can disconnect at any time from Settings. See our Privacy Policy for full details on how we use Google Calendar data.',
  },
  {
    id: 'multilingual',
    icon: Languages,
    title: 'Multilingual AI',
    description: 'Communicate with customers in their preferred language, including code-mixed Taglish.',
    benefits: [
      'Automatic language detection',
      'Support for 10+ languages',
      'Code-mixed language handling',
      'Regional dialect support',
      'Consistent brand voice across languages',
    ],
    details: 'Our AI automatically detects the language your customer uses and responds naturally in the same language. It can even handle code-mixed conversations where customers switch between languages mid-sentence.',
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Role-based access control with Super Admin, Client Admin, and Agent permissions.',
    benefits: [
      'Granular role permissions',
      'Data isolation per organization',
      'Audit logging',
      'End-to-end encryption',
      'SOC 2 compliance ready',
    ],
    details: 'Each organization\'s data is completely isolated. Super Admins manage clients, Client Admins manage their team, and Agents access only what they need.',
  },
];

const stats = [
  { value: 24, label: 'AI Availability', suffix: '/7', isNumeric: true },
  { value: 3, label: 'Specialized AI Agents', suffix: '', isNumeric: true },
  { value: 3, label: 'Social Channels', suffix: '+', isNumeric: true },
  { value: 2, label: 'Response Time', prefix: '<', suffix: 's', isNumeric: true },
];

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<'jay' | 'may' | 'cece' | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<typeof features[0] | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  
  // Scroll animations for sections
  const { ref: agentsRef, isVisible: agentsVisible } = useScrollAnimation<HTMLDivElement>();
  const { ref: featuresRef, isVisible: featuresVisible } = useScrollAnimation<HTMLDivElement>();
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation<HTMLDivElement>();
  const { ref: channelsRef, isVisible: channelsVisible } = useScrollAnimation<HTMLDivElement>();
  const parallaxOffset = useParallax(0.3);
  
  // Magnetic effect for CTA buttons
  const magnetic1 = useMagnetic<HTMLButtonElement>({ strength: 0.2 });
  const magnetic2 = useMagnetic<HTMLButtonElement>({ strength: 0.2 });

  // Animated counters for stats
  const stat1 = useCounterAnimation({ end: stats[0].value, isVisible: statsVisible, suffix: stats[0].suffix });
  const stat2 = useCounterAnimation({ end: stats[1].value, isVisible: statsVisible, suffix: stats[1].suffix });
  const stat3 = useCounterAnimation({ end: stats[2].value, isVisible: statsVisible, suffix: stats[2].suffix });
  const stat4 = useCounterAnimation({ end: stats[3].value, isVisible: statsVisible, prefix: stats[3].prefix, suffix: stats[3].suffix });
  const animatedStats = [stat1, stat2, stat3, stat4];

  // Typing animation for hero
  const { displayedText: heroTagline, isComplete: typingComplete } = useTypingAnimation({
    text: 'Never Wait Again',
    speed: 80,
    delay: 800,
  });

  const openFeatureDetail = (feature: typeof features[0]) => {
    setSelectedFeature(feature);
    setFeatureDialogOpen(true);
  };

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <PageTransition>
    <div className="min-h-screen bg-background overflow-hidden">
      <SkipToContent targetId="main-content" />
      {/* SEO Meta Tags with LCP image preload */}
      <Helmet>
        <link rel="preload" as="image" href={heroIllustrationWebp} type="image/webp" />
      </Helmet>
      <SEOMeta
        title="AlCor Nexus - AI-Powered Customer Engagement Platform"
        description="AlCor Nexus provides AI agents for sales teams, restaurants, and hotels across Facebook Messenger, WhatsApp, and Instagram, with lead qualification, order handling, and booking workflows."
        url="https://alcornexus.com"
      />
      <SoftwareApplicationSchema
        name="AlCor Nexus"
        description="AI-powered customer engagement platform with intelligent agents for sales qualification, food ordering, and hotel booking management."
        applicationCategory="BusinessApplication"
        offers={[
          { name: 'Jay - Sales Agent', price: 299 },
          { name: 'May - Food Business', price: 249 },
          { name: 'Cece - Hotel Concierge', price: 349 },
        ]}
      />
      <FAQSchema faqs={landingFaqs} />
      <ScrollProgress />
      <CursorGlow />
      {/* Background Effects with Parallax */}
      <div 
        className="fixed inset-0 pointer-events-none" 
        aria-hidden="true"
        style={{ transform: `translateY(${parallaxOffset}px)` }}
      >
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px]" />
      </div>

      <StickyHeader
        links={homeHeaderLinks}
        ctaLabel="Sign In"
        onCtaClick={() => navigate('/auth')}
        onGetStarted={() => setLeadDialogOpen(true)}
      />

      <BackToTop />

      <main id="main-content" tabIndex={-1} className="relative z-10" role="main" aria-label="Home page main content">
        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-16 sm:pb-24">
          {/* Morphing Blob Background - hidden on mobile for performance */}
          <div className="hidden sm:block">
            <MorphingBlobs />
          </div>
          
          {/* Particle Background - hidden on mobile for performance */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1] hidden sm:block">
            <ParticleBackground />
          </div>
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span className="text-xs sm:text-sm text-primary font-medium">AI-Powered Customer Engagement</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6">
                <span className="text-foreground">Your Customers</span>
                <br />
                <span className={cn("gradient-text", !typingComplete && "typing-cursor")}>
                  {heroTagline}
                </span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-6 sm:mb-8 px-2 sm:px-0">
                AlCor Nexus gives sales teams, restaurants, and hotels specialized AI agents that respond on Facebook,
                WhatsApp, and Instagram, qualify customer intent, and hand critical conversations to your team.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-8 sm:mb-12 px-4 sm:px-0">
                <Button 
                  ref={magnetic1.ref}
                  size="lg" 
                  variant="glow" 
                  onClick={() => setLeadDialogOpen(true)}
                  className="w-full sm:w-auto text-base"
                  style={magnetic1.style}
                  {...magnetic1.handlers}
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  ref={magnetic2.ref}
                  size="lg" 
                  variant="outline" 
                  asChild
                  className="w-full sm:w-auto text-base"
                  style={magnetic2.style}
                  {...magnetic2.handlers}
                >
                  <Link to="/ai-agents">Meet Our AI Agents</Link>
                </Button>
              </div>

              {/* Stats */}
              <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {stats.map((stat, index) => (
                  <div 
                    key={stat.label} 
                    className={cn(
                      "text-center lg:text-left transition-all duration-700",
                      statsVisible 
                        ? "opacity-100 translate-y-0 scale-100" 
                        : "opacity-0 translate-y-4 scale-95"
                    )}
                    style={{ transitionDelay: statsVisible ? `${index * 150}ms` : '0ms' }}
                  >
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 tabular-nums">
                      {animatedStats[index]}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Hero Illustration - show on mobile with reduced size */}
            <div className="relative animate-fade-in mt-8 lg:mt-0" style={{ animationDelay: '200ms' }}>
              <div className="relative lg:animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl sm:rounded-3xl blur-2xl sm:blur-3xl animate-pulse-subtle" />
                <picture>
                  <source 
                    type="image/webp" 
                    srcSet={`${heroIllustrationMobileWebp} 640w, ${heroIllustrationWebp} 1280w`}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px"
                  />
                  <img 
                    src={heroIllustration} 
                    alt="AI-powered customer engagement platform illustration" 
                    width={640}
                    height={360}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="relative z-10 w-full h-auto rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl"
                  />
                </picture>
              </div>
            </div>
          </div>
        </section>

        {/* AI Agents Section */}
        <section id="ai-agents" className="py-16 sm:py-24 bg-card/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10 sm:mb-16">
              <TextReveal>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">
                  Meet Your AI Team
                </h2>
              </TextReveal>
              <TextRevealByWord 
                text="Three specialized AI agents, each designed for a specific industry. Choose the one that fits your business."
                className="text-muted-foreground max-w-2xl mx-auto justify-center text-sm sm:text-base px-2"
              />
            </div>

            <div ref={agentsRef} className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {aiAgents.map((agent, index) => (
                <article 
                  key={agent.name}
                  onClick={() => setSelectedAgent(agent.name.toLowerCase() as 'jay' | 'may' | 'cece')}
                  className={cn(
                    'group p-5 sm:p-8 gradient-border-card border border-border/50 transition-all duration-500 cursor-pointer hover:scale-[1.02] rounded-2xl sm:rounded-3xl',
                    agentsVisible
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-8'
                  )}
                  style={{ transitionDelay: agentsVisible ? `${index * 100}ms` : '0ms' }}
                >
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center mb-4 sm:mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <agent.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">{agent.name}</h3>
                    <span className="text-xs sm:text-sm text-muted-foreground">{agent.role}</span>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">{agent.description}</p>
                  <ul className="space-y-1.5 sm:space-y-2">
                    {agent.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs sm:text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs sm:text-sm text-primary mt-3 sm:mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to learn more →
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Channels Section */}
        <section className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div ref={channelsRef} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className={cn(
                "transition-all duration-700",
                channelsVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
              )}>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 sm:mb-6">
                  One Inbox for All Your Channels
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
                  Connect your Facebook Messenger, WhatsApp Business, and Instagram DMs. 
                  Your AI agent responds instantly on every platform, 24/7.
                </p>
                
                <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {channels.map((channel, index) => (
                    <div 
                      key={channel.name} 
                      className={cn(
                        "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-500",
                        channelsVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                      )}
                      style={{ transitionDelay: channelsVisible ? `${200 + index * 100}ms` : '0ms' }}
                    >
                      <div className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center transition-transform duration-300 hover:scale-110 shrink-0",
                        channel.color
                      )}>
                        <channel.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-foreground text-sm sm:text-base block">{channel.name}</span>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">Webhook integration with instant AI responses</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div 
                  className={cn(
                    "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 transition-all duration-500",
                    channelsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                  style={{ transitionDelay: channelsVisible ? '500ms' : '0ms' }}
                >
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground text-sm sm:text-base block">2-Second Response Time</span>
                    <p className="text-xs sm:text-sm text-muted-foreground">Smart message batching for natural conversations</p>
                  </div>
                </div>
              </div>

              <div className={cn(
                "relative transition-all duration-700",
                channelsVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
              )} style={{ transitionDelay: channelsVisible ? '100ms' : '0ms' }}>
                <div className="aspect-square rounded-3xl bg-gradient-to-br from-card to-muted/30 border border-border/50 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex justify-center gap-4 mb-6">
                      {channels.map((channel, index) => (
                        <div 
                          key={channel.name}
                          className={cn(
                            "w-16 h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300",
                            channel.color,
                            channelsVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
                          )}
                          style={{ transitionDelay: channelsVisible ? `${300 + index * 100}ms` : '0ms' }}
                        >
                          <channel.icon className="w-8 h-8" />
                        </div>
                      ))}
                    </div>
                    <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground">All channels flow into one unified CRM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Video Section */}
        <Suspense fallback={<div className="py-24 flex justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <DemoVideoSection onGetStarted={() => setLeadDialogOpen(true)} />
        </Suspense>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-card/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <TextReveal>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Everything You Need to Scale
                </h2>
              </TextReveal>
              <TextRevealByWord 
                text="Click on any feature to learn more about how it can help your business grow."
                className="text-muted-foreground max-w-2xl mx-auto justify-center"
              />
            </div>

            <div ref={featuresRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => openFeatureDetail(feature)}
                  className={cn(
                    'group p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 text-left cursor-pointer',
                    featuresVisible
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-8'
                  )}
                  style={{ 
                    transitionDelay: featuresVisible ? `${index * 50}ms` : '0ms',
                    transitionProperty: 'opacity, transform, border-color, box-shadow'
                  }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                  <span className="inline-block mt-3 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to learn more →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ROI Calculator */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-950/40 border border-green-500/30 mb-6">
                <Calculator className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-medium">ROI Calculator</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Calculate Your Savings
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See how much you can save by using AI agents vs traditional customer service
              </p>
            </div>

            <Suspense fallback={<div className="h-64 flex justify-center items-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <ROICalculator />
            </Suspense>
          </div>
        </section>

        {/* Testimonials Carousel */}
        <Suspense fallback={<div className="py-24 flex justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <TestimonialsCarousel />
        </Suspense>

        {/* FAQ Section */}
        <Suspense fallback={<div className="py-24 flex justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <FAQSection />
        </Suspense>

        {/* Google Calendar Integration Disclosure Section */}
        <section id="google-calendar-disclosure" className="py-16 bg-card/30">
          <div className="max-w-4xl mx-auto px-6">
            <div className="p-8 rounded-2xl border border-border/50 bg-background/50">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Google Calendar Integration</h3>
                  <p className="text-muted-foreground mb-4">
                    AlCor Nexus integrates with Google Calendar to help you manage leads and bookings efficiently. 
                    When you connect your Google Calendar, we access it to:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Schedule callbacks</strong> for qualified leads on your agents' calendars</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Sync bookings</strong> for hotels and food businesses to manage availability</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span><strong>Check availability</strong> to prevent scheduling conflicts</span>
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Your calendar data is encrypted and used only for scheduling purposes. 
                    You can disconnect at any time from your account settings.{' '}
                    <Link to="/privacy#google-calendar" className="text-primary underline hover:no-underline">
                      Learn more in our Privacy Policy
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="p-12 rounded-3xl bg-gradient-to-b from-card to-background border border-border/50">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Ready to Transform Your Customer Engagement?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Join businesses already using AlCor Nexus to automate lead engagement 
                and never miss another customer.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="xl" variant="glow" onClick={() => setLeadDialogOpen(true)}>
                  Schedule a Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="xl" variant="outline" onClick={() => setLeadDialogOpen(true)}>
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer
        links={[
          { to: '#ai-agents', label: 'AI Agents', isAnchor: true },
          { to: '#features', label: 'Features', isAnchor: true },
          { to: '#channels', label: 'Channels', isAnchor: true },
          { to: '#faq', label: 'FAQ', isAnchor: true },
          { to: '/privacy', label: 'Privacy Policy' },
          { to: '/terms', label: 'Terms & Data Usage' },
        ]}
      />

      {/* Lead Capture Dialog */}
      <Suspense fallback={null}>
        <LeadCaptureDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
      </Suspense>

      {/* Agent Details Dialog */}
      <Suspense fallback={null}>
        <AgentDetailsDialog 
          open={!!selectedAgent} 
          onOpenChange={(open) => !open && setSelectedAgent(null)} 
          agent={selectedAgent}
          onGetStarted={() => setLeadDialogOpen(true)}
        />
      </Suspense>

      {/* Feature Detail Dialog */}
      <Suspense fallback={null}>
        <FeatureDetailDialog 
          feature={selectedFeature} 
          open={featureDialogOpen} 
          onOpenChange={setFeatureDialogOpen} 
        />
      </Suspense>

      {/* Cookie Consent Banner */}
      <Suspense fallback={null}>
        <CookieConsent />
      </Suspense>
    </div>
    </PageTransition>
  );
}
