import { z } from 'zod';
import type { KnowledgeEntry } from '@/hooks/useKnowledgeBaseContent';

function buildBusinessLocationLabel(values: {
  district?: string;
  city?: string;
  region?: string;
  country?: string;
}) {
  const parts = [values.district, values.city, values.region, values.country]
    .map((value) => value?.trim() || '')
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : '';
}

export const knowledgeSectionIds = [
  'tone-personality',
  'business-overview',
  'faqs',
  'sample-conversations',
] as const;

export type KnowledgeSectionId = (typeof knowledgeSectionIds)[number];

export const primaryVoiceOptions = [
  'Professional',
  'Casual',
  'Empathetic',
  'Humorous',
  'Authoritative',
  'Playful',
] as const;

export const emojiUsageOptions = ['none', 'sparingly', 'liberally'] as const;
export const sourcePriorityOptions = ['canonical', 'supporting', 'reference'] as const;

const commonFields = {
  tags: z.string().default(''),
  owner_name: z.string().trim().default(''),
  source_priority: z.enum(sourcePriorityOptions).default('canonical'),
  is_active: z.boolean().default(true),
};

const tonePersonalitySchema = z.object({
  category: z.literal('tone-personality'),
  primary_voice: z.array(z.enum(primaryVoiceOptions)).min(1, 'Select at least one voice trait'),
  standard_greeting: z.string().trim().min(1, 'Greeting is required'),
  standard_signoff: z.string().trim().min(1, 'Sign-off is required'),
  vocab_dos: z.string().trim().default(''),
  vocab_donts: z.string().trim().default(''),
  emoji_usage: z.enum(emojiUsageOptions),
  ...commonFields,
});

const businessOverviewSchema = z.object({
  category: z.literal('business-overview'),
  company_name: z.string().trim().min(1, 'Company name is required'),
  country: z.string().trim().default(''),
  region: z.string().trim().default(''),
  city: z.string().trim().default(''),
  district: z.string().trim().default(''),
  elevator_pitch: z.string().trim().min(1, 'Elevator pitch is required'),
  target_audience: z.string().trim().min(1, 'Target audience is required'),
  value_proposition: z.string().trim().min(1, 'Value proposition is required'),
  ...commonFields,
});

const faqsSchema = z.object({
  category: z.literal('faqs'),
  question: z.string().trim().min(1, 'Question is required'),
  answer: z.string().trim().min(1, 'Answer is required'),
  reference_link: z.union([
    z.literal(''),
    z.string().trim().url('Reference link must be a valid URL'),
  ]),
  ...commonFields,
});

const sampleConversationsSchema = z.object({
  category: z.literal('sample-conversations'),
  scenario_context: z.string().trim().min(1, 'Scenario context is required'),
  customer_says: z.string().trim().min(1, 'Customer prompt is required'),
  ideal_response: z.string().trim().min(1, 'Ideal response is required'),
  ...commonFields,
});

export const knowledgeEntryFormSchema = z.discriminatedUnion('category', [
  tonePersonalitySchema,
  businessOverviewSchema,
  faqsSchema,
  sampleConversationsSchema,
]);

export type KnowledgeEntryFormValues = z.infer<typeof knowledgeEntryFormSchema>;

export interface NormalizedKnowledgeEntryPayload {
  title: string;
  content: string;
  category: KnowledgeSectionId;
  tags: string;
  owner_name: string | null;
  source_priority: (typeof sourcePriorityOptions)[number];
  is_active: boolean;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
}

export interface KnowledgeEntryAuthoringGuidance {
  focusPoints: string[];
  avoidPoints: string[];
  note?: string;
}

export interface KnowledgeEntryConflict {
  kind: 'duplicate' | 'contradiction';
  entryId: string;
  entryTitle: string;
  description: string;
}

const METADATA_PREFIX = '<!-- KB_DYNAMIC:';

export function stripKnowledgeEntryMetadata(content: string) {
  return content.replace(/<!--\s*KB_DYNAMIC:.*?\s*-->/s, '').trim();
}

