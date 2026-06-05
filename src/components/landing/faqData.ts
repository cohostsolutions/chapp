export const landingFaqs = [
  {
    question: 'How do the AI agents work?',
    answer: 'Our AI agents (Jay, May, and Cece) are specialized conversational assistants that connect to your social media channels. When a customer messages you on Facebook Messenger, WhatsApp, or Instagram, the AI responds instantly based on your business knowledge base. They can qualify leads, take orders, check availability, and schedule appointments-all automatically.',
  },
  {
    question: 'Which AI agent is right for my business?',
    answer: 'Jay is designed for sales and lead qualification-perfect for real estate, insurance, or any business that needs to nurture and qualify leads. May handles food ordering and pickup scheduling for restaurants and cafes. Cece manages room bookings and guest inquiries for hotels, Airbnbs, and hospitality businesses. You choose one agent per organization based on your industry.',
  },
  {
    question: 'Can the AI handle multiple languages?',
    answer: 'Yes. Our AI agents automatically detect the language your customer uses and respond in the same language. This includes support for code-mixed languages like Taglish (Tagalog-English), making it a strong fit for the Philippine market.',
  },
  {
    question: 'What happens when a lead needs human attention?',
    answer: 'Our AI uses smart qualification to identify when leads are ready for human contact. Cold leads continue AI nurturing. Warm leads trigger alerts so agents can choose to take over. Hot leads automatically schedule callbacks on your Google Calendar. Agents can also manually take over any conversation at any time.',
  },
  {
    question: 'How do I connect my social media accounts?',
    answer: 'In your dashboard, go to Social Platforms and add your Facebook Page, WhatsApp Business, or Instagram account. We provide a webhook URL that you configure in your Meta Business settings. Once connected, all incoming messages are automatically routed to your AI agent.',
  },
  {
    question: 'Is my customer data secure?',
    answer: 'Yes. AlCor Nexus uses role-based access control and data isolation between organizations so each business only sees its own leads, conversations, and data. Communications are encrypted and handled using standard security best practices.',
  },
  {
    question: 'Can I customize what the AI knows about my business?',
    answer: 'Yes. Each organization has its own knowledge base where you can add information about your products, services, pricing, and policies. You can upload documents or create manual entries, and the AI uses that information to answer customer questions accurately and consistently.',
  },
  {
    question: 'What is browser-to-phone calling?',
    answer: 'Browser-to-phone calling lets your agents call leads directly from the CRM dashboard using their browser. Calls connect without needing a separate phone or SIM card, and call activity is logged for follow-up tracking.',
  },
] as const;
