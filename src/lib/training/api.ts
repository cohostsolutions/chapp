import { supabase } from '@/integrations/supabase/client';
import { TrainingModule, TrainingSessionRecord, TrainingAnalytics, RubricTemplate, TrainingAnalyticsFilters, TrainingAnalyticsOptions } from './types';
import { metricsTracker } from './metrics';

type TrainingSessionRow = {
  module_id?: string | null;
  score?: number | null;
  user_id?: string | null;
  started_at?: string | null;
  module?: { title?: string | null } | null;
};

type TrainingStatsResponse = {
  totalSessions?: number | null;
  avgScore?: number | null;
  topModules?: Array<{ id: string; title: string; count: number; avgScore: number | null }>;
  agentBreakdown?: Array<{ id: string; name: string; sessions: number; avgScore: number | null }>;
};

type TrainingGovernanceSettings = {
  training_pii_redaction: boolean;
  training_retention_days: number | null;
};

function normalizeFilterDate(value: string, boundary: 'start' | 'end') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === 'start' ? 'T00:00:00' : 'T23:59:59.999';
    return new Date(`${value}${suffix}`).toISOString();
  }

  return value;
}

async function fetchTrainingGovernanceSettings(orgId: string): Promise<TrainingGovernanceSettings> {
  const { data, error } = await supabase
    .from('organizations')
    .select('training_pii_redaction, training_retention_days')
    .eq('id', orgId)
    .maybeSingle();

  if (error) throw error;

  return data || { training_pii_redaction: false, training_retention_days: null };
}

