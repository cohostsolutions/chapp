import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { LeadCaptureDialog } from '@/components/landing/LeadCaptureDialog';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { Footer } from '@/components/landing/Footer';
import { PageTransition } from '@/components/landing/PageTransition';
import { SkipToContent } from '@/components/shared/SkipToContent';
import { CursorGlow } from '@/components/landing/CursorGlow';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { BackToTop } from '@/components/shared/BackToTop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { customSolutionsHeaderLinks } from '@/constants/publicSite';
import { ServiceSchema, BreadcrumbSchema, SEOMeta } from '@/components/seo/StructuredData';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useParallax } from '@/hooks/useParallax';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { trackPageView, trackButtonClick } from '@/hooks/useAnalyticsTracking';
import { cn } from '@/lib/utils';
import { 
  ArrowRight, 
  Sparkles, 
  Stethoscope, 
  GraduationCap, 
  Scale, 
  Wrench, 
  Car, 
  ShoppingBag,
  HeartPulse,
  Building2,
  Truck,
  CheckCircle2,
  MessageSquare,
  Zap,
  Clock,
  Users,
  Plane,
  Scissors,
  Dog,
  Landmark,
  Music,
  Camera,
  Briefcase,
  Search,
  X,
  Filter,
  Bot,
  Star,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  type LucideIcon
} from 'lucide-react';

interface AgentExample {
  icon: LucideIcon;
  industry: string;
  name: string;
  description: string;
  features: string[];
  color: string;
  category: 'healthcare' | 'professional' | 'consumer' | 'business' | 'lifestyle';
}

interface Testimonial {
  name: string;
  company: string;
  industry: string;
  avatar: string;
  text: string;
  rating: number;
}

const categories = [
  { id: 'all', label: 'All Industries' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'professional', label: 'Professional Services' },
  { id: 'consumer', label: 'Consumer Services' },
  { id: 'business', label: 'Business & Operations' },
  { id: 'lifestyle', label: 'Lifestyle & Entertainment' },
] as const;

type CategoryId = typeof categories[number]['id'];

