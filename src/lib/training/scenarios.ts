import { Scenario } from './types';

export const scenarios: Scenario[] = [
  {
    id: 'cs-delayed-order',
    title: 'Customer Service: Delayed Order Complaint',
    description: 'Handle a frustrated customer whose order is delayed beyond the promised delivery date.',
    industry: 'ecommerce',
    difficulty: 'medium',
    persona: {
      name: 'Alex',
      mood: 'frustrated',
      goals: ['Get a clear resolution', 'Receive compensation or expedited shipping'],
      constraints: ['Limited time', 'Does not want to repeat information'],
      background: 'Ordered a gift needed by the weekend; delivery slipped twice.'
    },
    context: 'Carrier delays have impacted shipments for some regions. Your policy allows refunds or reshipments with express shipping for qualifying cases.',
    objectives: [
      'Acknowledge and validate the customer’s frustration',
      'Ask specific clarifying questions to understand constraints',
      'Offer an appropriate resolution per policy',
      'Confirm agreement and next steps'
    ]
  },
  {
    id: 'sales-price-objection',
    title: 'Sales: Price Objection for SaaS',
    description: 'Address a prospect who thinks your price is too high compared to competitors.',
    industry: 'saas',
    difficulty: 'hard',
    persona: {
      name: 'Jordan',
      mood: 'skeptical',
      goals: ['Understand ROI clearly', 'Negotiate pricing or extract added value'],
      constraints: ['Budget cap this quarter'],
      background: 'Evaluating tools; competitor offers lower sticker price but fewer features.'
    },
    context: 'Your product reduces manual work via automation and analytics; typical payback is 3 months for mid-market teams.',
    objectives: [
      'Explore pain points and quantify impact',
      'Align value with outcomes and ROI',
      'Handle objections professionally',
      'Establish clear next steps'
    ]
  }
];
