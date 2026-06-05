import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LeadCaptureDialog } from '@/components/landing/LeadCaptureDialog';
import { AnimatedPrice } from '@/components/landing/AnimatedPrice';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { Footer } from '@/components/landing/Footer';
import { PageTransition } from '@/components/landing/PageTransition';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { CursorGlow } from '@/components/landing/CursorGlow';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { BackToTop } from '@/components/shared/BackToTop';
import { pricingHeaderLinks } from '@/constants/publicSite';
import { WebPageSchema, ProductSchema, BreadcrumbSchema, SEOMeta } from '@/components/seo/StructuredData';
import { ROICalculator } from '@/components/pricing/ROICalculator';
import { FeatureDetailDialog } from '@/components/pricing/FeatureDetailDialog';
import { RequestDemoDialog } from '@/components/pricing/RequestDemoDialog';
import { TrustBadgesSection } from '@/components/pricing/TrustBadgesSection';
import { AnimatedBillingToggle } from '@/components/pricing/AnimatedBillingToggle';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useParallax } from '@/hooks/useParallax';
import { useCounterAnimation } from '@/hooks/useCounterAnimation';
import { cn } from '@/lib/utils';
import { 
  ArrowRight, 
  Check, 
  Bot, 
  Utensils, 
  Hotel, 
  Sparkles,
  Calculator,
  MessageSquare,
  Users,
  Zap,
  Shield,
  HelpCircle,
  Globe,
  Languages,
  Clock,
  Headphones,
  Mail,
  Phone,
  Video,
  Globe2,
  Send,
  Share2,
  Calendar
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Currency conversion rates (base: USD)
const currencyRates: Record<string, { rate: number; symbol: string; name: string }> = {
  USD: { rate: 1, symbol: '$', name: 'US Dollar' },
  PHP: { rate: 56, symbol: '₱', name: 'Philippine Peso' },
  EUR: { rate: 0.92, symbol: '€', name: 'Euro' },
  GBP: { rate: 0.79, symbol: '£', name: 'British Pound' },
  SGD: { rate: 1.34, symbol: 'S$', name: 'Singapore Dollar' },
  AUD: { rate: 1.53, symbol: 'A$', name: 'Australian Dollar' },
  JPY: { rate: 149, symbol: '¥', name: 'Japanese Yen' },
};

// Language complexity tiers - Bilingual included in basic build
const languageTiers = [
  { 
    id: 'bilingual', 
    name: 'Bilingual (Included)', 
    languages: 2, 
    monthlyAdd: 0, 
    setupAdd: 0,
    description: 'Two languages included (e.g., English + Tagalog)'
  },
  { 
    id: 'multilingual', 
    name: 'Multilingual', 
    languages: 5, 
    monthlyAdd: 100, 
    setupAdd: 500,
    description: 'Up to 5 languages with code-mixing support'
  },
  { 
    id: 'enterprise', 
    name: 'Enterprise Languages', 
    languages: 10, 
    monthlyAdd: 200, 
    setupAdd: 1000,
    description: '10+ languages with regional dialect support'
  },
];

// Base prices in USD
const standardPlans = [
  {
    name: 'Jay',
    role: 'Sales Agent',
    icon: Bot,
    color: 'from-primary to-primary/70',
    basePrice: 299, // Updated USD price
    description: 'AI-powered lead qualification and nurturing for sales teams.',
    features: [
      'Lead qualification 24/7',
      'Configurable handoff workflow',
      'Google Calendar integration',
      'Meta integration (FB, WhatsApp, IG)',
      'Temperature-based prioritization',
      'Knowledge base support',
    ],
    popular: true,
    breakdown: {
      messages: '2,000 conversations/month',
      support: 'Email support (48hr response)',
      users: 'Up to 5 agent seats',
      storage: '5GB knowledge base',
      languages: '2 languages included',
      sla: '99.5% uptime SLA',
    },
  },
  {
    name: 'May',
    role: 'Food Business',
    icon: Utensils,
    color: 'from-orange-500 to-amber-500',
    basePrice: 249, // USD price
    description: 'Order taking and pickup scheduling for restaurants and cafes.',
    features: [
      'Automated order taking',
      'Menu management',
      'Pickup scheduling',
      'Meta integration (FB, WhatsApp, IG)',
      'Order notifications',
      'Knowledge base support',
    ],
    popular: false,
    breakdown: {
      messages: '1,500 conversations/month',
      support: 'Email support (48hr response)',
      users: 'Up to 3 agent seats',
      storage: '3GB knowledge base',
      languages: '2 languages included',
      sla: '99.5% uptime SLA',
    },
  },
  {
    name: 'Cece',
    role: 'Hotel Concierge',
    icon: Hotel,
    color: 'from-emerald-500 to-teal-500',
    basePrice: 349, // Updated USD price
    description: 'Room booking and guest management for hospitality businesses.',
    features: [
      'Real-time availability',
      'Room booking management',
      'Guest inquiries 24/7',
      'Meta integration (FB, WhatsApp, IG)',
      'Booking modifications',
      'Knowledge base support',
    ],
    popular: false,
    breakdown: {
      messages: '2,500 conversations/month',
      support: 'Priority email (24hr response)',
      users: 'Up to 10 agent seats',
      storage: '10GB knowledge base',
      languages: '2 languages included',
      sla: '99.9% uptime SLA',
    },
  },
];

// Additional features for custom builds
const customFeatures = [
  { id: 'social', name: 'Social Media Channels', basePrice: 50, tooltip: 'Connect to Facebook, WhatsApp, Instagram, and more', icon: Share2 },
  { id: 'email', name: 'Email Integration', basePrice: 50, tooltip: 'Automated email responses and follow-ups', icon: Mail },
  { id: 'website', name: 'Website Chat Widget', basePrice: 50, tooltip: 'Embed AI chat directly on your website', icon: Globe2 },
  { id: 'tiktok', name: 'TikTok Integration', basePrice: 50, tooltip: 'Respond to TikTok DMs and comments', icon: Video },
  { id: 'viber', name: 'Viber Integration', basePrice: 50, tooltip: 'Connect with customers on Viber', icon: Phone },
  { id: 'telegram', name: 'Telegram Integration', basePrice: 50, tooltip: 'Automate Telegram conversations', icon: Send },
  { id: 'integrations', name: 'Custom Integrations', basePrice: 500, tooltip: 'Connect to your existing systems (CRM, ERP, POS, etc.)' },
  { id: 'workflows', name: 'Complex Workflows', basePrice: 300, tooltip: 'Multi-step conversation flows with branching logic' },
  { id: 'training', name: 'AI Training Sessions', basePrice: 200, tooltip: 'Hands-on training for your team' },
  { id: 'support', name: 'Priority Support', basePrice: 150, tooltip: 'Dedicated support with faster response times' },
];

// Feature tooltips for standard plans
const featureTooltips: Record<string, string> = {
  'Lead qualification 24/7': 'AI automatically qualifies leads based on your criteria, scoring and prioritizing them for your team',
  'Configurable handoff workflow': 'Routes conversations between AI and human agents using your configured takeover and handback rules with full context',
  'Google Calendar integration': 'Automatically schedule callbacks and meetings on your team\'s calendar',
  'Meta integration (FB, WhatsApp, IG)': 'Connect all your Meta platforms - Facebook Messenger, WhatsApp Business, and Instagram DMs',
  'Temperature-based prioritization': 'Leads are classified as Hot, Warm, or Cold based on engagement and intent signals',
  'Knowledge base support': 'Upload documents and FAQs to train your AI on your specific products and services',
  'Automated order taking': 'AI handles order placement with menu customization and special requests',
  'Menu management': 'Easy-to-update menu system with prices, descriptions, and availability',
  'Pickup scheduling': 'Customers can schedule pickup times that sync with your kitchen capacity',
  'Order notifications': 'Real-time alerts for new orders, changes, and pickup reminders',
  'Real-time availability': 'Live room availability synced with your booking calendar',
  'Room booking management': 'Handle reservations, modifications, and cancellations automatically',
  'Guest inquiries 24/7': 'Answer questions about amenities, policies, and local recommendations',
  'Booking modifications': 'Guests can easily change dates, room types, or add services',
};

// Feature details for "Everything You Need to Scale" section
const scaleFeatures = [
  {
    id: 'multilingual',
    title: 'Multilingual AI',
    icon: Languages,
    description: 'Communicate with customers in their preferred language, including code-mixed languages like Taglish.',
    benefits: [
      'Automatic language detection',
      'Support for 10+ languages',
      'Code-mixed language handling (e.g., Taglish)',
      'Regional dialect support',
      'Consistent brand voice across languages',
    ],
    details: 'Our AI automatically detects the language your customer uses and responds naturally in the same language. It can even handle code-mixed conversations where customers switch between languages mid-sentence.',
  },
  {
    id: 'integrations',
    title: 'Seamless Integrations',
    icon: Zap,
    description: 'Connect with your existing tools and platforms effortlessly.',
    benefits: [
      'Meta platforms (Facebook, WhatsApp, Instagram)',
      'Google Calendar for scheduling',
      'Email and website integration',
      'TikTok, Viber, and Telegram support',
      'Custom API connections for enterprise',
    ],
    details: 'Our integration layer connects your AI agent to all major messaging platforms and business tools. Set up takes minutes, not weeks, and our team handles the technical configuration for you.',
  },
  {
    id: 'analytics',
    title: 'Powerful Analytics',
    icon: MessageSquare,
    description: 'Get deep insights into customer conversations and AI performance.',
    benefits: [
      'Real-time conversation monitoring',
      'Lead quality scoring and tracking',
      'Response time analytics',
      'Customer satisfaction metrics',
      'Custom report generation',
    ],
    details: 'Track every conversation, measure AI performance, and understand customer behavior through our comprehensive analytics dashboard. Export reports for team reviews and identify areas for improvement.',
  },
  {
    id: 'security',
    title: 'Enterprise Security',
    icon: Shield,
    description: 'Your data is protected by industry-leading security standards.',
    benefits: [
      'End-to-end encryption',
      'SOC 2 compliance ready',
      'GDPR data handling',
      'Regular security audits',
      'Data residency options',
    ],
    details: 'We take security seriously. All conversations are encrypted, and we follow strict data handling practices. Enterprise customers can request dedicated infrastructure and custom data residency configurations.',
  },
];

export default function Pricing() {
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [enterpriseDialogOpen, setEnterpriseDialogOpen] = useState(false);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [selectedDemoPlan, setSelectedDemoPlan] = useState('');
  const [billingAnnual, setBillingAnnual] = useState(true);
  const [currency, setCurrency] = useState('USD');
  
  // Feature detail dialog state
  const [selectedFeature, setSelectedFeature] = useState<typeof scaleFeatures[0] | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  
  // Enterprise form state
  const [enterpriseForm, setEnterpriseForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    employees: '',
    message: '',
  });
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false);
  
  // Scroll animations
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation<HTMLDivElement>();
  const { ref: featuresRef, isVisible: featuresVisible } = useScrollAnimation<HTMLDivElement>();
  const parallaxOffset = useParallax(0.3);
  
  // Language tier for standard plans - bilingual is now default/included
  const [standardLanguageTier, setStandardLanguageTier] = useState('bilingual');
  
  const openFeatureDetail = (feature: typeof scaleFeatures[0]) => {
    setSelectedFeature(feature);
    setFeatureDialogOpen(true);
  };
  
  const openDemoWithPlan = (planName: string) => {
    setSelectedDemoPlan(planName.toLowerCase());
    setDemoDialogOpen(true);
  };
  
  // Custom pricing calculator state
  const [conversationVolume, setConversationVolume] = useState([1000]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [complexity, setComplexity] = useState<'simple' | 'moderate' | 'complex'>('moderate');
  const [customLanguageTier, setCustomLanguageTier] = useState('bilingual');

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(f => f !== featureId)
        : [...prev, featureId]
    );
  };

  // Round up: PHP and JPY to next 1000, others to next 10
  const roundPrice = (price: number, currencyCode: string) => {
    if (currencyCode === 'PHP' || currencyCode === 'JPY') {
      return Math.ceil(price / 1000) * 1000;
    }
    return Math.ceil(price / 10) * 10;
  };

  const formatPrice = (usdPrice: number) => {
    const { rate, symbol } = currencyRates[currency];
    const converted = usdPrice * rate;
    const rounded = currency === 'USD' ? Math.round(converted) : roundPrice(converted, currency);
    return `${symbol}${rounded.toLocaleString()}`;
  };

  const getConvertedPrice = (usdPrice: number) => {
    const { rate } = currencyRates[currency];
    const converted = usdPrice * rate;
    return currency === 'USD' ? Math.round(converted) : roundPrice(converted, currency);
  };

  const getSelectedLanguageTier = (tierId: string) => {
    return languageTiers.find(t => t.id === tierId) || languageTiers[0];
  };

  const customEstimate = useMemo(() => {
    // Base price based on complexity (setup fees)
    const complexitySetupPrices = {
      simple: 2000,
      moderate: 5000,
      complex: 10000,
    };
    
    // Monthly fees based on complexity
    const complexityMonthlyPrices = {
      simple: 249,
      moderate: 349,
      complex: 449,
    };
    
    const baseSetupPrice = complexitySetupPrices[complexity];
    const baseMonthlyPrice = complexityMonthlyPrices[complexity];
    
    // Add feature costs
    const featureCost = selectedFeatures.reduce((sum, featureId) => {
      const feature = customFeatures.find(f => f.id === featureId);
      return sum + (feature?.basePrice || 0);
    }, 0);
    
    // Language tier costs
    const langTier = getSelectedLanguageTier(customLanguageTier);
    
    // Conversation volume pricing (monthly)
    const volumePrice = Math.floor(conversationVolume[0] / 500) * 50;
    
    const setupFee = baseSetupPrice + featureCost + langTier.setupAdd;
    const monthlyFee = baseMonthlyPrice + volumePrice + langTier.monthlyAdd + (selectedFeatures.includes('support') ? 150 : 0);
    
    return {
      setupFee,
      monthlyFee,
      annualSavings: Math.round(monthlyFee * 12 * 0.2),
    };
  }, [complexity, selectedFeatures, conversationVolume, customLanguageTier]);

  const getAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 0.8); // 20% discount
  };

  const getStandardPlanTotal = (basePrice: number) => {
    const langTier = getSelectedLanguageTier(standardLanguageTier);
    return basePrice + langTier.monthlyAdd;
  };

  const handleEnterpriseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEnterprise(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Thank you! Our enterprise team will contact you within 24 hours.');
    setEnterpriseDialogOpen(false);
    setEnterpriseForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      employees: '',
      message: '',
    });
    setIsSubmittingEnterprise(false);
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background overflow-hidden">
      <SkipToContent targetId="main-content" />
      {/* SEO Meta Tags */}
      <SEOMeta
        title="Pricing - AlCor Nexus AI Agents"
        description="Simple, transparent pricing for AI-powered customer engagement. Choose from Jay (Sales), May (Food), or Cece (Hotel) agents starting at $249/month."
        url="https://alcornexus.com/pricing"
      />
      <WebPageSchema
        title="AlCor Nexus Pricing"
        description="Transparent pricing for AI-powered customer engagement agents. Standard agents from $249/month with custom solutions available."
        url="https://alcornexus.com/pricing"
      />
      {standardPlans.map(plan => (
        <ProductSchema
          key={plan.name}
          name={`${plan.name} AI Agent - ${plan.role}`}
          description={plan.description}
          price={billingAnnual ? getAnnualPrice(plan.basePrice) : plan.basePrice}
        />
      ))}
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://alcornexus.com' },
          { name: 'Pricing', url: 'https://alcornexus.com/pricing' },
        ]}
      />
      <ScrollProgress />
      <CursorGlow />
      <div 
        className="fixed inset-0 pointer-events-none" 
        aria-hidden="true"
        style={{ transform: `translateY(${parallaxOffset}px)` }}
      >
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
      </div>

      <StickyHeader
        links={pricingHeaderLinks}
        ctaLabel="Get Started"
        onCtaClick={() => setLeadDialogOpen(true)}
      />

      <BackToTop />

      <main id="main-content" tabIndex={-1} className="relative z-10" role="main" aria-label="Pricing page main content">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6">
              <span className="text-foreground">Simple, Transparent</span>
              <br />
              <span className="gradient-text">Pricing</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
              Choose a standard AI agent for quick deployment, or get a custom solution 
              built specifically for your business needs.
            </p>
          </div>
        </section>

        {/* Sticky Currency Picker - Fixed at top */}
        <div className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50 py-2 sm:py-3 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Currency:</span>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[100px] sm:w-[130px] h-7 sm:h-8 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(currencyRates).map(([code, { symbol, name }]) => (
                    <SelectItem key={code} value={code}>
                      {symbol} {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-4 w-px bg-border/50 hidden sm:block" />
            <AnimatedBillingToggle 
              billingAnnual={billingAnnual} 
              onToggle={setBillingAnnual} 
            />
          </div>
        </div>

        {/* Spacer for fixed header */}
        <div className="h-12 sm:h-14" />

        {/* Multi-Language Highlight */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 border border-purple-500/20">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                <Languages className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1 sm:mb-2">
                  Multi-Language AI Support
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Our AI agents support <strong className="text-foreground">multiple languages</strong> including 
                  code-mixed conversations (like Taglish). Perfect for diverse audiences.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Language Tier Selector for Standard Plans */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8">
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-card/50 border border-border/50">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
              <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Select Language Support
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {languageTiers.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setStandardLanguageTier(tier.id)}
                  className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all h-full flex flex-col ${
                    standardLanguageTier === tier.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 hover:border-primary/30'
                  }`}
                >
                  <div className="font-medium text-foreground text-sm sm:text-base">{tier.name}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 flex-1">{tier.description}</div>
                  <div className="mt-2 sm:mt-3 text-xs sm:text-sm">
                    {tier.monthlyAdd === 0 ? (
                      <span className="text-green-500 font-medium">Included</span>
                    ) : (
                      <span className="text-primary font-medium">+{formatPrice(tier.monthlyAdd)}/mo</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Standard Plans */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Standard AI Agents
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Ready-to-deploy AI agents for common business needs
            </p>
          </div>

          <div 
            ref={cardsRef}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-md md:max-w-none mx-auto"
          >
            {standardPlans.map((plan, index) => {
              const totalMonthly = getStandardPlanTotal(plan.basePrice);
              const displayPrice = billingAnnual ? getAnnualPrice(totalMonthly) : totalMonthly;
              
              return (
                <div
                  key={plan.name}
                  className={cn(
                    'relative p-8 rounded-3xl border transition-all duration-500',
                    plan.popular 
                      ? 'bg-card border-primary/50 shadow-lg shadow-primary/10' 
                      : 'bg-card/50 border-border/50 hover:border-primary/30',
                    cardsVisible
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-8'
                  )}
                  style={{ transitionDelay: cardsVisible ? `${index * 100}ms` : '0ms' }}
                >
                    {/* Popular Badge with Animation */}
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="relative bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full shadow-lg shadow-primary/30 animate-pulse">
                          ⭐ Most Popular
                        </span>
                      </div>
                    )}
                  
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-6`}>
                    <plan.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.role}</p>
                  
                  <div className="mb-2">
                    <AnimatedPrice 
                      value={getConvertedPrice(displayPrice)} 
                      prefix={currencyRates[currency].symbol}
                      className="text-4xl font-bold text-foreground tabular-nums"
                    />
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  
                  {standardLanguageTier !== 'bilingual' && (
                    <div className="text-xs text-primary mb-4">
                      Includes {getSelectedLanguageTier(standardLanguageTier).name} support
                    </div>
                  )}
                  
                  <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                  
                  {/* Feature Breakdown */}
                  <div className="p-4 rounded-xl bg-muted/30 mb-6">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      What's Included
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-foreground">{plan.breakdown.messages}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-foreground">{plan.breakdown.users}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-foreground">{plan.breakdown.support}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Languages className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-foreground">{plan.breakdown.languages}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-foreground">{plan.breakdown.sla}</span>
                      </div>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm group">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground">{feature}</span>
                        {featureTooltips[feature] && (
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p>{featureTooltips[feature]}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    ))}
                  </ul>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1" 
                      variant={plan.popular ? "glow" : "outline"}
                      onClick={() => setLeadDialogOpen(true)}
                    >
                      Get Started
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openDemoWithPlan(plan.name)}
                      title="Request Demo"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Agent Testimonials */}
        <section className="py-16 bg-gradient-to-b from-background to-card/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Trusted by Businesses Like Yours
              </h2>
              <p className="text-muted-foreground">
                See what our clients say about their AI agents
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Jay Testimonial */}
              <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Jay</p>
                    <p className="text-xs text-muted-foreground">Sales Agent</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm italic mb-4">
                  "Jay handles our after-hours inquiries perfectly. We've seen a 40% increase in qualified leads since implementing the AI. The handoff to our human agents is seamless."
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Marco S.</span>
                  <span>•</span>
                  <span>Real Estate Investment Firm</span>
                </div>
              </div>

              {/* May Testimonial */}
              <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-orange-500/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                    <Utensils className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">May</p>
                    <p className="text-xs text-muted-foreground">Food Business</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm italic mb-4">
                  "May takes orders even when we're busy cooking. Our customers love the quick responses and our order accuracy improved. It understands Taglish perfectly!"
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Chef Ana L.</span>
                  <span>•</span>
                  <span>Filipino Restaurant, Manila</span>
                </div>
              </div>

              {/* Cece Testimonial */}
              <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-emerald-500/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Hotel className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Cece</p>
                    <p className="text-xs text-muted-foreground">Hotel Concierge</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm italic mb-4">
                  "Cece handles booking inquiries 24/7 in multiple languages. We've reduced response time from hours to seconds. Guest satisfaction scores are at an all-time high."
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">David T.</span>
                  <span>•</span>
                  <span>Beach Resort, Palawan</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Standard vs Custom Builds
              </h2>
              <p className="text-muted-foreground">
                Choose the right option for your business needs
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 text-foreground font-semibold">Feature</th>
                    <th className="text-center py-4 px-4 text-foreground font-semibold">
                      <div className="flex flex-col items-center gap-1">
                        <span>Standard Agents</span>
                        <span className="text-xs text-muted-foreground font-normal">Jay, May, Cece</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 text-foreground font-semibold">
                      <div className="flex flex-col items-center gap-1">
                        <span>Custom Build</span>
                        <span className="text-xs text-muted-foreground font-normal">Tailored for you</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { feature: 'Setup Time', standard: '24-48 hours', custom: '2-4 weeks' },
                    { feature: 'Meta Integration (FB, WhatsApp, IG)', standard: true, custom: true },
                    { feature: 'Languages Included', standard: '2 languages', custom: '2+ languages' },
                    { feature: 'Knowledge Base', standard: true, custom: true },
                    { feature: 'Google Calendar Sync', standard: true, custom: true },
                    { feature: 'Custom Workflows', standard: 'Pre-built', custom: 'Unlimited' },
                    { feature: 'Custom Integrations', standard: false, custom: true },
                    { feature: 'Dedicated Project Manager', standard: false, custom: true },
                    { feature: 'API Access', standard: 'Limited', custom: 'Full' },
                    { feature: 'Conversation Volume', standard: 'Plan limits', custom: 'Flexible' },
                    { feature: 'White-label Options', standard: false, custom: true },
                    { feature: 'Priority Support', standard: 'Optional add-on', custom: true },
                  ].map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                      <td className="py-3 px-4 text-foreground">{row.feature}</td>
                      <td className="py-3 px-4 text-center">
                        {typeof row.standard === 'boolean' ? (
                          row.standard ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">{row.standard}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {typeof row.custom === 'boolean' ? (
                          row.custom ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">{row.custom}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <Button variant="outline" onClick={() => setLeadDialogOpen(true)}>
                Start with Standard
              </Button>
              <Button variant="glow" onClick={() => setLeadDialogOpen(true)}>
                Get Custom Quote
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* Custom Pricing Calculator */}
        <section className="py-24 bg-card/30">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
                <Calculator className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-purple-500 font-medium">Custom Pricing Calculator</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Estimate Your Custom AI Agent
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Get an instant estimate for your custom AI agent project. 
                Final pricing may vary based on specific requirements.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
              {/* Calculator Inputs */}
              <div className="space-y-8">
                {/* Complexity */}
                <div className="p-6 rounded-2xl bg-card border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Project Complexity</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(['simple', 'moderate', 'complex'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setComplexity(level)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          complexity === level
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        <div className="font-medium capitalize">{level}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {level === 'simple' && '1-2 workflows'}
                          {level === 'moderate' && '3-5 workflows'}
                          {level === 'complex' && '6+ workflows'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Support for Custom */}
                <div className="p-6 rounded-2xl bg-card border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Languages className="w-5 h-5 text-purple-500" />
                    Language Support
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {languageTiers.map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => setCustomLanguageTier(tier.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          customLanguageTier === tier.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-border/50 hover:border-purple-500/30'
                        }`}
                      >
                        <div className="font-medium text-foreground text-sm">{tier.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {tier.languages === 10 ? '10+' : tier.languages} language{tier.languages > 1 ? 's' : ''}
                        </div>
                        <div className="mt-2 text-xs">
                          {tier.setupAdd === 0 && tier.monthlyAdd === 0 ? (
                            <span className="text-green-500">Included</span>
                          ) : (
                            <span className="text-purple-500">
                              +{formatPrice(tier.setupAdd)} setup, +{formatPrice(tier.monthlyAdd)}/mo
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation Volume */}
                <div className="p-6 rounded-2xl bg-card border border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Monthly Conversations</h3>
                    <span className="text-2xl font-bold text-primary">{conversationVolume[0].toLocaleString()}</span>
                  </div>
                  <Slider
                    value={conversationVolume}
                    onValueChange={setConversationVolume}
                    min={500}
                    max={10000}
                    step={500}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>500</span>
                    <span>10,000+</span>
                  </div>
                </div>

                {/* Channel Integrations */}
                <div className="p-6 rounded-2xl bg-card border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Channel Integrations</h3>
                  <p className="text-xs text-muted-foreground mb-4">Add communication channels to your AI agent</p>
                  <div className="grid grid-cols-2 gap-2">
                    {customFeatures.filter(f => ['social', 'email', 'website', 'tiktok', 'viber', 'telegram'].includes(f.id)).map((feature) => (
                      <button
                        key={feature.id}
                        onClick={() => toggleFeature(feature.id)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all flex items-center gap-2',
                          selectedFeatures.includes(feature.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-border/50 hover:border-primary/30'
                        )}
                      >
                        {feature.icon && <feature.icon className="w-4 h-4 text-primary shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{feature.name.replace(' Integration', '')}</div>
                          <div className="text-xs text-muted-foreground">+{formatPrice(feature.basePrice)}/mo</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Features */}
                <div className="p-6 rounded-2xl bg-card border border-border/50">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Additional Features</h3>
                  <div className="space-y-3">
                    {customFeatures.filter(f => !['social', 'email', 'website', 'tiktok', 'viber', 'telegram'].includes(f.id)).map((feature) => (
                      <div
                        key={feature.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={selectedFeatures.includes(feature.id)}
                            onCheckedChange={() => toggleFeature(feature.id)}
                          />
                          <Label className="cursor-pointer">{feature.name}</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{feature.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          +{formatPrice(feature.basePrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estimate Display */}
              <div className="lg:sticky lg:top-8 h-fit">
                <div className="p-8 rounded-3xl bg-gradient-to-b from-card to-background border border-primary/20 shadow-lg shadow-primary/5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Your Estimate</h3>
                      <p className="text-sm text-muted-foreground">Custom AI Agent</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center py-3 border-b border-border/50">
                      <span className="text-muted-foreground">One-time Setup Fee</span>
                      <AnimatedPrice 
                        value={Math.round(customEstimate.setupFee * currencyRates[currency].rate)} 
                        prefix={currencyRates[currency].symbol}
                        className="text-2xl font-bold text-foreground tabular-nums"
                      />
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-border/50">
                      <span className="text-muted-foreground">Monthly Fee</span>
                      <span className="tabular-nums">
                        <AnimatedPrice 
                          value={Math.round(customEstimate.monthlyFee * currencyRates[currency].rate)} 
                          prefix={currencyRates[currency].symbol}
                          className="text-2xl font-bold text-foreground"
                        />
                        <span className="text-muted-foreground text-base">/mo</span>
                      </span>
                    </div>
                    {billingAnnual && (
                      <div className="flex justify-between items-center py-3 bg-green-500/10 rounded-lg px-3">
                        <span className="text-green-600">Annual Savings</span>
                        <span className="tabular-nums">
                          <AnimatedPrice 
                            value={Math.round(customEstimate.annualSavings * currencyRates[currency].rate)} 
                            prefix={currencyRates[currency].symbol}
                            className="text-lg font-bold text-green-600"
                          />
                          <span className="text-green-600">/year</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Language Tier Selected */}
                  {customLanguageTier !== 'single' && (
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-6">
                      <div className="flex items-center gap-2 text-purple-500">
                        <Languages className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {getSelectedLanguageTier(customLanguageTier).name} included
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 mb-8 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      <span>Dedicated project manager</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      <span>2-4 week delivery timeline</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      <span>30-day satisfaction guarantee</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      <span>Code-mixed language support</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg" 
                    variant="glow"
                    onClick={() => setLeadDialogOpen(true)}
                  >
                    Get Custom Quote
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    * This is an estimate. Final pricing based on detailed requirements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Everything You Need to Scale */}
        <section className="py-24 bg-card/30">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-500 font-medium">Platform Features</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Everything You Need to Scale
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Click on any feature to learn more about how it can help your business
              </p>
            </div>

            <div 
              ref={featuresRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {scaleFeatures.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => openFeatureDetail(feature)}
                  className={cn(
                    "p-6 rounded-2xl bg-card border border-border/50 text-left transition-all duration-500 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 group cursor-pointer",
                    featuresVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  )}
                  style={{ transitionDelay: featuresVisible ? `${index * 100}ms` : '0ms' }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-primary/10 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{feature.description}</p>
                  <span className="inline-block mt-3 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to learn more →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Badges Section */}
        <TrustBadgesSection />

        {/* ROI Calculator */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                <Calculator className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-500 font-medium">ROI Calculator</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Calculate Your Savings
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See how much you can save by using AI agents vs traditional customer service
              </p>
            </div>

            <ROICalculator formatPrice={formatPrice} currency={currency} currencyRates={currencyRates} />
          </div>
        </section>

        {/* FAQ Preview */}
        <section className="py-24 bg-card/30">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <HelpCircle className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">FAQ</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Common Questions
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {[
                {
                  q: 'Can I switch plans later?',
                  a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.',
                },
                {
                  q: 'What payment methods do you accept?',
                  a: 'We accept all major credit cards, bank transfers, and PayPal for business accounts.',
                },
                {
                  q: 'How does multi-language support work?',
                  a: 'Our AI automatically detects the language your customer uses and responds in the same language, including code-mixed languages like Taglish.',
                },
                {
                  q: 'What happens if I exceed my conversation limit?',
                  a: 'We will notify you before you hit your limit. Additional conversations are billed at competitive rates.',
                },
              ].map((faq) => (
                <div key={faq.q} className="p-6 rounded-2xl bg-card/50 border border-border/50">
                  <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>

            {/* Enterprise FAQ Section */}
            <div className="mt-16">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Enterprise Features FAQ
                </h3>
                <p className="text-muted-foreground">
                  Questions about enterprise-grade features and support
                </p>
              </div>
              
              <div className="space-y-4">
                {[
                  {
                    q: 'Do you support Single Sign-On (SSO)?',
                    a: 'Yes! Enterprise plans include SSO integration with SAML 2.0, OAuth 2.0, and OpenID Connect. We support major identity providers including Okta, Azure AD, Google Workspace, and OneLogin. Setup is included in your enterprise onboarding.',
                  },
                  {
                    q: 'What SLA options are available?',
                    a: 'Enterprise customers can choose from custom SLA tiers: Standard (99.5% uptime), Premium (99.9% uptime), and Mission-Critical (99.99% uptime with dedicated infrastructure). Each tier includes guaranteed response times for support tickets and incident resolution.',
                  },
                  {
                    q: 'What dedicated support options do you offer?',
                    a: 'Enterprise plans include a dedicated Customer Success Manager, priority support queue with 1-hour response time, 24/7 emergency hotline, quarterly business reviews, and custom training sessions for your team.',
                  },
                  {
                    q: 'Can I get a dedicated infrastructure?',
                    a: 'Yes, enterprise customers can opt for dedicated infrastructure with isolated databases, custom geographic deployment, and private API endpoints. This ensures maximum security and compliance for regulated industries.',
                  },
                  {
                    q: 'Do you support compliance requirements (HIPAA, SOC2, GDPR)?',
                    a: 'Our enterprise tier supports HIPAA compliance with BAA agreements, SOC2 Type II certification, GDPR compliance with data processing agreements, and can accommodate industry-specific requirements. Contact our sales team for detailed compliance documentation.',
                  },
                  {
                    q: 'What about data residency requirements?',
                    a: 'Enterprise customers can specify data residency requirements. We offer deployment options in multiple regions including US, EU, Asia-Pacific, and can work with you on specific geographic requirements for data storage and processing.',
                  },
                ].map((faq, index) => (
                  <div 
                    key={index} 
                    className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/5 to-violet-500/5 border border-purple-500/20 hover:border-purple-500/40 transition-colors"
                  >
                    <h4 className="font-semibold text-foreground mb-2 flex items-start gap-2">
                      <Shield className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                      {faq.q}
                    </h4>
                    <p className="text-sm text-muted-foreground pl-7">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Enterprise CTA */}
        <section className="py-16 bg-gradient-to-b from-card/30 to-background">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="p-12 rounded-3xl bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border border-purple-500/20">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-6">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-purple-400 font-medium">Enterprise Solutions</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Need a Custom Enterprise Solution?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                For large organizations with complex requirements, dedicated support, and custom SLAs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Dialog open={enterpriseDialogOpen} onOpenChange={setEnterpriseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="xl" variant="glow">
                      Contact Sales
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Contact Enterprise Sales</DialogTitle>
                      <DialogDescription>
                        Fill out the form and our enterprise team will get back to you within 24 hours.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEnterpriseSubmit} className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="ent-name">Full Name *</Label>
                          <Input
                            id="ent-name"
                            value={enterpriseForm.name}
                            onChange={(e) => setEnterpriseForm(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ent-email">Work Email *</Label>
                          <Input
                            id="ent-email"
                            type="email"
                            value={enterpriseForm.email}
                            onChange={(e) => setEnterpriseForm(prev => ({ ...prev, email: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="ent-company">Company Name *</Label>
                          <Input
                            id="ent-company"
                            value={enterpriseForm.company}
                            onChange={(e) => setEnterpriseForm(prev => ({ ...prev, company: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ent-phone">Phone Number</Label>
                          <Input
                            id="ent-phone"
                            value={enterpriseForm.phone}
                            onChange={(e) => setEnterpriseForm(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ent-employees">Number of Employees *</Label>
                        <Select
                          value={enterpriseForm.employees}
                          onValueChange={(value) => setEnterpriseForm(prev => ({ ...prev, employees: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select company size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50-100">50-100 employees</SelectItem>
                            <SelectItem value="100-500">100-500 employees</SelectItem>
                            <SelectItem value="500-1000">500-1,000 employees</SelectItem>
                            <SelectItem value="1000+">1,000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ent-message">Tell us about your needs</Label>
                        <Textarea
                          id="ent-message"
                          value={enterpriseForm.message}
                          onChange={(e) => setEnterpriseForm(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Describe your use case, expected volume, and any specific requirements..."
                          rows={4}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isSubmittingEnterprise}>
                        {isSubmittingEnterprise ? 'Submitting...' : 'Submit Inquiry'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button size="xl" variant="outline" onClick={() => setDemoDialogOpen(true)}>
                  Request Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="p-12 rounded-3xl bg-gradient-to-b from-card to-background border border-border/50">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Schedule a demo to see how AlCor Nexus can transform your customer engagement.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="xl" variant="glow" onClick={() => setDemoDialogOpen(true)}>
                  Request a Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="xl" variant="outline" onClick={() => setLeadDialogOpen(true)}>
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer
        links={[
          { to: '/', label: 'Home' },
          { to: '/custom-solutions', label: 'Custom Solutions' },
          { to: '/privacy', label: 'Privacy Policy' },
          { to: '/terms', label: 'Terms & Data Usage' },
        ]}
      />

      {/* Lead Capture Dialog */}
      <LeadCaptureDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
      
      {/* Feature Detail Dialog */}
      <FeatureDetailDialog 
        feature={selectedFeature} 
        open={featureDialogOpen} 
        onOpenChange={setFeatureDialogOpen} 
      />
      
      {/* Request Demo Dialog */}
      <RequestDemoDialog 
        open={demoDialogOpen} 
        onOpenChange={setDemoDialogOpen}
        prefilledPlan={selectedDemoPlan}
      />
    </div>
    </PageTransition>
  );
}
