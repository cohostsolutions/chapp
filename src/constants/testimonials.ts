export interface Testimonial {
  name: string;
  company: string;
  industry: string;
  avatar: string;
  text: string;
  rating: number;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Maria Santos',
    company: 'Santos Realty',
    industry: 'Real Estate',
    avatar: '/avatars/maria.png',
    text: 'Jay has transformed our lead response time. We never miss a hot lead, and our agents can focus on closing deals.',
    rating: 5,
  },
  {
    name: 'Carlos Dela Cruz',
    company: 'Dela Cruz Catering',
    industry: 'Food Service',
    avatar: '/avatars/carlos.png',
    text: 'May handles our orders flawlessly, even during peak hours. Our customers love the quick responses!',
    rating: 5,
  },
  {
    name: 'Liza Tan',
    company: 'Tan Boutique Hotel',
    industry: 'Hospitality',
    avatar: '/avatars/liza.png',
    text: 'Cece is like having a 24/7 concierge. Guest satisfaction is up and our staff workload is down.',
    rating: 5,
  },
];