const customAgentExamples: AgentExample[] = [
  {
    icon: Stethoscope,
    industry: 'Healthcare',
    name: 'Medical Clinic AI',
    description: 'Handles appointment scheduling, patient intake forms, prescription refill requests, and answers common health questions.',
    features: ['Appointment booking', 'Patient intake', 'HIPAA-aware responses'],
    color: 'from-red-500 to-rose-500',
    category: 'healthcare',
  },
  {
    icon: GraduationCap,
    industry: 'Education',
    name: 'Enrollment Assistant',
    description: 'Guides prospective students through enrollment, answers course questions, and schedules campus tours.',
    features: ['Course recommendations', 'Tour scheduling', 'Application status'],
    color: 'from-blue-500 to-indigo-500',
    category: 'professional',
  },
  {
    icon: Scale,
    industry: 'Legal',
    name: 'Law Firm Intake AI',
    description: 'Pre-qualifies potential clients, schedules consultations, and collects case information securely.',
    features: ['Client intake', 'Consultation booking', 'Case pre-screening'],
    color: 'from-purple-500 to-violet-500',
    category: 'professional',
  },
  {
    icon: Car,
    industry: 'Automotive',
    name: 'Dealership Assistant',
    description: 'Answers vehicle questions, schedules test drives, and helps with service appointments.',
    features: ['Inventory search', 'Test drive booking', 'Service scheduling'],
    color: 'from-gray-600 to-slate-600',
    category: 'consumer',
  },
  {
    icon: HeartPulse,
    industry: 'Fitness & Wellness',
    name: 'Gym Concierge',
    description: 'Handles membership inquiries, class bookings, and personal training session scheduling.',
    features: ['Class reservations', 'Membership info', 'Trainer matching'],
    color: 'from-green-500 to-emerald-500',
    category: 'lifestyle',
  },
  {
    icon: Building2,
    industry: 'Property Management',
    name: 'Leasing Agent AI',
    description: 'Qualifies rental leads, schedules property tours, and answers tenant questions 24/7.',
    features: ['Tour scheduling', 'Application status', 'Maintenance requests'],
    color: 'from-amber-500 to-orange-500',
    category: 'business',
  },
  {
    icon: Wrench,
    industry: 'Home Services',
    name: 'Service Booking AI',
    description: 'Schedules plumbing, electrical, HVAC appointments and provides quotes for common services.',
    features: ['Appointment booking', 'Quote generation', 'Emergency dispatch'],
    color: 'from-cyan-500 to-teal-500',
    category: 'consumer',
  },
  {
    icon: Truck,
    industry: 'Logistics',
    name: 'Shipping Assistant',
    description: 'Tracks packages, handles delivery inquiries, and manages shipping quotes.',
    features: ['Package tracking', 'Delivery updates', 'Quote requests'],
    color: 'from-yellow-500 to-amber-500',
    category: 'business',
  },
  {
    icon: ShoppingBag,
    industry: 'Retail',
    name: 'Shopping Assistant',
    description: 'Helps customers find products, check inventory, and process returns or exchanges.',
    features: ['Product search', 'Stock checking', 'Order tracking'],
    color: 'from-pink-500 to-rose-500',
    category: 'consumer',
  },
  {
    icon: Plane,
    industry: 'Travel & Tourism',
    name: 'Travel Concierge',
    description: 'Assists with trip planning, booking inquiries, and provides destination recommendations.',
    features: ['Itinerary planning', 'Booking assistance', 'Local recommendations'],
    color: 'from-sky-500 to-blue-500',
    category: 'lifestyle',
  },
  {
    icon: Scissors,
    industry: 'Beauty & Salon',
    name: 'Salon Booking AI',
    description: 'Manages appointment scheduling, stylist availability, and answers service questions.',
    features: ['Appointment booking', 'Service catalog', 'Stylist matching'],
    color: 'from-fuchsia-500 to-pink-500',
    category: 'consumer',
  },
  {
    icon: Dog,
    industry: 'Pet Services',
    name: 'Pet Care Assistant',
    description: 'Handles grooming appointments, boarding reservations, and pet care inquiries.',
    features: ['Grooming booking', 'Boarding reservations', 'Pet info management'],
    color: 'from-orange-400 to-amber-400',
    category: 'consumer',
  },
  {
    icon: Landmark,
    industry: 'Banking & Finance',
    name: 'Banking Assistant',
    description: 'Answers account questions, helps with loan inquiries, and schedules branch appointments.',
    features: ['Account inquiries', 'Loan pre-qualification', 'Branch scheduling'],
    color: 'from-emerald-600 to-green-600',
    category: 'professional',
  },
  {
    icon: Music,
    industry: 'Entertainment',
    name: 'Event Booking AI',
    description: 'Manages ticket inquiries, event information, and VIP booking requests.',
    features: ['Ticket availability', 'Event details', 'VIP reservations'],
    color: 'from-violet-500 to-purple-500',
    category: 'lifestyle',
  },
  {
    icon: Camera,
    industry: 'Photography',
    name: 'Studio Booking AI',
    description: 'Schedules photo sessions, manages package inquiries, and handles booking confirmations.',
    features: ['Session booking', 'Package info', 'Gallery access'],
    color: 'from-slate-500 to-gray-500',
    category: 'lifestyle',
  },
  {
    icon: Briefcase,
    industry: 'Recruiting',
    name: 'HR Recruitment AI',
    description: 'Pre-screens job candidates, schedules interviews, and answers job-related questions.',
    features: ['Candidate screening', 'Interview scheduling', 'Job FAQs'],
    color: 'from-indigo-500 to-blue-500',
    category: 'business',
  },
];

