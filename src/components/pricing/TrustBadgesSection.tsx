import { Shield, Lock, Award, CheckCircle2 } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

const securityBadges = [
  { 
    icon: Shield, 
    title: 'SOC 2 Compliant', 
    description: 'Enterprise-grade security' 
  },
  { 
    icon: Lock, 
    title: 'End-to-End Encryption', 
    description: 'Your data stays protected' 
  },
  { 
    icon: Award, 
    title: 'GDPR Ready', 
    description: 'Privacy by design' 
  },
  { 
    icon: CheckCircle2, 
    title: '99.9% Uptime', 
    description: 'Reliable infrastructure' 
  },
];

const integrationPartners = [
  { name: 'Meta', logo: '📘' },
  { name: 'WhatsApp', logo: '💬' },
  { name: 'Instagram', logo: '📸' },
  { name: 'Google Calendar', logo: '📅' },
  { name: 'Viber', logo: '💜' },
  { name: 'Telegram', logo: '✈️' },
];

const clientLogos = [
  'Real Estate Firms',
  'Restaurant Chains', 
  'Hotel Groups',
  'Investment Companies',
  'Hospitality Brands',
  'Food Delivery Services',
];

export function TrustBadgesSection() {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();

  return (
    <section className="py-20 bg-gradient-to-b from-background to-card/30">
      <div 
        ref={ref}
        className={cn(
          "max-w-6xl mx-auto px-6 transition-all duration-700",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        {/* Security Certifications */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Enterprise-Grade Security & Compliance
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Your data is protected by industry-leading security standards
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {securityBadges.map((badge, index) => (
            <div 
              key={badge.title}
              className={cn(
                "p-6 rounded-2xl bg-card border border-border/50 text-center transition-all duration-500 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <badge.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{badge.title}</h3>
              <p className="text-sm text-muted-foreground">{badge.description}</p>
            </div>
          ))}
        </div>

        {/* Integration Partners */}
        <div className="mb-16">
          <h3 className="text-lg font-semibold text-foreground text-center mb-8">
            Integration Partners
          </h3>
          <div className="flex flex-wrap justify-center gap-6">
            {integrationPartners.map((partner) => (
              <div 
                key={partner.name}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-card border border-border/50 hover:border-primary/30 transition-colors"
              >
                <span className="text-xl">{partner.logo}</span>
                <span className="text-sm font-medium text-foreground">{partner.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client Industries */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Trusted by Businesses Across Industries
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {clientLogos.map((industry) => (
              <div 
                key={industry}
                className="px-4 py-2 rounded-lg bg-muted/50 text-sm text-muted-foreground"
              >
                {industry}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Join 100+ businesses already using AlCor Nexus AI agents
          </p>
        </div>
      </div>
    </section>
  );
}