function normalizeComparisonText(value: string) {
  return value
    .toLowerCase()
    .replace(/<!--.*?-->/gs, ' ')
    .replace(/[`#*:_>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMetadata(content: string): KnowledgeEntryFormValues | null {
  const match = content.match(/<!--\s*KB_DYNAMIC:(.*?)\s*-->/s);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    const result = knowledgeEntryFormSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function serializeMetadata(values: KnowledgeEntryFormValues) {
  return `${METADATA_PREFIX}${JSON.stringify(values)} -->`;
}

function splitLinesToBullets(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');
}

function buildMarkdown(values: KnowledgeEntryFormValues) {
  switch (values.category) {
    case 'tone-personality':
      return [
        '# Tone & Personality',
        `Primary voice: ${values.primary_voice.join(', ')}`,
        `Standard greeting: ${values.standard_greeting}`,
        `Standard sign-off: ${values.standard_signoff}`,
        `Emoji usage: ${values.emoji_usage}`,
        '',
        'Vocabulary to use:',
        values.vocab_dos ? splitLinesToBullets(values.vocab_dos) : '- None provided',
        '',
        'Vocabulary to avoid:',
        values.vocab_donts ? splitLinesToBullets(values.vocab_donts) : '- None provided',
      ].join('\n');
    case 'business-overview':
      const locationLabel = buildBusinessLocationLabel(values);
      return [
        '# Business Overview',
        `Company name: ${values.company_name}`,
        ...(locationLabel ? ['', `Location: ${locationLabel}`] : []),
        '',
        'Elevator pitch:',
        values.elevator_pitch,
        '',
        'Target audience:',
        values.target_audience,
        '',
        'Value proposition:',
        values.value_proposition,
      ].join('\n');
    case 'faqs':
      return [
        '# FAQ',
        `Question: ${values.question}`,
        '',
        'Answer:',
        values.answer,
        ...(values.reference_link ? ['', `Reference link: ${values.reference_link}`] : []),
      ].join('\n');
    case 'sample-conversations':
      return [
        '# Sample Conversation',
        `Scenario context: ${values.scenario_context}`,
        '',
        'Customer says:',
        values.customer_says,
        '',
        'Ideal response:',
        values.ideal_response,
      ].join('\n');
  }
}

export function buildKnowledgeEntryPayload(values: KnowledgeEntryFormValues): NormalizedKnowledgeEntryPayload {
  let title = '';

  switch (values.category) {
    case 'tone-personality':
      title = `${values.primary_voice.join(' / ')} Voice Guidelines`;
      break;
    case 'business-overview':
      title = values.company_name;
      break;
    case 'faqs':
      title = values.question;
      break;
    case 'sample-conversations':
      title = values.scenario_context;
      break;
  }

  return {
    title,
    content: `${serializeMetadata(values)}\n${buildMarkdown(values)}`,
    category: values.category,
    tags: values.tags,
    owner_name: values.owner_name.trim() || null,
    source_priority: values.source_priority,
    is_active: values.is_active,
    reviewed_at: null,
    reviewed_by_name: null,
  };
}

export function analyzeKnowledgeEntryConflicts(
  payload: NormalizedKnowledgeEntryPayload,
  entries: KnowledgeEntry[],
  editingEntryId?: string | null
): KnowledgeEntryConflict[] {
  const normalizedTitle = normalizeComparisonText(payload.title);
  const normalizedContent = normalizeComparisonText(stripKnowledgeEntryMetadata(payload.content));

  if (!normalizedTitle) {
    return [];
  }

  return entries
    .filter((entry) => entry.id !== editingEntryId)
    .filter((entry) => entry.is_active)
    .filter((entry) => entry.category === payload.category)
    .flatMap((entry) => {
      const existingTitle = normalizeComparisonText(entry.title);
      const existingContent = normalizeComparisonText(stripKnowledgeEntryMetadata(entry.content));
      const sameTitle = existingTitle === normalizedTitle;
      const sameContent = existingContent === normalizedContent;
      const overlappingTitle =
        normalizedTitle.length >= 12
        && existingTitle.length >= 12
        && (existingTitle.includes(normalizedTitle) || normalizedTitle.includes(existingTitle));

      if ((sameTitle || overlappingTitle) && sameContent) {
        return [{
          kind: 'duplicate' as const,
          entryId: entry.id,
          entryTitle: entry.title,
          description: 'This looks very similar to an existing active entry in the same section.',
        }];
      }

      if (sameTitle && !sameContent) {
        return [{
          kind: 'contradiction' as const,
          entryId: entry.id,
          entryTitle: entry.title,
          description: 'An active entry with the same title already exists, but the underlying guidance differs.',
        }];
      }

      return [];
    })
    .slice(0, 3);
}

export function getKnowledgeEntryAuthoringGuidance(category: KnowledgeSectionId): KnowledgeEntryAuthoringGuidance {
  switch (category) {
    case 'tone-personality':
      return {
        focusPoints: [
          'Use concrete greetings, sign-offs, and vocabulary examples the AI can copy directly.',
          'Describe tone with specific language patterns rather than broad adjectives alone.',
          'Keep voice guidance stable across channels unless there is a real exception.',
        ],
        avoidPoints: [
          'Avoid vague instructions like "be friendly" without examples.',
          'Avoid mixing policy or product facts into tone guidance.',
        ],
      };
    case 'business-overview':
      return {
        focusPoints: [
          'Summarize who the company serves, what outcome it delivers, and why it matters.',
          'Use the value proposition field for differentiation, not inventory.',
          'Keep this section stable and high-level so it remains true across offerings.',
        ],
        avoidPoints: [
          'Avoid duplicating product, service, menu, or accommodation lists already maintained elsewhere.',
          'Avoid campaign copy or temporary promotions in the core overview.',
        ],
        note: 'Treat this as positioning and context, not a second catalog.',
      };
    case 'faqs':
      return {
        focusPoints: [
          'Use one customer question per entry and give one canonical answer.',
          'Write the answer exactly how you want the AI to state it.',
          'Include a reference link when the answer should map to a source page or policy.',
        ],
        avoidPoints: [
          'Avoid combining multiple related questions into one FAQ entry.',
          'Avoid answers that depend on missing context or internal knowledge.',
        ],
      };
    case 'sample-conversations':
      return {
        focusPoints: [
          'Use realistic customer wording for the prompt so the example resembles real conversations.',
          'Make the ideal response complete, structured, and policy-safe.',
          'Use this section for behavior modeling, especially for edge cases and objections.',
        ],
        avoidPoints: [
          'Avoid examples that contradict active FAQs or business policies.',
          'Avoid toy conversations that are too short to teach the desired response pattern.',
        ],
      };
  }
}

function emptyValuesForCategory(category: KnowledgeSectionId): KnowledgeEntryFormValues {
  switch (category) {
    case 'tone-personality':
      return {
        category,
        primary_voice: ['Professional'],
        standard_greeting: '',
        standard_signoff: '',
        vocab_dos: '',
        vocab_donts: '',
        emoji_usage: 'none',
        tags: '',
        owner_name: '',
        source_priority: 'canonical',
        is_active: true,
      };
    case 'business-overview':
      return {
        category,
        company_name: '',
        country: '',
        region: '',
        city: '',
        district: '',
        elevator_pitch: '',
        target_audience: '',
        value_proposition: '',
        tags: '',
        owner_name: '',
        source_priority: 'canonical',
        is_active: true,
      };
    case 'faqs':
      return {
        category,
        question: '',
        answer: '',
        reference_link: '',
        tags: '',
        owner_name: '',
        source_priority: 'canonical',
        is_active: true,
      };
    case 'sample-conversations':
      return {
        category,
        scenario_context: '',
        customer_says: '',
        ideal_response: '',
        tags: '',
        owner_name: '',
        source_priority: 'canonical',
        is_active: true,
      };
  }
}

function fallbackFromLegacyEntry(entry: KnowledgeEntry, category: KnowledgeSectionId): KnowledgeEntryFormValues {
  const baseTags = entry.tags?.join(', ') || '';

  switch (category) {
    case 'tone-personality':
      return {
        category,
        primary_voice: ['Professional'],
        standard_greeting: entry.title,
        standard_signoff: '',
        vocab_dos: entry.content,
        vocab_donts: '',
        emoji_usage: 'none',
        tags: baseTags,
        owner_name: entry.owner_name || '',
        source_priority: entry.source_priority || 'canonical',
        is_active: entry.is_active,
      };
    case 'business-overview':
      return {
        category,
        company_name: entry.title,
        country: '',
        region: '',
        city: '',
        district: '',
        elevator_pitch: entry.content,
        target_audience: '',
        value_proposition: '',
        tags: baseTags,
        owner_name: entry.owner_name || '',
        source_priority: entry.source_priority || 'canonical',
        is_active: entry.is_active,
      };
    case 'faqs':
      return {
        category,
        question: entry.title,
        answer: entry.content,
        reference_link: '',
        tags: baseTags,
        owner_name: entry.owner_name || '',
        source_priority: entry.source_priority || 'canonical',
        is_active: entry.is_active,
      };
    case 'sample-conversations':
      return {
        category,
        scenario_context: entry.title,
        customer_says: '',
        ideal_response: entry.content,
        tags: baseTags,
        owner_name: entry.owner_name || '',
        source_priority: entry.source_priority || 'canonical',
        is_active: entry.is_active,
      };
  }
}

export function getKnowledgeEntryFormDefaults(
  entry: KnowledgeEntry | null,
  defaultCategory: KnowledgeSectionId,
  currentUserDisplayName = ''
): KnowledgeEntryFormValues {
  if (!entry) {
    return {
      ...emptyValuesForCategory(defaultCategory),
      owner_name: currentUserDisplayName,
    };
  }

  const parsed = parseMetadata(entry.content);
  if (parsed) {
    return {
      ...parsed,
      tags: entry.tags?.join(', ') || parsed.tags,
      owner_name: entry.owner_name || parsed.owner_name || currentUserDisplayName,
      source_priority: entry.source_priority || parsed.source_priority,
      is_active: entry.is_active,
    };
  }

  const category = knowledgeSectionIds.includes((entry.category || defaultCategory) as KnowledgeSectionId)
    ? (entry.category || defaultCategory) as KnowledgeSectionId
    : defaultCategory;

  return fallbackFromLegacyEntry(entry, category);
}