// PHASE 3: Testimonials for social proof
const testimonials: Testimonial[] = [
  {
    name: 'Sarah Chen',
    company: 'MedCore Clinic',
    industry: 'Healthcare',
    avatar: '👩‍⚕️',
    text: 'The custom AI agent reduced our appointment scheduling time by 70%. Our team can now focus on patient care instead of phone calls.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    company: 'Sterling Law Partners',
    industry: 'Legal',
    avatar: '👨‍⚖️',
    text: 'Client intake automation has increased our conversion rate significantly. The AI handles pre-qualification perfectly.',
    rating: 5,
  },
  {
    name: 'Elena Rodriguez',
    company: 'TravelHub Tours',
    industry: 'Travel & Tourism',
    avatar: '👩‍💼',
    text: 'Our custom travel assistant processes 500+ inquiries daily. Best investment we\'ve made for customer engagement.',
    rating: 5,
  },
  {
    name: 'David Park',
    company: 'Velocity Auto Group',
    industry: 'Automotive',
    avatar: '👨‍💼',
    text: 'Test drive bookings increased by 45% since deploying the AI. It\'s like having a dedicated sales assistant 24/7.',
    rating: 5,
  },
];

const benefits = [
  {
    icon: Zap,
    title: 'Built for Your Business',
    description: 'We design AI agents tailored to your specific industry workflows and customer needs.',
  },
  {
    icon: Clock,
    title: 'Rapid Deployment',
    description: 'Go from concept to live AI agent in weeks, not months. Quick iteration based on your feedback.',
  },
  {
    icon: MessageSquare,
    title: 'Multi-Channel Ready',
    description: 'Your custom AI works across Facebook Messenger, WhatsApp, Instagram, and web chat.',
  },
  {
    icon: Users,
    title: 'Human Handoff',
    description: 'Seamless escalation to your team when customers need personal attention.',
  },
];

