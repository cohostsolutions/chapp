export type OnboardingAgentType = 'jay' | 'may' | 'cece';

type AgentOnboardingContent = {
  name: string;
  title: string;
  previewGreeting: string;
  chatPlaceholder: string;
  welcomeFocus: string;
  welcomeAction: string;
  completionNextStep: string;
};

const agentOnboardingContent: Record<OnboardingAgentType, AgentOnboardingContent> = {
  jay: {
    name: 'Jay',
    title: 'Sales Assistant',
    previewGreeting: "Hi, I’m Jay. I help qualify leads, answer product questions, and move serious buyers toward the next step. What are you looking for today?",
    chatPlaceholder: 'Ask about offers, pricing, bookings, or your sales flow...',
    welcomeFocus: 'qualify leads, handle early objections, and move serious buyers toward booked next steps',
    welcomeAction: 'Start by reviewing your lead flow, products or services, and the opening message Jay should use.',
    completionNextStep: 'Review live conversations, tighten your qualification flow, and confirm Jay is escalating the right leads at the right time.',
  },
  may: {
    name: 'May',
    title: 'Order Assistant',
    previewGreeting: "Hi, I’m May. I help customers browse the menu, answer quick questions, and turn messages into confirmed orders or reservations. What can I help with?",
    chatPlaceholder: 'Ask about menu items, reservations, order flow, or pickup details...',
    welcomeFocus: 'handle menu questions, guide reservations, and convert chats into clean confirmed orders',
    welcomeAction: 'Start by reviewing your menu, reservation rules, and the opening message May should use with customers.',
    completionNextStep: 'Check your menu setup, verify reservation and order rules, and make sure May is guiding customers toward confirmed bookings and pickups.',
  },
  cece: {
    name: 'Cece',
    title: 'Hotel Concierge',
    previewGreeting: "Hello, I’m Cece. I help guests with room questions, availability, and booking details so they can move from inquiry to confirmed stay faster. How may I assist you today?",
    chatPlaceholder: 'Ask about availability, room options, amenities, or booking details...',
    welcomeFocus: 'handle guest inquiries, explain room options, and move qualified guests toward confirmed stays',
    welcomeAction: 'Start by reviewing your room inventory, booking rules, payment guidance, and the opening message Cece should send to guests.',
    completionNextStep: 'Validate room content, booking rules, and payment guidance so Cece can move guests from inquiry to confirmed stay without confusion.',
  },
};

export function getAgentOnboardingContent(agentType?: string | null): AgentOnboardingContent {
  if (agentType === 'may' || agentType === 'cece') {
    return agentOnboardingContent[agentType];
  }

  return agentOnboardingContent.jay;
}