import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

export interface PublicNavLink {
  to: string;
  label: string;
  icon?: ReactNode;
}

export interface PublicFooterLink {
  to: string;
  label: string;
  isAnchor?: boolean;
}

export const PUBLIC_SITE_URL = 'https://alcornexus.com';
export const PUBLIC_LEGAL_LAST_UPDATED = 'April 8, 2026';

export const homeHeaderLinks: PublicNavLink[] = [
  { to: '/ai-agents', label: 'AI Agents' },
  { to: '/#features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/custom-solutions', label: 'Custom Solutions', icon: <Sparkles className="w-4 h-4" /> },
];

export const aiAgentsHeaderLinks: PublicNavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/ai-agents', label: 'AI Agents' },
  { to: '/custom-solutions', label: 'Custom Solutions' },
  { to: '/pricing', label: 'Pricing' },
];

export const pricingHeaderLinks: PublicNavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/ai-agents', label: 'AI Agents' },
  { to: '/custom-solutions', label: 'Custom Solutions', icon: <Sparkles className="w-4 h-4" /> },
];

export const customSolutionsHeaderLinks: PublicNavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/ai-agents', label: 'AI Agents' },
  { to: '/pricing', label: 'Pricing' },
];

export const legalHeaderLinks: PublicNavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/ai-agents', label: 'AI Agents' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/custom-solutions', label: 'Custom Solutions' },
];

export const publicFooterLinks: PublicFooterLink[] = [
  { to: '#ai-agents', label: 'AI Agents', isAnchor: true },
  { to: '#features', label: 'Features', isAnchor: true },
  { to: '/pricing', label: 'Pricing' },
  { to: '/custom-solutions', label: 'Custom Solutions' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Data Usage' },
];
