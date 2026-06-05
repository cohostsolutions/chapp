import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Activity, BarChart3, Filter, RefreshCcw, Target, Trophy, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { fetchTrainingAnalytics, fetchTrainingAnalyticsOptions } from '@/lib/training/api';
import type { TrainingAnalytics, TrainingAnalyticsFilters } from '@/lib/training/types';
import { cn } from '@/lib/utils';

const scoreDistributionColors = ['#D95D39', '#E89A3D', '#E7C65C', '#79A66D', '#2F6E5B'];

const analyticsChartConfig = {
  sessions: { label: 'Sessions', color: '#2F6E5B' },
  avgScore: { label: 'Avg Score', color: '#D95D39' },
  count: { label: 'Sessions', color: '#C6843A' },
} as const;

type RangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetStartDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return toDateInputValue(date);
}

function getDefaultFilterState() {
  return {
    rangePreset: '30d' as RangePreset,
    startDate: getPresetStartDate(30),
    endDate: toDateInputValue(new Date()),
    userId: 'all',
    moduleId: 'all',
  };
}

function formatScore(score: number | null) {
  return score === null ? '—' : `${score.toFixed(1)}`;
}

function getScoreTone(score: number | null) {
  if (score === null) return 'text-muted-foreground';
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-rose-700';
}

