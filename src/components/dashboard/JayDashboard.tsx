import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Phone,
  MessageSquare,
  Clock,
  CheckCircle,
  Flame,
  Thermometer,
  Loader2,
  GraduationCap,
  Ticket
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { LeadTemperatureBadge } from '@/components/LeadTemperatureBadge';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { AgentManagedLeadsBanner } from '@/components/AgentManagedLeadsBanner';
import { useNavigate } from 'react-router-dom';
import { devLog } from '@/lib/logger';
import { useRecentLeads } from '@/hooks/useDashboardStats';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useDashboardSupportTickets } from '@/hooks/useDashboardSupportTickets';
import { useDashboardTraining } from '@/hooks/useDashboardTraining';
import { formatDistanceToNow } from 'date-fns';
import { LeadPipelineWidget } from './LeadPipelineWidget';
import { SimpleLeadsWidget } from './SimpleLeadsWidget';
import { DashboardHeader } from './DashboardHeader';

import { WidgetCustomizer } from './WidgetCustomizer';
import { DashboardSkeleton } from './DashboardSkeleton';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'New', color: 'bg-info/20 text-info border-info/30', icon: <Clock className="w-3 h-3" /> },
  contacted: { label: 'Contacted', color: 'bg-primary/20 text-primary border-primary/30', icon: <MessageSquare className="w-3 h-3" /> },
  qualified: { label: 'Qualified', color: 'bg-success/20 text-success border-success/30', icon: <CheckCircle className="w-3 h-3" /> },
  converted: { label: 'Converted', color: 'bg-success/20 text-success border-success/30', icon: <CheckCircle className="w-3 h-3" /> },
  lost: { label: 'Lost', color: 'bg-destructive/20 text-destructive border-destructive/30', icon: <Clock className="w-3 h-3" /> },
};

const WIDGET_CONFIG = [
  { id: 'stats', label: 'Statistics Cards', description: 'Key metrics at a glance' },
  { id: 'pipeline', label: 'Lead Pipeline', description: 'Visual lead progress tracker' },
  { id: 'alerts', label: 'Lead Alerts', description: 'Hot and warm lead notifications' },
  { id: 'tickets', label: 'Support Tickets', description: 'Recent helpdesk activity' },
  { id: 'training', label: 'AI Training', description: 'Training performance stats' },
  { id: 'recent', label: 'Recent Leads', description: 'Latest lead activity' },
];