async function fetchAgentOptions(orgId: string) {
  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .select('user_id')
    .eq('organization_id', orgId)
    .not('user_id', 'is', null);

  if (sessionsError) throw sessionsError;

  const userIds = Array.from(new Set((sessions || []).map((session) => session.user_id).filter(Boolean)));

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  return (profiles || [])
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchTrainingAnalyticsOptions(orgId: string): Promise<TrainingAnalyticsOptions> {
  const [settings, modulesResult, agents] = await Promise.all([
    fetchTrainingGovernanceSettings(orgId),
    supabase
      .from('training_modules')
      .select('id, title')
      .eq('organization_id', orgId)
      .eq('visibility', 'active')
      .order('title', { ascending: true }),
    fetchAgentOptions(orgId),
  ]);

  if (modulesResult.error) throw modulesResult.error;

  return {
    retentionDays: settings.training_retention_days,
    modules: modulesResult.data || [],
    agents,
  };
}

function buildTopModules(sessions: TrainingSessionRow[]) {
  const counts: Record<string, { count: number; title: string; scores: number[] }> = {};

  sessions.forEach((session) => {
    const id = session.module_id || 'unknown';
    const title = session.module?.title || 'Module';
    if (!counts[id]) counts[id] = { count: 0, title, scores: [] };
    counts[id].count += 1;

    if (typeof session.score === 'number') {
      counts[id].scores.push(session.score);
    }
  });

  return Object.entries(counts)
    .map(([id, entry]) => ({
      id,
      title: entry.title,
      count: entry.count,
      avgScore: entry.scores.length ? entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

async function buildAgentBreakdown(sessions: TrainingSessionRow[]) {
  const userCounts: Record<string, { sessions: number; scores: number[] }> = {};

  sessions.forEach((session) => {
    if (!session.user_id) return;
    if (!userCounts[session.user_id]) userCounts[session.user_id] = { sessions: 0, scores: [] };
    userCounts[session.user_id].sessions += 1;
    if (typeof session.score === 'number') {
      userCounts[session.user_id].scores.push(session.score);
    }
  });

  const userIds = Object.keys(userCounts);
  const profileMap = new Map<string, { full_name?: string | null; email?: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    (profiles || []).forEach((profile) => {
      profileMap.set(profile.id, profile);
    });
  }

  return Object.entries(userCounts)
    .map(([id, stats]) => {
      const profile = profileMap.get(id);
      return {
        id,
        name: profile?.full_name || profile?.email?.split('@')[0] || 'Unknown',
        sessions: stats.sessions,
        avgScore: stats.scores.length ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length : null,
      };
    })
    .sort((a, b) => {
      if (a.avgScore === null && b.avgScore === null) return b.sessions - a.sessions;
      if (a.avgScore === null) return 1;
      if (b.avgScore === null) return -1;
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
      return b.sessions - a.sessions;
    })
    .slice(0, 10);
}

function buildDailyTrend(sessions: TrainingSessionRow[]) {
  const trendMap = new Map<string, { date: string; label: string; sessions: number; scores: number[] }>();

  sessions.forEach((session) => {
    if (!session.started_at) return;
    const date = new Date(session.started_at);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!trendMap.has(key)) {
      trendMap.set(key, { date: key, label, sessions: 0, scores: [] });
    }
    const entry = trendMap.get(key)!;
    entry.sessions += 1;
    if (typeof session.score === 'number') {
      entry.scores.push(session.score);
    }
  });

  return Array.from(trendMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((entry) => ({
      date: entry.date,
      label: entry.label,
      sessions: entry.sessions,
      avgScore: entry.scores.length ? entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length : null,
    }));
}

function buildScoreDistribution(sessions: TrainingSessionRow[]) {
  const buckets = [
    { range: '0-59', min: 0, max: 59, count: 0 },
    { range: '60-69', min: 60, max: 69, count: 0 },
    { range: '70-79', min: 70, max: 79, count: 0 },
    { range: '80-89', min: 80, max: 89, count: 0 },
    { range: '90-100', min: 90, max: 100, count: 0 },
  ];

  sessions.forEach((session) => {
    if (typeof session.score !== 'number') return;
    const bucket = buckets.find((entry) => session.score >= entry.min && session.score <= entry.max);
    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets.map(({ range, count }) => ({ range, count }));
}

export async function fetchOrganizationTraining(orgId: string) {
  const requestId = metricsTracker.startRequest('fetchOrganizationTraining', { orgId });
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, training_enabled')
      .eq('id', orgId)
      .maybeSingle();
    if (error) throw error;
    metricsTracker.endRequest(requestId);
    return data;
  } catch (error) {
    metricsTracker.errorRequest(requestId, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function listModules(orgId: string): Promise<TrainingModule[]> {
  const requestId = metricsTracker.startRequest('listModules', { orgId });
  try {
    const { data, error } = await supabase
      .from('training_modules')
      .select('*')
      .eq('organization_id', orgId)
      .eq('visibility', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    metricsTracker.endRequest(requestId, { moduleCount: data?.length || 0 });
    return (data || []) as unknown as TrainingModule[];
  } catch (error) {
    metricsTracker.errorRequest(requestId, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function upsertModule(module: Partial<TrainingModule> & { organization_id: string; title?: string }) {
  const requestId = metricsTracker.startRequest('upsertModule', { 
    orgId: module.organization_id,
    moduleId: module.id,
    isUpdate: !!module.id 
  });
  try {
    const payload: Partial<TrainingModule> & {
      organization_id: string;
      title: string;
      objectives: unknown[];
      rubric: unknown[];
    } = {
      ...module,
      title: module.title || 'Untitled Module',
      objectives: module.objectives || [],
      rubric: module.rubric || [],
    };
    const { data, error } = await supabase
      .from('training_modules')
      .upsert([payload as any])
      .select()
      .single();
    if (error) throw error;
    metricsTracker.endRequest(requestId);
    return data as unknown as TrainingModule;
  } catch (error) {
    metricsTracker.errorRequest(requestId, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function recordSession(session: TrainingSessionRecord) {
  const requestId = metricsTracker.startRequest('recordSession', {
    moduleId: session.moduleId,
    userId: session.userId,
    score: session.evaluation?.overallScore
  });
  try {
    const { error } = await supabase.from('training_sessions').insert([{
      id: session.id,
      module_id: session.moduleId,
      organization_id: session.organizationId,
      user_id: session.userId,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      score: session.evaluation?.overallScore ?? null,
      evaluation: (session.evaluation ?? null) as any,
      transcript: session.transcript as any,
    }]);
    if (error) throw error;
    metricsTracker.endRequest(requestId);
  } catch (error) {
    metricsTracker.errorRequest(requestId, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function listTemplates(orgId: string): Promise<RubricTemplate[]> {
  const { data, error } = await supabase
    .from('rubric_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as RubricTemplate[];
}

export async function saveTemplate(template: { id?: string; organization_id: string; name: string; description?: string; rubric: unknown[] }) {
  const payload: { id?: string; organization_id: string; name: string; description?: string; rubric: unknown[] } = {
    ...template,
  };
  const { data, error } = await supabase
    .from('rubric_templates')
    .upsert([payload as any])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('rubric_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTrainingAnalytics(
  orgId: string,
  filters?: TrainingAnalyticsFilters
): Promise<TrainingAnalytics> {
  let sessionsQuery = supabase
    .from('training_sessions')
    .select('module_id, score, user_id, started_at, module:training_modules(title)')
    .eq('organization_id', orgId);

  if (filters?.startDate) {
    sessionsQuery = sessionsQuery.gte('started_at', normalizeFilterDate(filters.startDate, 'start'));
  }

  if (filters?.endDate) {
    sessionsQuery = sessionsQuery.lte('started_at', normalizeFilterDate(filters.endDate, 'end'));
  }

  if (filters?.userId) {
    sessionsQuery = sessionsQuery.eq('user_id', filters.userId);
  }

  if (filters?.moduleId) {
    sessionsQuery = sessionsQuery.eq('module_id', filters.moduleId);
  }

  const shouldUseRpcStats = !filters?.moduleId;

  const [statsResult, sessionsResult, modulesResult] = await Promise.all([
    shouldUseRpcStats
      ? supabase.rpc('training_stats', {
          p_org_id: orgId,
          p_start_date: filters?.startDate ? normalizeFilterDate(filters.startDate, 'start') : null,
          p_end_date: filters?.endDate ? normalizeFilterDate(filters.endDate, 'end') : null,
          p_user_id: filters?.userId || null,
        })
      : Promise.resolve({ data: null, error: null }),
    sessionsQuery,
    supabase
      .from('training_modules')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('visibility', 'active'),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (modulesResult.error) throw modulesResult.error;

  const sessions = (sessionsResult.data || []) as TrainingSessionRow[];
  const scores = sessions.map((session) => session.score).filter((score): score is number => typeof score === 'number');
  const fallbackStats = {
    totalSessions: sessions.length,
    avgScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    topModules: buildTopModules(sessions),
  };

  const rpcStats = statsResult.error ? null : (statsResult.data as TrainingStatsResponse | null);
  const agentBreakdown = rpcStats?.agentBreakdown?.length
    ? rpcStats.agentBreakdown
    : await buildAgentBreakdown(sessions);

  return {
    totalSessions: rpcStats?.totalSessions ?? fallbackStats.totalSessions,
    avgScore: rpcStats?.avgScore ?? fallbackStats.avgScore,
    activeModules: modulesResult.count || 0,
    activeAgents: new Set(sessions.map((session) => session.user_id).filter(Boolean)).size,
    topModules: rpcStats?.topModules?.length ? rpcStats.topModules : fallbackStats.topModules,
    agentBreakdown,
    dailyTrend: buildDailyTrend(sessions),
    scoreDistribution: buildScoreDistribution(sessions),
  };
}

export async function fetchPIISettings(orgId: string) {
  return fetchTrainingGovernanceSettings(orgId);
}