function TrainingAnalyticsOverview({ analytics }: { analytics: TrainingAnalytics }) {
  const statCards = [
    {
      label: 'Total Sessions',
      value: analytics.totalSessions.toLocaleString(),
      icon: Activity,
      tone: 'bg-[#F3F0E8] text-[#6D5F4B]',
      helper: 'Recorded across the selected org scope',
    },
    {
      label: 'Average Score',
      value: analytics.avgScore === null ? '—' : `${analytics.avgScore.toFixed(1)}/100`,
      icon: Target,
      tone: 'bg-[#F5E7D4] text-[#A25B2A]',
      helper: 'Based on completed evaluated sessions',
    },
    {
      label: 'Active Modules',
      value: analytics.activeModules.toLocaleString(),
      icon: BarChart3,
      tone: 'bg-[#E5EFEA] text-[#2F6E5B]',
      helper: 'Currently visible training scenarios',
    },
    {
      label: 'Active Agents',
      value: analytics.activeAgents.toLocaleString(),
      icon: Users,
      tone: 'bg-[#E7EDF6] text-[#48627A]',
      helper: 'Unique agents with session activity',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.helper}</p>
                </div>
                <div className={cn('rounded-2xl p-3', card.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TrainingTrendChart({ analytics }: { analytics: TrainingAnalytics }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Training Activity Trend</CardTitle>
        <CardDescription>Sessions and quality trend over the last 14 active days.</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.dailyTrend.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            No training activity yet.
          </div>
        ) : (
          <ChartContainer config={analyticsChartConfig} className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics.dailyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar yAxisId="left" dataKey="sessions" fill="var(--color-sessions)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="var(--color-avgScore)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-avgScore)' }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TrainingModuleChart({ analytics }: { analytics: TrainingAnalytics }) {
  const moduleChartData = useMemo(() => {
    return analytics.topModules.map((module) => ({
      ...module,
      shortTitle: module.title.length > 18 ? `${module.title.slice(0, 18)}…` : module.title,
    }));
  }, [analytics.topModules]);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Modules</CardTitle>
        <CardDescription>Most-used training scenarios by session volume.</CardDescription>
      </CardHeader>
      <CardContent>
        {moduleChartData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            No module activity yet.
          </div>
        ) : (
          <ChartContainer config={analyticsChartConfig} className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="shortTitle" width={120} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 8, 8, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TrainingLeaderboard({ analytics }: { analytics: TrainingAnalytics }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[#C6843A]" />
          Agent Leaderboard
        </CardTitle>
        <CardDescription>Top contributors by training performance and activity.</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.agentBreakdown && analytics.agentBreakdown.length > 0 ? (
          <div className="space-y-3">
            {analytics.agentBreakdown.map((agent, index) => (
              <div key={agent.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
                      index === 0 && 'bg-[#F5E7D4] text-[#A25B2A]',
                      index === 1 && 'bg-[#E7EDF6] text-[#48627A]',
                      index >= 2 && 'bg-[#E5EFEA] text-[#2F6E5B]'
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium leading-none">{agent.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.sessions} sessions completed</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getScoreTone(agent.avgScore)}>
                    {formatScore(agent.avgScore)} avg
                  </Badge>
                </div>
                <Progress value={agent.avgScore ?? 0} className="h-2.5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            No agent performance data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrainingDistribution({ analytics }: { analytics: TrainingAnalytics }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Score Distribution</CardTitle>
        <CardDescription>How completed sessions are spread across score bands.</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.scoreDistribution.every((entry) => entry.count === 0) ? (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            No scored sessions yet.
          </div>
        ) : (
          <div className="space-y-4">
            {analytics.scoreDistribution.map((entry, index) => {
              const maxCount = Math.max(...analytics.scoreDistribution.map((item) => item.count), 1);
              return (
                <div key={entry.range} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{entry.range}</span>
                    <span className="text-muted-foreground">{entry.count} sessions</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(entry.count / maxCount) * 100}%`,
                        backgroundColor: scoreDistributionColors[index],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsDashboard() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(getDefaultFilterState);

  useEffect(() => {
    if (filters.rangePreset === 'custom' || filters.rangePreset === 'all') {
      return;
    }

    const dayMap: Record<Exclude<RangePreset, 'all' | 'custom'>, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    setFilters((current) => ({
      ...current,
      startDate: getPresetStartDate(dayMap[filters.rangePreset as keyof typeof dayMap]),
      endDate: toDateInputValue(new Date()),
    }));
  }, [filters.rangePreset]);

  const queryFilters = useMemo<TrainingAnalyticsFilters>(() => ({
    startDate: filters.rangePreset === 'all' ? undefined : filters.startDate || undefined,
    endDate: filters.rangePreset === 'all' ? undefined : filters.endDate || undefined,
    userId: filters.userId !== 'all' ? filters.userId : undefined,
    moduleId: filters.moduleId !== 'all' ? filters.moduleId : undefined,
  }), [filters]);

  const filterOptionsQuery = useQuery({
    queryKey: ['training-durable-analytics-options', profile?.organization_id],
    enabled: !!profile?.organization_id,
    queryFn: () => fetchTrainingAnalyticsOptions(profile!.organization_id),
    staleTime: 5 * 60 * 1000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['training-durable-analytics', profile?.organization_id, queryFilters],
    enabled: !!profile?.organization_id,
    queryFn: () => fetchTrainingAnalytics(profile!.organization_id, queryFilters),
    staleTime: 60000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([analyticsQuery.refetch(), filterOptionsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const resetFilters = () => {
    setFilters(getDefaultFilterState());
  };

  const hasCustomFilter = filters.rangePreset !== '30d' || filters.userId !== 'all' || filters.moduleId !== 'all';

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-[#F5E7D4] via-background to-[#E5EFEA]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-[#A25B2A]" />
              Training Analytics
            </CardTitle>
            <CardDescription className="max-w-2xl">
              Durable org-wide analytics for session volume, score quality, module adoption, and agent performance.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline">
                Retention: {filterOptionsQuery.data?.retentionDays ? `${filterOptionsQuery.data.retentionDays} days` : 'Indefinite'}
              </Badge>
              {queryFilters.moduleId && (
                <Badge variant="outline">Module filtered</Badge>
              )}
              {queryFilters.userId && (
                <Badge variant="outline">Agent filtered</Badge>
              )}
              {filters.rangePreset !== 'all' && (
                <Badge variant="outline">Date scoped</Badge>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || analyticsQuery.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', (refreshing || analyticsQuery.isFetching) && 'animate-spin')} />
            Refresh Analytics
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {analyticsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : analyticsQuery.isError || !analyticsQuery.data ? (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Analytics could not be loaded right now.
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-border/60 bg-muted/20 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Filter className="h-4 w-4 text-[#48627A]" />
                      Analytics Filters
                    </CardTitle>
                    <CardDescription>Slice durable analytics by time window, module, or agent.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetFilters} disabled={!hasCustomFilter}>
                    Reset Filters
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-2">
                  <Label>Range</Label>
                  <Select value={filters.rangePreset} onValueChange={(value: RangePreset) => setFilters((current) => ({ ...current, rangePreset: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    disabled={filters.rangePreset !== 'custom'}
                    onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    disabled={filters.rangePreset !== 'custom'}
                    onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Module</Label>
                  <Select value={filters.moduleId} onValueChange={(value) => setFilters((current) => ({ ...current, moduleId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All modules" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All modules</SelectItem>
                      {(filterOptionsQuery.data?.modules || []).map((module) => (
                        <SelectItem key={module.id} value={module.id}>{module.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Agent</Label>
                  <Select value={filters.userId} onValueChange={(value) => setFilters((current) => ({ ...current, userId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All agents</SelectItem>
                      {(filterOptionsQuery.data?.agents || []).map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <TrainingAnalyticsOverview analytics={analyticsQuery.data} />

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 lg:w-[420px]">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
                  <TrainingTrendChart analytics={analyticsQuery.data} />
                  <TrainingModuleChart analytics={analyticsQuery.data} />
                </div>
              </TabsContent>

              <TabsContent value="leaderboard" className="space-y-4">
                <TrainingLeaderboard analytics={analyticsQuery.data} />
              </TabsContent>

              <TabsContent value="distribution" className="space-y-4">
                <TrainingDistribution analytics={analyticsQuery.data} />
              </TabsContent>
            </Tabs>

            {analyticsQuery.data.topModules.length > 0 && (
              <Card className="border-border/60 bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Module Snapshot</CardTitle>
                  <CardDescription>Quick list of the most active training scenarios.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[220px] pr-4">
                    <div className="space-y-3">
                      {analyticsQuery.data.topModules.map((module, index) => (
                        <div key={module.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5EFEA] text-sm font-semibold text-[#2F6E5B]">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium leading-none">{module.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{module.count} sessions</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={getScoreTone(module.avgScore)}>
                            {formatScore(module.avgScore)} avg
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MetricsDashboard;
