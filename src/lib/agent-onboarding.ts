export type OnboardingAgentType = 'cece';

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
  cece: {
    name: 'Cece',
    title: 'Hotel Concierge',
    previewGreeting: "Hello, I'm Cece. I help guests with room questions, availability, and booking details so they can move from inquiry to confirmed stay faster. How may I assist you today?",
    chatPlaceholder: 'Ask about availability, room options, amenities, or booking details...',
    welcomeFocus: 'handle guest inquiries, explain room options, and move qualified guests toward confirmed stays',
    welcomeAction: 'Start by reviewing your room inventory, booking rules, payment guidance, and the opening message Cece should send to guests.',
    completionNextStep: 'Validate room content, booking rules, and payment guidance so Cece can move guests from inquiry to confirmed stay without confusion.',
  },
};

export function getAgentOnboardingContent(): AgentOnboardingContent {
  return agentOnboardingContent.cece;
}