import { Bot, Utensils, Hotel, type LucideIcon } from 'lucide-react';

export interface Agent {
  name: string;
  role: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  description: string;
  longDescription: string;
  features: string[];
  useCases: string[];
  popular: boolean;
  price: number;
}

export const AGENTS: Agent[] = [
  {
    name: 'Jay',
    role: 'Sales Agent',
    icon: Bot,
    color: 'from-primary to-primary/70',
    bgColor: 'bg-primary/10',
    textColor: 'text-primary',
    borderColor: 'border-primary/50',
    description: 'AI-powered lead qualification and nurturing for sales teams.',
    longDescription: 'Jay is your 24/7 sales assistant that qualifies leads, answers questions, and works with your configurable agent handoff workflow when human help is needed.',
    features: [
      'Lead qualification 24/7',
      'Configurable handoff workflow',
      'Google Calendar integration',
      'Meta integration (FB, WhatsApp, IG)',
      'Temperature-based lead prioritization',
      'Knowledge base support',
      'Multi-language support (Taglish)',
    ],
    useCases: [
      'Real estate investment firms',
      'Insurance agencies',
      'Financial services',
      'B2B sales teams',
    ],
    popular: true,
    price: 299,
  },
  {
    name: 'May',
    role: 'Food Business',
    icon: Utensils,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500/50',
    description: 'Order taking and pickup scheduling for restaurants and cafes.',
    longDescription: 'May handles your food orders automatically, manages your menu, and schedules pickups - even during your busiest hours.',
    features: [
      'Automated order taking',
      'Menu management',
      'Pickup scheduling',
      'Meta integration (FB, WhatsApp, IG)',
      'Order notifications',
      'Knowledge base support',
      'Multi-language support (Taglish)',
    ],
    useCases: [
      'Restaurants & cafes',
      'Food trucks',
      'Catering services',
      'Cloud kitchens',
    ],
    popular: false,
    price: 249,
  },
  {
    name: 'Cece',
    role: 'Hotel Concierge',
    icon: Hotel,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    borderColor: 'border-emerald-500/50',
    description: 'Room booking and guest management for hospitality businesses.',
    longDescription: 'Cece is your virtual concierge that handles bookings, checks availability, and answers guest inquiries around the clock.',
    features: [
      'Real-time availability checking',
      'Room booking management',
      'Meta integration (FB, WhatsApp, IG)',
      'Automated guest messaging',
      'Knowledge base support',
      'Multi-language support (Taglish)',
    ],
    useCases: [
      'Hotels & resorts',
      'Bed & breakfasts',
      'Vacation rentals',
      'Boutique inns',
    ],
    popular: false,
    price: 279,
  },
];