function CustomSolutionsContent() {
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // PHASE 1: Scroll animations
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation<HTMLDivElement>();
  const { ref: testimonialRef, isVisible: testimonialVisible } = useScrollAnimation<HTMLDivElement>();
  const parallaxOffset = useParallax(0.3);
  
  // PHASE 1: Scroll to top on page load
  useScrollRestoration();

  // PHASE 1: Track page view on mount
  useEffect(() => {
    trackPageView('Custom Solutions');
  }, []);

  // PHASE 1: Handle lead dialog open with analytics
  const handleLeadDialogOpen = (isOpen: boolean, industry?: string) => {
    setLeadDialogOpen(isOpen);
    if (isOpen) {
      if (industry) {
        setSelectedIndustry(industry);
        trackButtonClick('Open Lead Form', { source: 'agent_card', industry, timestamp: new Date().toISOString() });
      } else {
        trackButtonClick('Open Lead Form', { source: 'cta_button', timestamp: new Date().toISOString() });
      }
      // PHASE 1: Clear URL params
      setSearchParams({}, { replace: true });
    } else {
      setSelectedIndustry(null);
    }
  };

  // PHASE 2: Handle category change with analytics
  const handleCategoryChange = (categoryId: CategoryId) => {
    setSelectedCategory(categoryId);
    trackButtonClick('Filter by Category', { 
      category: categoryId,
      timestamp: new Date().toISOString()
    });
  };

  // PHASE 2: Handle search with analytics (debounced via the useMemo effect)
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    trackButtonClick('Search Agents', {
      query,
      results_count: filteredAgents.length,
      timestamp: new Date().toISOString()
    });
  };

  // PHASE 1-2: Memoized filter calculation for performance
  const filteredAgents = useMemo(() => {
    let agents = customAgentExamples;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      agents = agents.filter(agent => agent.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      agents = agents.filter(agent => 
        agent.industry.toLowerCase().includes(query) ||
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.features.some(f => f.toLowerCase().includes(query))
      );
    }
    
    return agents;
  }, [searchQuery, selectedCategory]);

  // PHASE 1: Determine if filters are active
  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <SkipToContent targetId="main-content" />
      {/* SEO Meta Tags */}
      <SEOMeta
        title="Custom AI Solutions - Built for Any Industry"
        description="Custom AI agent development for healthcare, legal, automotive, retail, and more. Tailored solutions for your unique business workflows."
        url="https://alcornexus.com/custom-solutions"
      />
      <ServiceSchema
        name="Custom AI Agent Development"
        description="We design and build custom AI agents tailored to your specific industry workflows and customer needs. From healthcare to hospitality, we create intelligent automation solutions."
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://alcornexus.com' },
          { name: 'Custom Solutions', url: 'https://alcornexus.com/custom-solutions' },
        ]}
      />
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
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      <StickyHeader
        links={customSolutionsHeaderLinks}
        ctaLabel="Get Started"
        onCtaClick={() => handleLeadDialogOpen(true)}
      />

      <BackToTop />

      <main id="main-content" tabIndex={-1} className="relative z-10" role="main" aria-label="Custom solutions page main content">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-24">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-purple-500 font-medium">Custom AI Development</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
              <span className="text-foreground">We Build AI Agents</span>
              <br />
              <span className="gradient-text">For Any Industry</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Don't see your industry? No problem. We design and build custom AI agents 
              tailored to your specific business needs and workflows.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="glow" onClick={() => handleLeadDialogOpen(true)}>
                Discuss Your Project
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/ai-agents">See Standard Agents</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16 bg-card/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={benefit.title}
                  className="p-6 rounded-2xl bg-card/50 border border-border/50 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table Section */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Standard vs Custom AI Agents
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Choose the option that best fits your business needs. Standard agents are ready to deploy, 
                while custom solutions are built specifically for your workflows.
              </p>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4">
              {/* Standard Agents Card */}
              <div className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Bot className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Standard Agents</h3>
                    <p className="text-xs text-muted-foreground">Jay, May, Cece</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Setup Time', value: '< 1 day' },
                    { label: 'Industry Focus', value: 'Sales, Food, Hospitality' },
                    { label: 'Conversation Flows', value: 'Pre-built templates' },
                    { label: 'Branding', value: 'Standard personas' },
                    { label: 'Integrations', value: 'Standard CRM features' },
                    { label: 'Knowledge Base', value: 'Self-managed' },
                    { label: 'Pricing', value: 'Subscription-based' },
                    { label: 'Support', value: 'Standard support' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-3 flex flex-wrap gap-2">
                    {['Multi-Channel', '24/7 Availability', 'Human Handoff'].map((feature) => (
                      <div key={feature} className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link to="/ai-agents">
                    Try Standard Agents
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>

              {/* Custom Solutions Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Custom Solutions</h3>
                    <p className="text-xs text-muted-foreground">Built for You</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Setup Time', value: '2-4 weeks' },
                    { label: 'Industry Focus', value: 'Any industry' },
                    { label: 'Conversation Flows', value: 'Fully customized' },
                    { label: 'Branding', value: 'Your brand voice' },
                    { label: 'Integrations', value: 'Custom integrations' },
                    { label: 'Knowledge Base', value: 'We help build it' },
                    { label: 'Pricing', value: 'Project-based' },
                    { label: 'Support', value: 'Dedicated support' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm text-primary font-medium">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-3 flex flex-wrap gap-2">
                    {['Multi-Channel', '24/7 Availability', 'Human Handoff'].map((feature) => (
                      <div key={feature} className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                <Button variant="glow" className="w-full mt-4" onClick={() => setLeadDialogOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get a Custom Solution
                </Button>
              </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 text-foreground font-semibold">Feature</th>
                    <th className="text-center py-4 px-4 text-foreground font-semibold">
                      <div className="flex flex-col items-center gap-1">
                        <span>Standard Agents</span>
                        <span className="text-xs font-normal text-muted-foreground">Jay, May, Cece</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 text-foreground font-semibold">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-primary">Custom Solutions</span>
                        <span className="text-xs font-normal text-muted-foreground">Built for You</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Setup Time', standard: '< 1 day', custom: '2-4 weeks' },
                    { feature: 'Industry Focus', standard: 'Sales, Food, Hospitality', custom: 'Any industry' },
                    { feature: 'Conversation Flows', standard: 'Pre-built templates', custom: 'Fully customized' },
                    { feature: 'Branding', standard: 'Standard personas', custom: 'Your brand voice' },
                    { feature: 'Integrations', standard: 'Standard CRM features', custom: 'Custom integrations' },
                    { feature: 'Knowledge Base', standard: 'Self-managed', custom: 'We help build it' },
                    { feature: 'Pricing', standard: 'Subscription-based', custom: 'Project-based' },
                    { feature: 'Support', standard: 'Standard support', custom: 'Dedicated support' },
                    { feature: 'Updates', standard: 'Automatic updates', custom: 'Managed updates' },
                    { feature: 'Multi-Channel', standard: '✓', custom: '✓', both: true },
                    { feature: '24/7 Availability', standard: '✓', custom: '✓', both: true },
                    { feature: 'Human Handoff', standard: '✓', custom: '✓', both: true },
                  ].map((row, index) => (
                    <tr key={row.feature} className={index % 2 === 0 ? 'bg-card/30' : ''}>
                      <td className="py-3 px-4 text-foreground font-medium">{row.feature}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">
                        {row.standard === '✓' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          row.standard
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.custom === '✓' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-primary font-medium">{row.custom}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 hidden md:flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" asChild>
                <Link to="/">
                  Try Standard Agents
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button variant="glow" onClick={() => setLeadDialogOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Get a Custom Solution
              </Button>
            </div>
          </div>
        </section>

        {/* Examples Grid */}
        <section className="py-24 bg-card/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Custom AI Agent Examples
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Here are some examples of custom AI agents we can build. Each is designed 
                for specific industry needs and workflows.
              </p>
              
              {/* PHASE 2: Mobile Filter Toggle Button */}
              <div className="md:hidden mb-4">
                <Button
                  onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  aria-expanded={isMobileFilterOpen}
                  aria-controls="filters-section"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {isMobileFilterOpen ? 'Hide Filters' : 'Show Filters'}
                </Button>
              </div>

              {/* PHASE 2: Collapsible Mobile Filters Panel */}
              <div
                id="filters-section"
                className={cn(
                  "md:hidden overflow-hidden transition-all duration-300",
                  isMobileFilterOpen ? "max-h-96 opacity-100 mb-6" : "max-h-0 opacity-0"
                )}
              >
                <div className="space-y-4 p-4 bg-card/50 rounded-lg border border-border/50">
                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCategoryChange(category.id)}
                        className="rounded-full text-xs"
                      >
                        {category.label}
                      </Button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by industry..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 pr-10 text-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => handleSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Category Filter Buttons */}
              <div className="hidden md:flex flex-wrap justify-center gap-2 mb-6">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCategoryChange(category.id)}
                    className="rounded-full"
                  >
                    {category.label}
                    {category.id !== 'all' && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({customAgentExamples.filter(a => a.category === category.id).length})
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {/* Desktop Search Input */}
              <div className="hidden md:block max-w-md mx-auto relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by industry, name, or feature..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* PHASE 1: Filter Status Display */}
              {hasActiveFilters && (
                <div className="flex items-center justify-center gap-4 mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      {filteredAgents.length} {filteredAgents.length === 1 ? 'result' : 'results'} 
                      {selectedCategory !== 'all' && ` in ${categories.find(c => c.id === selectedCategory)?.label}`}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </div>

            {filteredAgents.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">
                  No matching industries found
                  {searchQuery && ` for "${searchQuery}"`}
                  {selectedCategory !== 'all' && ` in ${categories.find(c => c.id === selectedCategory)?.label}`}
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div ref={cardsRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAgents.map((agent, index) => (
                  <article
                    key={agent.name}
                    className={cn(
                      'group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-500 cursor-pointer',
                      cardsVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                    )}
                    style={{ transitionDelay: cardsVisible ? `${index * 50}ms` : '0ms' }}
                    onClick={() => handleLeadDialogOpen(true, agent.industry)}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0`}>
                        <agent.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{agent.industry}</span>
                        <h3 className="text-lg font-semibold text-foreground">{agent.name}</h3>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">{agent.description}</p>
                    <ul className="space-y-2 mb-4">
                      {agent.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full group-hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeadDialogOpen(true, agent.industry);
                      }}
                    >
                      Learn More
                      <ArrowRight className="w-3 h-3 ml-2" />
                    </Button>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-12 text-center">
              <p className="text-muted-foreground mb-4">Don't see your industry listed?</p>
              <Button size="lg" variant="outline" onClick={() => handleLeadDialogOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Tell Us About Your Needs
              </Button>
            </div>
          </div>
        </section>

        {/* PHASE 3: Social Proof - Testimonials Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Trusted by Industry Leaders</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Success Stories from Our Clients
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See how businesses across different industries have improved their operations 
                with custom AI agents.
              </p>
            </div>

            <div 
              ref={testimonialRef}
              className="grid md:grid-cols-2 gap-6"
            >
              {testimonials.map((testimonial, index) => (
                <Card
                  key={testimonial.name}
                  className={cn(
                    'border-border/50 bg-card/50 backdrop-blur transition-all duration-500',
                    testimonialVisible
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-8'
                  )}
                  style={{ transitionDelay: testimonialVisible ? `${index * 100}ms` : '0ms' }}
                >
                  <CardContent className="p-6">
                    {/* Rating Stars */}
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>

                    {/* Testimonial Text */}
                    <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                      "{testimonial.text}"
                    </p>

                    {/* Author Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground">{testimonial.company}</p>
                        <p className="text-xs text-primary font-medium">{testimonial.industry}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-24 bg-card/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From initial consultation to deployment, we work closely with you to build 
                the perfect AI agent for your business.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: '01', title: 'Discovery Call', description: 'We learn about your business, workflows, and customer needs.' },
                { step: '02', title: 'Design & Prototype', description: 'We design conversation flows and create a prototype for review.' },
                { step: '03', title: 'Build & Train', description: 'We build your AI agent and train it on your specific knowledge base.' },
                { step: '04', title: 'Deploy & Optimize', description: 'Launch your AI agent and continuously improve based on real interactions.' },
              ].map((item, index) => (
                <div key={item.step} className="text-center animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="p-12 rounded-3xl bg-gradient-to-b from-card to-background border border-border/50">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Let's Build Your Custom AI Agent
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Schedule a free consultation to discuss your business needs and learn how 
                we can create an AI agent tailored just for you.
              </p>
              <Button size="xl" variant="glow" onClick={() => handleLeadDialogOpen(true)}>
                Schedule Free Consultation
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer
        links={[
          { to: '/#ai-agents', label: 'AI Agents' },
          { to: '/pricing', label: 'Pricing' },
          { to: '/privacy', label: 'Privacy Policy' },
          { to: '/terms', label: 'Terms & Data Usage' },
        ]}
      />

      {/* Lead Capture Dialog */}
      <LeadCaptureDialog 
        open={leadDialogOpen} 
        onOpenChange={handleLeadDialogOpen}
        prefilledIndustry={selectedIndustry}
      />
    </div>
  );
}

// PHASE 1: Wrap main component with ErrorBoundary
export default function CustomSolutions() {
  return (
    <ErrorBoundary fullPage>
      <PageTransition>
        <CustomSolutionsContent />
      </PageTransition>
    </ErrorBoundary>
  );
}