import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AIAgents from '../AIAgents';

const mockTrackEvent = vi.fn();
const mockScrollIntoView = vi.fn();

vi.mock('@/hooks/useAnalyticsTracking', () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock('@/hooks/useScrollAnimation', () => ({
  useScrollAnimation: () => ({ ref: vi.fn(), isVisible: true }),
}));

vi.mock('@/hooks/useParallax', () => ({
  useParallax: () => 0,
}));

vi.mock('@/hooks/useScrollRestoration', () => ({
  useScrollRestoration: vi.fn(),
}));

vi.mock('@/components/landing/StickyHeader', () => ({
  StickyHeader: ({ onCtaClick }: { onCtaClick: () => void }) => (
    <button onClick={onCtaClick}>Header CTA</button>
  ),
}));

vi.mock('@/components/landing/Footer', () => ({
  Footer: () => <div>Footer Mock</div>,
}));

vi.mock('@/components/landing/PageTransition', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/landing/CursorGlow', () => ({
  CursorGlow: () => null,
}));

vi.mock('@/components/landing/LeadCaptureDialog', () => ({
  LeadCaptureDialog: ({
    open,
    prefilledAgent,
  }: {
    open: boolean;
    prefilledAgent?: { type: string; name: string; role: string } | null;
  }) =>
    open ? <div>{prefilledAgent ? `Lead Dialog: ${prefilledAgent.name} (${prefilledAgent.role})` : 'Lead Dialog'}</div> : null,
}));

vi.mock('@/components/landing/AgentDetailsDialog', () => ({
  AgentDetailsDialog: ({ open, agent, onGetStarted }: { open: boolean; agent: string; onGetStarted: () => void }) =>
    open ? (
      <div>
        <div>Agent Details: {agent}</div>
        <button onClick={onGetStarted}>Dialog Get Started</button>
      </div>
    ) : null,
}));

vi.mock('@/components/landing/AITestChat', () => ({
  AITestChat: ({ onGetStarted }: { onGetStarted: () => void }) => (
    <button onClick={onGetStarted}>Demo Get Started</button>
  ),
}));

vi.mock('@/components/landing/ScrollProgress', () => ({
  ScrollProgress: () => null,
}));

vi.mock('@/components/shared/BackToTop', () => ({
  BackToTop: () => null,
}));

vi.mock('@/components/seo/StructuredData', () => ({
  WebPageSchema: () => null,
  ProductSchema: () => null,
  BreadcrumbSchema: () => null,
  SEOMeta: () => null,
}));

vi.mock('@/components/ai-agents/AgentComparisonTable', () => ({
  AgentComparisonTable: () => <div>Comparison Table Mock</div>,
}));

vi.mock('@/components/ai-agents/TestimonialsSection', () => ({
  TestimonialsSection: () => <div>Testimonials Mock</div>,
}));

vi.mock('@/components/ai-agents/AgentVideoDemo', () => ({
  AgentVideoDemo: () => <div>Video Demo Mock</div>,
}));

describe('AIAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: mockScrollIntoView,
    });
  });

  test('scrolls to the embedded live demo from the hero CTA', () => {
    render(
      <MemoryRouter>
        <AIAgents />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /try live demo/i }));

    expect(mockScrollIntoView).toHaveBeenCalled();
  });

  test('opens the selected agent details from the card shell', () => {
    render(
      <MemoryRouter>
        <AIAgents />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /learn more about jay/i }));

    expect(screen.getByText('Agent Details: jay')).toBeInTheDocument();
  });

  test('prefills the lead dialog when using an agent-specific get started CTA', () => {
    render(
      <MemoryRouter>
        <AIAgents />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /get started with jay/i }));

    expect(screen.getByText('Lead Dialog: Jay (Sales Agent)')).toBeInTheDocument();
  });

  test('passes agent context from the details dialog into the lead dialog', () => {
    render(
      <MemoryRouter>
        <AIAgents />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /learn more about may/i }));
    fireEvent.click(screen.getByRole('button', { name: /dialog get started/i }));

    expect(screen.getByText('Lead Dialog: May (Food Business)')).toBeInTheDocument();
  });
});