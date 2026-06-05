/**
 * Enhanced AI Communication System - Shared Types & Utilities
 * This file contains all types and helper functions for the 7 enhancements
 * Location: supabase/functions/_shared/ai-communication-enhancements.ts
 */

// ============================================================================
// 1. AI Response Context Enhancement - Types & Functions
// ============================================================================

export interface LeadEngagementProfile {
  id: string;
  lead_id: string;
  communication_style: 'quick_responses' | 'detailed_info' | 'visual' | 'text' | 'neutral';
  response_speed_avg_minutes: number | null;
  topics_discussed: string[];
  abandoned_topics: string[];
  objections_history: Objection[];
  interaction_count: number;
  last_interaction: string | null;
}

export interface Objection {
  topic: string;
  objection: string;
  resolution?: string;
  times_raised: number;
  first_raised: string;
  last_raised: string;
}

export interface ConversationMetadata {
  id: string;
  conversation_id: string;
  lead_id: string;
  topics_extracted: Record<string, string | number>;
  key_information: Record<string, string | number>;
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  confidence_score: number; // 0-1
  metadata?: Record<string, unknown>;
}

/**
 * Load engagement context for a lead from database
 * Used to inform AI prompts with history and preferences
 */
export async function loadLeadEngagementContext(
  leadId: string,
  supabaseClient: any
): Promise<LeadEngagementProfile | null> {
  try {
    const { data, error } = await supabaseClient
      .from('lead_engagement_profiles')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (error) {
      console.warn(`[Context] Failed to load engagement profile: ${error.message}`);
      return null;
    }

    return data as LeadEngagementProfile;
  } catch (err) {
    console.error('[Context] Exception loading engagement profile:', err);
    return null;
  }
}

/**
 * Build AI prompt instruction that includes engagement context
 * Enhances AI awareness of lead history and preferences
 */
export function buildContextualPromptInstruction(profile: LeadEngagementProfile | null): string {
  if (!profile) {
    return '';
  }

  let instruction = '\n\n### LEAD CONTEXT:\n';
  instruction += `Communication Style: Prefers ${profile.communication_style}\n`;

  if (profile.response_speed_avg_minutes) {
    instruction += `Responds within ~${profile.response_speed_avg_minutes} minutes\n`;
  }

  if (profile.topics_discussed.length > 0) {
    instruction += `Previously discussed: ${profile.topics_discussed.join(', ')}\n`;
  }

  if (profile.abandoned_topics.length > 0) {
    instruction += `Topics started but not completed: ${profile.abandoned_topics.join(', ')}\n`;
  }

  if (profile.objections_history.length > 0) {
    instruction += `\nPrevious Objections:\n`;
    profile.objections_history.forEach(obj => {
      instruction += `  - ${obj.topic}: "${obj.objection}" (raised ${obj.times_raised}x)`;
      if (obj.resolution) {
        instruction += ` → Solution: ${obj.resolution}`;
      }
      instruction += '\n';
    });
  }

  instruction += `\nUse this context to:\n`;
  instruction += `1. Avoid repeating answers to previous questions\n`;
  instruction += `2. Anticipate and address known objections\n`;
  instruction += `3. Match the lead's preferred communication style\n`;
  instruction += `4. Continue naturally from where conversation left off\n`;

  return instruction;
}

// ============================================================================
// 2. Lead Qualification Score & Tracking - Types & Functions
// ============================================================================

export interface LeadQualificationScore {
  id: string;
  lead_id: string;
  score: number; // 0-100
  scoring_breakdown: ScoringBreakdown;
  status: 'new' | 'contacted' | 'qualified' | 'hot_lead' | 'booked' | 'lost';
  status_changed_at: string | null;
}

export interface ScoringBreakdown {
  budget_confirmed?: number; // 0-25
  timeline_known?: number; // 0-20
  decision_maker_identified?: number; // 0-15
  product_interest_level?: number; // 0-20
  engagement_velocity?: number; // 0-10
  positive_sentiment?: number; // 0-10
}

export interface QualificationEvent {
  id: string;
  lead_id: string;
  event_type: string; // budget_confirmed|timeline_known|decision_maker_identified|interest_expressed|objection_raised
  event_value: Record<string, unknown>;
  score_impact: number;
  created_at: string;
}

/**
 * Calculate lead qualification score based on scoring breakdown
 */
