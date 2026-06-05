import { Building2, HelpCircle, MessageSquare, Smile, type LucideIcon } from 'lucide-react';

export interface KnowledgeSectionDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  placeholder: string;
  tips: string[];
}

export const knowledgeSections: KnowledgeSectionDefinition[] = [
  {
    id: 'tone-personality',
    label: 'Tone & Personality',
    icon: Smile,
    description: 'Define how your AI agent should communicate with customers',
    placeholder: `Example entries for this section:

• Brand Voice: "Our brand voice is friendly, professional, and empathetic. We use conversational language while maintaining authority."

• Communication Style: "Always greet customers warmly. Use their name when available. Avoid jargon and technical terms unless necessary."

• Response Tone: "Be helpful and solution-oriented. If we can't help, apologize sincerely and offer alternatives."`,
    tips: [
      'Define your brand personality (e.g., friendly, formal, casual)',
      'Specify preferred greetings and sign-offs',
      'Include examples of ideal responses',
      'Mention any phrases or words to avoid',
    ],
  },
  {
    id: 'business-overview',
    label: 'Business Overview',
    icon: Building2,
    description: 'Core information about your business positioning, audience, and value',
    placeholder: `Example entries for this section:

• About Us: "We are a real estate investment company based in Manila, specializing in pre-selling condominiums in BGC and Makati."

• Positioning: "We help first-time and seasoned investors find high-potential pre-selling properties with clear guidance and flexible purchase options."

• Operating Hours: "Our sales team is available Monday-Saturday, 9AM-6PM. The AI handles inquiries 24/7."`,
    tips: [
      'Include company background and mission',
      'Describe who you serve and what business outcome you provide',
      'Use value proposition instead of repeating products or services listed elsewhere',
      'Specify operating hours and locations',
    ],
  },
  {
    id: 'faqs',
    label: 'FAQs',
    icon: HelpCircle,
    description: 'Common questions and their answers',
    placeholder: `Example entries for this section:

• Payment Terms: "Q: What are your payment terms? A: We offer flexible payment options including spot cash (10% discount), bank financing, and in-house financing up to 5 years."

• Refund Policy: "Q: Can I get a refund? A: Reservations are non-refundable but can be transferred to another buyer with proper documentation."`,
    tips: [
      'Use Q&A format for clarity',
      'Cover the most frequently asked questions',
      'Include detailed, helpful answers',
      'Update regularly based on customer inquiries',
    ],
  },
  {
    id: 'sample-conversations',
    label: 'Sample Conversations',
    icon: MessageSquare,
    description: 'Example dialogues showing ideal AI responses',
    placeholder: `Example entries for this section:

• Inquiry Handling:
"Customer: Hi, I'm interested in your 2BR units.
AI: Hello! Thank you for your interest in our 2BR units. We have several beautiful options available in BGC. May I know your preferred location and budget range so I can recommend the best fit for you?"

• Objection Handling:
"Customer: That's too expensive for me.
AI: I understand budget is an important consideration. We do have flexible payment options that might work for you. Would you like me to share our financing plans? Many of our clients find the monthly payments very manageable."`,
    tips: [
      'Include successful conversation examples',
      'Show how to handle common objections',
      'Demonstrate proper handoff scenarios',
      'Add examples in different languages if needed',
    ],
  },
];