export default function JayDashboard() {
  const { profile, isClientAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { supportTickets, refetch: refetchSupportTickets } = useDashboardSupportTickets(profile?.organization_id, isClientAdmin, 5);
  const { data: trainingData } = useDashboardTraining(profile?.organization_id, isClientAdmin);
  const trainingEnabled = trainingData?.trainingEnabled ?? false;
  const trainingStats = trainingData?.trainingStats ?? null;
  
  // Dashboard customization
  const {
    selectedWidgets,
    availableWidgets,
    isEditMode,
    setIsEditMode,
    isSaving,
    isLoading: isLayoutLoading,
    saveLayout,
    resetLayout,
    toggleWidget,
  } = useDashboardLayout(
    'jay',
    ['stats', 'pipeline', 'alerts', 'tickets', 'recent'],
    ['stats', 'pipeline', 'alerts', 'tickets', 'training', 'recent'],
    { training_enabled: trainingEnabled }
  );
  
  // Use React Query for data fetching with proper caching
  const { data: leads = [], isLoading: loading, refetch } = useRecentLeads(20);
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchSupportTickets()]);
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refetchSupportTickets]);

  useEffect(() => {
    devLog('JayDashboard mounted');
    
    // Set up realtime subscription that invalidates React Query cache
    const channel = supabase
      .channel('dashboard-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          // Invalidate query instead of manual refetch - React Query handles deduplication
          queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Memoize stats calculations to prevent recalculation on every render
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayLeads = leads.filter(l => new Date(l.created_at).toDateString() === today);
    const hotLeads = leads.filter(l => l.lead_temperature === 'hot');
    const warmLeads = leads.filter(l => l.lead_temperature === 'warm');
    const aiManagedLeads = leads.filter(l => l.is_ai_managed);

    return {
      todayLeads,
      hotLeads,
      warmLeads,
      aiManagedLeads,
      cards: [
        { 
          label: 'Total Leads', 
          value: leads.length.toString(), 
          change: todayLeads.length, 
          trend: 'up' as const,
          icon: Users,
          color: 'text-primary',
          path: '/sales-operations?tab=leads'
        },
        { 
          label: 'Hot Leads', 
          value: hotLeads.length.toString(), 
          change: 0, 
          trend: 'up' as const,
          icon: Flame,
          color: 'text-destructive',
          path: '/sales-operations?tab=leads'
        },
        { 
          label: 'Warm Leads', 
          value: warmLeads.length.toString(), 
          change: 0, 
          trend: 'up' as const,
          icon: Thermometer,
          color: 'text-warning',
          path: '/sales-operations?tab=leads'
        },
        { 
          label: 'AI Managed', 
          value: aiManagedLeads.length.toString(), 
          change: 0, 
          trend: 'up' as const,
          icon: MessageSquare,
          color: 'text-info',
          path: '/chats'
        },
      ]
    };
  }, [leads]);

  // Show skeleton while initial data loads
  if (isLayoutLoading || (loading && leads.length === 0)) {
    return <DashboardSkeleton />;
  }

  const widgetsForCustomizer = WIDGET_CONFIG.filter(w => availableWidgets.includes(w.id));

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-3 md:space-y-4 lg:space-y-6 animate-fade-in" data-tour="dashboard-content">
        {/* Agent Control Banner */}
        <AgentManagedLeadsBanner onLeadHandback={() => refetch()} />
        
        {/* Header */}
        <DashboardHeader
          userName={profile?.full_name}
          subtitle="Your leads overview for today"
          onCustomize={() => setIsEditMode(!isEditMode)}
          onRefresh={handleRefresh}
          isEditMode={isEditMode}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
        />


        {/* Edit Mode Panel */}
        {isEditMode && (
          <WidgetCustomizer
            widgets={widgetsForCustomizer}
            selectedWidgets={selectedWidgets}
            onToggle={toggleWidget}
            onSave={saveLayout}
            onReset={resetLayout}
            isSaving={isSaving}
          />
        )}

      {/* Stats Grid */}
      {selectedWidgets.includes('stats') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
          {stats.cards.map((stat, index) => (
            <StatsCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              change={stat.change}
              icon={stat.icon}
              iconColor={stat.color}
              path={stat.path}
              animationDelay={index * 100}
            />
          ))}
        </div>
        )}

        {/* Lead Pipeline Widget - Detailed for client admin, Simple for agent */}
        {selectedWidgets.includes('pipeline') && (
          isClientAdmin ? (
            <LeadPipelineWidget leads={leads} isLoading={loading} />
          ) : (
            <SimpleLeadsWidget leads={leads} isLoading={loading} />
          )
        )}

        {/* Training Widget */}
      {selectedWidgets.includes('training') && trainingEnabled && isClientAdmin && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-semibold text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              AI Training Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {!trainingStats ? (
              <p className="text-muted-foreground">No training data yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Sessions:</span>
                  <span>{trainingStats.totalSessions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Avg Score:</span>
                  <span>{trainingStats.avgScore === null ? '—' : trainingStats.avgScore.toFixed(1)}</span>
                </div>
                <div>
                  <span className="font-medium">Top Modules</span>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    {trainingStats.topModules.map(m => (
                      <li key={m.id}>{m.title} — {m.count} sessions {m.avgScore ? `(avg ${m.avgScore.toFixed(1)})` : ''}</li>
                    ))}
                    {trainingStats.topModules.length === 0 && <li className="text-muted-foreground">No sessions yet</li>}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts Row */}
      {selectedWidgets.includes('alerts') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 lg:gap-4">
          {/* Hot Leads Alert */}
          {stats.hotLeads.length > 0 && (
            <Card className="glass border-destructive/50">
              <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-4">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2 text-destructive">
                  <Flame className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Hot Leads
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <p className="text-xl md:text-2xl font-bold text-foreground">{stats.hotLeads.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground">ready for action</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 md:mt-3 border-destructive text-destructive hover:bg-destructive/10 h-7 md:h-8 text-xs md:text-sm"
                  onClick={() => navigate('/sales-operations?tab=leads')}
                >
                  View Hot Leads
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Warm Leads */}
          {stats.warmLeads.length > 0 && (
            <Card className="glass border-warning/50">
              <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-4">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2 text-warning">
                  <Thermometer className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Warm Leads
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <p className="text-xl md:text-2xl font-bold text-foreground">{stats.warmLeads.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground">showing interest</p>
              </CardContent>
            </Card>
          )}

          {/* AI Managed */}
          {stats.aiManagedLeads.length > 0 && (
            <Card className="glass border-info/50 sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-4">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2 text-info">
                  <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  AI Managing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0">
                <p className="text-xl md:text-2xl font-bold text-foreground">{stats.aiManagedLeads.length}</p>
                <p className="text-xs md:text-sm text-muted-foreground">leads being nurtured</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Support Tickets Widget */}
      {selectedWidgets.includes('tickets') && isClientAdmin && (
        <Card className="glass">
          <CardHeader className="pb-2 lg:pb-4 flex flex-row items-center justify-between gap-2 p-3 md:p-4 lg:p-6">
            <CardTitle className="text-sm md:text-base lg:text-lg font-semibold text-foreground flex items-center gap-2">
              <Ticket className="w-5 h-5 text-orange-500" />
              Support Tickets
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs md:text-sm" onClick={() => navigate('/support-tickets')}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-2.5 md:p-3 lg:p-6 pt-0">
            {supportTickets.length === 0 ? (
              <div className="text-center py-6">
                <Ticket className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No support tickets</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {supportTickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/support-tickets')}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={ticket.priority === 'urgent' ? 'destructive' : ticket.priority === 'high' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {ticket.priority}
                          </Badge>
                          <Badge 
                            variant={ticket.status === 'open' ? 'outline' : ticket.status === 'in_progress' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}


      {/* Recent Leads */}
      {selectedWidgets.includes('recent') && (
        <Card className="glass">
          <CardHeader className="pb-2 lg:pb-4 flex flex-row items-center justify-between gap-2 p-3 md:p-4 lg:p-6">
            <CardTitle className="text-sm md:text-base lg:text-lg font-semibold text-foreground">Recent Leads</CardTitle>
            <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs md:text-sm" onClick={() => navigate('/sales-operations?tab=leads')}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-2.5 md:p-3 lg:p-6 pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No leads yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.slice(0, 5).map((lead, index) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => navigate('/sales-operations?tab=leads')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{lead.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{lead.email || lead.phone || 'No contact'}</span>
                          {lead.source && (
                            <>
                              <span>•</span>
                              <span>{lead.source}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.lead_temperature && (
                        <LeadTemperatureBadge temperature={lead.lead_temperature} />
                      )}
                      <Badge variant="outline" className={statusConfig[lead.status]?.color}>
                        {statusConfig[lead.status]?.icon}
                        <span className="ml-1">{statusConfig[lead.status]?.label}</span>
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </PullToRefresh>
  );
}