export function calculateQualificationScore(breakdown: ScoringBreakdown): number {
  const total =
    (breakdown.budget_confirmed ?? 0) +
    (breakdown.timeline_known ?? 0) +
    (breakdown.decision_maker_identified ?? 0) +
    (breakdown.product_interest_level ?? 0) +
    (breakdown.engagement_velocity ?? 0) +
    (breakdown.positive_sentiment ?? 0);

  return Math.min(Math.max(total, 0), 100);
}

/**
 * Determine lead status based on qualification score
 */
export function determineLeadStatus(
  score: number
): 'new' | 'contacted' | 'qualified' | 'hot_lead' {
  if (score >= 71) return 'hot_lead';
  if (score >= 41) return 'qualified';
  if (score >= 21) return 'contacted';
  return 'new';
}

/**
 * Log a qualification event (e.g., budget confirmed, timeline identified)
 * Returns the score impact
 */
export async function logQualificationEvent(
  leadId: string,
  organizationId: string,
  eventType: string,
  eventValue: Record<string, unknown>,
  supabaseClient: any
): Promise<number> {
  // Determine score impact based on event type
  const scoreImpactMap: Record<string, number> = {
    budget_confirmed: 25,
    timeline_known: 20,
    decision_maker_identified: 15,
    interest_expressed: 10,
    positive_sentiment: 10,
    objection_raised: -5,
    engagement_velocity_high: 10,
    engagement_velocity_low: -5,
  };

  const scoreImpact = scoreImpactMap[eventType] ?? 0;

  try {
    await supabaseClient.from('qualification_events').insert({
      lead_id: leadId,
      organization_id: organizationId,
      event_type: eventType,
      event_value: eventValue,
      score_impact: scoreImpact,
    });

    console.log(`[Qualification] Logged event: ${eventType} (+${scoreImpact} pts)`);
  } catch (err) {
    console.error('[Qualification] Failed to log event:', err);
  }

  return scoreImpact;
}

/**
 * Update lead qualification score and status in database
 */
export async function updateLeadQualificationScore(
  leadId: string,
  organizationId: string,
  newScore: number,
  breakdown: ScoringBreakdown,
  supabaseClient: any
): Promise<boolean> {
  const newStatus = determineLeadStatus(newScore);

  try {
    const { error } = await supabaseClient
      .from('lead_qualification_scores')
      .upsert(
        {
          lead_id: leadId,
          organization_id: organizationId,
          score: newScore,
          scoring_breakdown: breakdown,
          status: newStatus,
          status_changed_at: new Date().toISOString(),
        },
        { onConflict: 'lead_id' }
      );

    if (error) {
      console.error('[Qualification] Failed to update score:', error);
      return false;
    }

    console.log(`[Qualification] Updated ${leadId} to score=${newScore}, status=${newStatus}`);
    return true;
  } catch (err) {
    console.error('[Qualification] Exception updating score:', err);
    return false;
  }
}

// ============================================================================
// 3. Smart Re-engagement - Types & Functions
// ============================================================================

export interface ReEngagementCampaign {
  id: string;
  lead_id: string;
  campaign_type: 'budget_objection' | 'time_objection' | 'feature_interest' | 'generic';
  message_sent: string;
  sent_at: string;
  response_received: boolean;
  response_time_minutes?: number;
  attempt_number: number;
  escalated_to_agent: boolean;
}

export interface ReEngagementTemplate {
  id: string;
  campaign_type: string;
  template_text: string;
  trigger_conditions: Record<string, unknown>;
  success_rate: number;
}

/**
 * Check for leads that need re-engagement
 * Dormant: No response for 48-72 hours, not agent-managed, not lost/booked
 */
export async function identifyDormantLeads(
  organizationId: string,
  hoursOfInactivity: number = 48,
  supabaseClient: any
): Promise<string[]> {
  const thresholdTime = new Date(Date.now() - hoursOfInactivity * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabaseClient.rpc('find_dormant_leads', {
      p_org_id: organizationId,
      p_threshold_time: thresholdTime,
    });

    if (error) {
      console.error('[ReEngagement] Failed to identify dormant leads:', error);
      return [];
    }

    const leadIds = data.map((row: any) => row.lead_id);
    console.log(`[ReEngagement] Found ${leadIds.length} dormant leads`);
    return leadIds;
  } catch (err) {
    console.error('[ReEngagement] Exception identifying dormant leads:', err);
    return [];
  }
}

