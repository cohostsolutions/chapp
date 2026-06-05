export interface Persona {
  name: string;
  mood: 'neutral' | 'curious' | 'frustrated' | 'angry' | 'skeptical' | 'busy';
  goals: string[];
  constraints?: string[];
  background?: string;
  ai_language?: string; // Language code for AI responses (en, es, fr, etc.)
}

export type Industry = 'ecommerce' | 'saas' | 'hospitality' | 'general';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  industry: Industry;
  difficulty: Difficulty;
  persona: Persona;
  context: string;
  objectives: string[]; // trainee objectives
}

export interface RubricCategory {
  id: string;
  name: string;
  description: string;
  guidelines: string[];
  weight?: number;
}

export interface CategoryScore {
  categoryId: string;
  score: number; // 1-5
  notes?: string;
}

export interface EvaluationResult {
  overallScore: number; // 1-100
  categoryScores: CategoryScore[];
  strengths: string[];
  improvements: string[];
  aiSummary?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TrainingSessionRecord {
  id: string;
  moduleId: string;
  organizationId: string;
  userId: string;
  startedAt: number;
  endedAt?: number;
  transcript: ChatMessage[];
  evaluation?: EvaluationResult;
}

export interface TrainingModule {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  industry?: Industry;
  difficulty?: Difficulty;
  persona: Persona;
  objectives: string[];
  rubric: RubricCategory[];
  visibility: 'active' | 'archived';
  first_message_sender?: 'ai' | 'trainee'; // Who sends the first message in chat mode
  call_type?: 'cold_call' | 'warm_call'; // Type of call scenario
}

export interface TrainingAnalytics {
  totalSessions: number;
  avgScore: number | null;
  activeModules: number;
  activeAgents: number;
  topModules: { id: string; title: string; count: number; avgScore: number | null }[];
  agentBreakdown?: { id: string; name: string; sessions: number; avgScore: number | null }[];
  dailyTrend: { date: string; label: string; sessions: number; avgScore: number | null }[];
  scoreDistribution: { range: string; count: number }[];
}

export interface TrainingAnalyticsFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  moduleId?: string;
}

export interface TrainingAnalyticsOptions {
  retentionDays: number | null;
  modules: { id: string; title: string }[];
  agents: { id: string; name: string }[];
}

export interface RubricTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  rubric: RubricCategory[];
  created_by?: string;
  created_at: string;
}

export function maskPII(text: string): string {
  // Redact emails
  let masked = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  // Redact phone numbers (various formats)
  masked = masked.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  // Redact credit card-like numbers
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  // Redact SSN-like patterns
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  return masked;
}
