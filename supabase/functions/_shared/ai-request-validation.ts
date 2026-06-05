export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ValidateEvaluateSessionResult {
  ok: boolean;
  error?: string;
  normalizedTranscript?: TranscriptMessage[];
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_TRANSCRIPT_MESSAGES = 120;
export const MAX_TRANSCRIPT_MESSAGE_LENGTH = 4000;

export const MAX_SUMMARY_MESSAGES = 80;
export const MAX_SUMMARY_MESSAGE_LENGTH = 10000;
export const MAX_LEAD_NAME_LENGTH = 120;

export const MAX_DEMO_MESSAGE_LENGTH = 2000;
export const MAX_DEMO_KNOWLEDGE_BASE_LENGTH = 12000;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function normalizeLeadName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LEAD_NAME_LENGTH);
}

export function normalizeKnowledgeBase(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, MAX_DEMO_KNOWLEDGE_BASE_LENGTH);
}

export function normalizeMessage(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return null;
  return trimmed;
}

export function normalizeTranscriptMessages(value: unknown): TranscriptMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_TRANSCRIPT_MESSAGES)
    .filter((msg: unknown) => {
      if (!msg || typeof msg !== 'object') return false;
      const m = msg as { role?: unknown; content?: unknown };
      return (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
    })
    .map((msg: { role: 'user' | 'assistant'; content: string }) => ({
      role: msg.role,
      content: msg.content.slice(0, MAX_TRANSCRIPT_MESSAGE_LENGTH),
    }));
}

export function validateEvaluateSessionInput(payload: {
  moduleId?: unknown;
  sessionId?: unknown;
  organizationId?: unknown;
  transcript?: unknown;
}): ValidateEvaluateSessionResult {
  if (!isUuid(payload.moduleId)) {
    return { ok: false, error: 'Valid moduleId is required' };
  }

  if (payload.sessionId && !isUuid(payload.sessionId)) {
    return { ok: false, error: 'sessionId must be a valid UUID' };
  }

  if (!isUuid(payload.organizationId)) {
    return { ok: false, error: 'Valid organizationId is required' };
  }

  if (!Array.isArray(payload.transcript) || payload.transcript.length === 0) {
    return { ok: false, error: 'Transcript is required' };
  }

  if (payload.transcript.length > MAX_TRANSCRIPT_MESSAGES) {
    return { ok: false, error: `Transcript too long. Max ${MAX_TRANSCRIPT_MESSAGES} messages.` };
  }

  const normalizedTranscript = normalizeTranscriptMessages(payload.transcript);
  if (normalizedTranscript.length === 0) {
    return { ok: false, error: 'Transcript contains no valid messages' };
  }

  return { ok: true, normalizedTranscript };
}