/**
 * Get best re-engagement template for a lead based on their history
 */
export async function selectReEngagementTemplate(
  leadId: string,
  organizationId: string,
  supabaseClient: any
): Promise<ReEngagementTemplate | null> {
  try {
    // Fetch lead's engagement profile and qualification
    const profile = await loadLeadEngagementContext(leadId, supabaseClient);
    const { data: qualData } = await supabaseClient
      .from('lead_qualification_scores')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    // Determine best template based on history
    let campaignType = 'generic';

    if (
      profile?.objections_history.some(
        obj => obj.topic === 'pricing' && !obj.resolution
      )
    ) {
      campaignType = 'budget_objection';
    } else if (
      profile?.objections_history.some(
        obj => obj.topic === 'timeline' && !obj.resolution
      )
    ) {
      campaignType = 'time_objection';
    } else if (profile?.abandoned_topics.length > 0) {
      campaignType = 'feature_interest';
    }

    // Fetch template with highest success rate
    const { data: templates, error } = await supabaseClient
      .from('re_engagement_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('campaign_type', campaignType)
      .order('success_rate', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[ReEngagement] Failed to fetch template:', error);
      return null;
    }

    return templates?.[0] ?? null;
  } catch (err) {
    console.error('[ReEngagement] Exception selecting template:', err);
    return null;
  }
}

/**
 * Generate personalized re-engagement message
 */
export function generateReEngagementMessage(
  template: ReEngagementTemplate | null,
  leadName: string,
  context: Record<string, unknown>
): string {
  if (!template) {
    // Fallback message
    return `Hi ${leadName}, just checking in! Any updates or questions about your booking?`;
  }

  // Replace template variables
  let message = template.template_text;
  message = message.replace('{lead_name}', leadName);

  Object.entries(context).forEach(([key, value]) => {
    message = message.replace(`{${key}}`, String(value));
  });

  return message;
}

/**
 * Log re-engagement campaign attempt
 */
export async function logReEngagementAttempt(
  leadId: string,
  organizationId: string,
  campaignType: string,
  message: string,
  attemptNumber: number,
  supabaseClient: any
): Promise<boolean> {
  try {
    await supabaseClient.from('re_engagement_campaigns').insert({
      lead_id: leadId,
      organization_id: organizationId,
      campaign_type: campaignType,
      message_sent: message,
      sent_at: new Date().toISOString(),
      attempt_number: attemptNumber,
      response_received: false,
    });

    console.log(`[ReEngagement] Logged attempt ${attemptNumber} for lead ${leadId}`);
    return true;
  } catch (err) {
    console.error('[ReEngagement] Failed to log attempt:', err);
    return false;
  }
}

// ============================================================================
// 4. Intelligent Message Handoff - Types & Functions
// ============================================================================

export interface HandoffData {
  lead_id: string;
  handoff_timestamp: string;
  qualification_score: number;
  handoff_summary: string;
  key_requirements: Record<string, unknown>;
  previous_objections: Objection[];
  recommended_action: string;
  agent_notes: string;
}

export interface HandoffEvent {
  id: string;
  lead_id: string;
  trigger_reason: 'cant_answer' | 'high_score' | 'sentiment_drop' | 'request_agent' | 'timeout';
  handoff_data: HandoffData;
  assigned_to_agent: string | null;
  completed: boolean;
}

/**
 * Check if escalation should be triggered
 */
export function shouldEscalate(
  confidenceScore: number,
  qualificationScore: number,
  sentiment: string,
  messageContent: string
): { should: boolean; reason?: string } {
  // High qualification score
  if (qualificationScore > 75) {
    return { should: true, reason: 'high_score' };
  }

  // AI can't answer (low confidence)
  if (confidenceScore < 0.4) {
    return { should: true, reason: 'cant_answer' };
  }

  // Negative sentiment
  if (sentiment === 'frustrated' || sentiment === 'negative') {
    return { should: true, reason: 'sentiment_drop' };
  }

  // User explicitly requests agent
  const agentRequestPatterns = [
    'speak to agent',
    'talk to human',
    'transfer to agent',
    'speak to representative',
    'connect me to',
  ];

  if (agentRequestPatterns.some(pattern => messageContent.toLowerCase().includes(pattern))) {
    return { should: true, reason: 'request_agent' };
  }

  return { should: false };
}

/**
 * Generate handoff summary for agent
 */
export function generateHandoffSummary(
  leadName: string,
  engagementProfile: LeadEngagementProfile | null,
  qualificationScore: LeadQualificationScore | null,
  conversationMetadata: ConversationMetadata | null
): HandoffData {
  let summary = `${leadName} is `;

  if (qualificationScore) {
    const status = qualificationScore.status;
    const score = qualificationScore.score;

    switch (status) {
      case 'hot_lead':
        summary += `a HOT LEAD (${score}/100) ready to convert`;
        break;
      case 'qualified':
        summary += `a qualified prospect (${score}/100) showing strong interest`;
        break;
      case 'contacted':
        summary += `an engaged lead (${score}/100) still exploring options`;
        break;
      default:
        summary += `a new contact (${score}/100)`;
    }
  }

  summary += '.';

  if (engagementProfile?.topics_discussed.length) {
    summary += ` Topics discussed: ${engagementProfile.topics_discussed.join(', ')}.`;
  }

  if (engagementProfile?.objections_history.length) {
    const unresolved = engagementProfile.objections_history.filter(obj => !obj.resolution);
    if (unresolved.length > 0) {
      summary += ` Unresolved objections: ${unresolved.map(o => o.objection).join(', ')}.`;
    }
  }

  if (conversationMetadata?.key_information) {
    const keyInfo = Object.entries(conversationMetadata.key_information)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    summary += ` Key info: ${keyInfo}.`;
  }

  const recommendedAction =
    qualificationScore?.score && qualificationScore.score > 80
      ? 'Call lead to discuss booking'
      : qualificationScore?.score && qualificationScore.score > 50
        ? 'Send proposal and pricing'
        : 'Continue nurturing with information';

  return {
    lead_id: '',
    handoff_timestamp: new Date().toISOString(),
    qualification_score: qualificationScore?.score ?? 0,
    handoff_summary: summary,
    key_requirements: conversationMetadata?.key_information ?? {},
    previous_objections: engagementProfile?.objections_history ?? [],
    recommended_action: recommendedAction,
    agent_notes: `Lead prefers ${engagementProfile?.communication_style ?? 'standard'} communication. Previously responded within ${engagementProfile?.response_speed_avg_minutes ?? '?'} minutes.`,
  };
}

/**
 * Log handoff event
 */
export async function logHandoffEvent(
  leadId: string,
  organizationId: string,
  triggerReason: string,
  handoffData: HandoffData,
  supabaseClient: any
): Promise<boolean> {
  try {
    await supabaseClient.from('handoff_events').insert({
      lead_id: leadId,
      organization_id: organizationId,
      trigger_reason: triggerReason,
      handoff_data: handoffData,
      created_at: new Date().toISOString(),
    });

    console.log(`[Handoff] Logged escalation for ${leadId}: ${triggerReason}`);
    return true;
  } catch (err) {
    console.error('[Handoff] Failed to log handoff event:', err);
    return false;
  }
}

// ============================================================================
// 5. Performance Monitoring - Types & Functions
// ============================================================================

export interface PerformanceMetric {
  id: string;
  metric_type: string;
  metric_value: number;
  context: Record<string, unknown>;
  recorded_at: string;
}

export interface AnalyticsSnapshot {
  snapshot_date: string;
  metrics: Record<string, number>;
}

/**
 * Record a performance metric
 */
export async function recordPerformanceMetric(
  organizationId: string,
  metricType: string,
  metricValue: number,
  context: Record<string, unknown> = {},
  supabaseClient: any
): Promise<boolean> {
  try {
    await supabaseClient.from('performance_metrics').insert({
      organization_id: organizationId,
      metric_type: metricType,
      metric_value: metricValue,
      context,
      recorded_at: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error('[Metrics] Failed to record metric:', err);
    return false;
  }
}

/**
 * Get metrics for last N days
 */
export async function getPerformanceMetrics(
  organizationId: string,
  metricType: string,
  days: number = 7,
  supabaseClient: any
): Promise<PerformanceMetric[]> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseClient
      .from('performance_metrics')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('metric_type', metricType)
      .gte('recorded_at', startDate)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('[Metrics] Failed to fetch metrics:', error);
      return [];
    }

    return data as PerformanceMetric[];
  } catch (err) {
    console.error('[Metrics] Exception fetching metrics:', err);
    return [];
  }
}

/**
 * Calculate metric average
 */
export function calculateMetricAverage(metrics: PerformanceMetric[]): number {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((acc, m) => acc + m.metric_value, 0);
  return sum / metrics.length;
}

// ============================================================================
// 6. Knowledge Base Performance - Types & Functions
// ============================================================================

export interface KBPerformance {
  id: string;
  kb_article_id: string;
  shown_count: number;
  clicked_count: number;
  converted_count: number;
  conversion_rate: number;
  last_used: string | null;
}

/**
 * Track KB article usage
 */
export async function trackKBArticleUsage(
  organizationId: string,
  kbArticleId: string,
  userConverted: boolean,
  supabaseClient: any
): Promise<boolean> {
  try {
    const { data: existing } = await supabaseClient
      .from('knowledge_base_performance')
      .select('*')
      .eq('kb_article_id', kbArticleId)
      .single();

    if (existing) {
      const newShown = (existing.shown_count ?? 0) + 1;
      const newConverted = (existing.converted_count ?? 0) + (userConverted ? 1 : 0);
      const newConversionRate = newConverted / newShown;

      await supabaseClient
        .from('knowledge_base_performance')
        .update({
          shown_count: newShown,
          converted_count: newConverted,
          conversion_rate: newConversionRate,
          last_used: new Date().toISOString(),
        })
        .eq('kb_article_id', kbArticleId);
    } else {
      await supabaseClient.from('knowledge_base_performance').insert({
        organization_id: organizationId,
        kb_article_id: kbArticleId,
        shown_count: 1,
        converted_count: userConverted ? 1 : 0,
        conversion_rate: userConverted ? 1.0 : 0.0,
        last_used: new Date().toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error('[KBPerf] Failed to track usage:', err);
    return false;
  }
}

// ============================================================================
// 7. Utility Functions
// ============================================================================

/**
 * Extract key information from a message
 * Returns identified budget, timeline, capacity, etc.
 */
export function extractKeyInformation(messageContent: string): Record<string, unknown> {
  const extracted: Record<string, unknown> = {};

  // Budget pattern: $X, XXX dollars, XXX EUR
  const budgetMatch = messageContent.match(/\$?([\d,]+)(?:\s*(?:dollars|USD|EUR|GBP))?/);
  if (budgetMatch) {
    extracted.budget = budgetMatch[0];
  }

  // Date pattern: YYYY-MM-DD, DD/MM/YYYY, month day
  const dateMatch = messageContent.match(
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\w+\s+\d{1,2})/
  );
  if (dateMatch) {
    extracted.date_mentioned = dateMatch[0];
  }

  // Capacity: X guests, X people, party of X
  const capacityMatch = messageContent.match(/(\d+)\s*(?:guests?|people|persons?)/i);
  if (capacityMatch) {
    extracted.capacity = parseInt(capacityMatch[1], 10);
  }

  // Urgency: ASAP, urgent, immediately, next week
  if (/asap|urgent|immediately|next\s*week|soon/i.test(messageContent)) {
    extracted.urgency = 'high';
  }

  return extracted;
}

/**
 * Analyze sentiment of message (simple heuristic)
 */
export function analyzeSentiment(messageContent: string): 'positive' | 'neutral' | 'negative' | 'frustrated' {
  const positive = /\b(great|good|excellent|amazing|perfect|love|happy|wonderful|fantastic)\b/i;
  const negative = /\b(bad|terrible|awful|hate|disgusted|angry|frustrating|disappointing)\b/i;
  const frustrated = /\b(frustrated|annoyed|upset|irritated|dissatisfied)\b/i;

  if (frustrated.test(messageContent)) return 'frustrated';
  if (negative.test(messageContent)) return 'negative';
  if (positive.test(messageContent)) return 'positive';
  return 'neutral';
}

/**
 * Format engagement profile for display in UI
 */
export function formatEngagementProfile(profile: LeadEngagementProfile): string {
  let output = `**Engagement Profile**\n`;
  output += `- Style: ${profile.communication_style}\n`;
  output += `- Response Time: ~${profile.response_speed_avg_minutes ?? '?'} min\n`;
  output += `- Topics: ${profile.topics_discussed.join(', ') || 'None yet'}\n`;
  output += `- Interactions: ${profile.interaction_count}\n`;

  if (profile.objections_history.length > 0) {
    output += `- Objections: ${profile.objections_history.map(o => o.objection).join(', ')}\n`;
  }

  return output;
}

