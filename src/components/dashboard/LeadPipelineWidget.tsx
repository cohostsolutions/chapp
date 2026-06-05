import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Flame,
  Thermometer,
  Snowflake,
  Clock,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Phone,
  Mail,
} from 'lucide-react';
import { formatDistanceToNow, isToday, subDays, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  lead_temperature: string | null;
  created_at: string;
  updated_at: string;
  is_ai_managed?: boolean;
}

interface LeadPipelineWidgetProps {
  leads: Lead[];
  isLoading: boolean;
}

const temperatureConfig: Record<string, { label: string; color: string; borderColor: string; icon: React.ReactNode }> = {
  hot: { label: 'Hot', color: 'text-destructive', borderColor: 'border-l-destructive', icon: <Flame className="w-3 h-3" /> },
  warm: { label: 'Warm', color: 'text-warning', borderColor: 'border-l-warning', icon: <Thermometer className="w-3 h-3" /> },
  cold: { label: 'Cold', color: 'text-primary', borderColor: 'border-l-primary', icon: <Snowflake className="w-3 h-3" /> },
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'New', color: 'text-info', icon: <Clock className="w-3 h-3" /> },
  contacted: { label: 'Contacted', color: 'text-primary', icon: <MessageSquare className="w-3 h-3" /> },
  qualified: { label: 'Qualified', color: 'text-success', icon: <CheckCircle className="w-3 h-3" /> },
  converted: { label: 'Converted', color: 'text-success', icon: <TrendingUp className="w-3 h-3" /> },
};

export function LeadPipelineWidget({ leads, isLoading }: LeadPipelineWidgetProps) {
  const navigate = useNavigate();

  const categorizedLeads = useMemo(() => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);

    // By temperature
    const hot = leads.filter(l => l.lead_temperature === 'hot');
    const warm = leads.filter(l => l.lead_temperature === 'warm');
    const cold = leads.filter(l => l.lead_temperature === 'cold');

    // By status (pipeline stages)
    const newLeads = leads.filter(l => l.status === 'new');
    const contacted = leads.filter(l => l.status === 'contacted');
    const qualified = leads.filter(l => l.status === 'qualified');
    const converted = leads.filter(l => l.status === 'converted');

    // Recent activity
    const recentlyUpdated = leads
      .filter(l => isWithinInterval(new Date(l.updated_at), { start: sevenDaysAgo, end: today }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);

    // Today's new leads
    const todayNewLeads = leads.filter(l => isToday(new Date(l.created_at)));

    // AI managed leads
    const aiManaged = leads.filter(l => l.is_ai_managed);

    // Conversion rate (last 7 days)
    const recentLeads = leads.filter(l => 
      isWithinInterval(new Date(l.created_at), { start: sevenDaysAgo, end: today })
    );
    const recentConverted = recentLeads.filter(l => l.status === 'converted');
    const conversionRate = recentLeads.length > 0 
      ? (recentConverted.length / recentLeads.length) * 100 
      : 0;

    return {
      hot,
      warm,
      cold,
      newLeads,
      contacted,
      qualified,
      converted,
      recentlyUpdated,
      todayNewLeads: todayNewLeads.length,
      aiManaged: aiManaged.length,
      conversionRate,
      totalActive: newLeads.length + contacted.length + qualified.length,
    };
  }, [leads]);

  const LeadItem = ({ lead }: { lead: Lead }) => (
    <div
      className={cn(
        'flex items-center justify-between p-2 md:p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2',
        temperatureConfig[lead.lead_temperature || 'cold']?.borderColor || 'border-l-muted'
      )}
      onClick={() => navigate('/sales-operations?tab=leads')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          lead.lead_temperature === 'hot' && 'bg-destructive/20',
          lead.lead_temperature === 'warm' && 'bg-warning/20',
          lead.lead_temperature === 'cold' && 'bg-primary/20',
          !lead.lead_temperature && 'bg-muted'
        )}>
          {temperatureConfig[lead.lead_temperature || 'cold']?.icon || <Users className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-xs md:text-sm text-foreground truncate">
            {lead.name}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {lead.phone && (
              <span className="flex items-center gap-0.5">
                <Phone className="w-2.5 h-2.5" />
                {lead.phone}
              </span>
            )}
            {lead.is_ai_managed && (
              <Badge variant="outline" className="text-[8px] h-4 px-1 bg-info/10 text-info border-info/30">
                AI
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className={cn('text-[10px] h-5', statusConfig[lead.status]?.color)}>
          {statusConfig[lead.status]?.label || lead.status}
        </Badge>
      </div>
    </div>
  );

  const Section = ({
    title,
    icon: Icon,
    iconColor,
    leads: sectionLeads,
    emptyText,
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    leads: Lead[];
    emptyText: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-xs md:text-sm font-medium flex items-center gap-1.5', iconColor)}>
          <Icon className="w-3.5 h-3.5" />
          {title}
        </h3>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {sectionLeads.length}
        </Badge>
      </div>
      {sectionLeads.length > 0 ? (
        <div className="space-y-1.5">
          {sectionLeads.slice(0, 3).map(lead => (
            <LeadItem key={lead.id} lead={lead} />
          ))}
          {sectionLeads.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-[10px] text-muted-foreground"
              onClick={() => navigate('/sales-operations?tab=leads')}
            >
              +{sectionLeads.length - 3} more
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[10px] md:text-xs text-muted-foreground py-2">{emptyText}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2 p-3 md:p-4">
          <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Lead Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2 p-3 md:p-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Lead Pipeline
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/sales-operations?tab=leads')}
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-secondary/30 rounded-lg">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{categorizedLeads.todayNewLeads}</p>
            <p className="text-[10px] text-muted-foreground">New Today</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-lg font-bold text-foreground">{categorizedLeads.totalActive}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </div>
          <div className="text-center border-r border-border/50">
            <p className="text-lg font-bold text-foreground">{categorizedLeads.aiManaged}</p>
            <p className="text-[10px] text-muted-foreground">AI Managed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{categorizedLeads.conversionRate.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">Convert</p>
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Hot Leads */}
            <Section
              title="Hot Leads"
              icon={Flame}
              iconColor="text-destructive"
              leads={categorizedLeads.hot}
              emptyText="No hot leads"
            />

            {/* Warm Leads */}
            <Section
              title="Warm Leads"
              icon={Thermometer}
              iconColor="text-warning"
              leads={categorizedLeads.warm}
              emptyText="No warm leads"
            />

            {/* New Leads */}
            <Section
              title="New Leads"
              icon={Clock}
              iconColor="text-info"
              leads={categorizedLeads.newLeads}
              emptyText="No new leads"
            />

            {/* Pipeline Stages */}
            <div className="md:col-span-2 xl:col-span-3">
              <div className="space-y-2">
                <h3 className="text-xs md:text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Pipeline Stages
                </h3>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 rounded-lg bg-info/10 text-center cursor-pointer hover:bg-info/20" onClick={() => navigate('/sales-operations?tab=leads')}>
                    <p className="text-sm font-bold">{categorizedLeads.newLeads.length}</p>
                    <p className="text-[10px] text-muted-foreground">New</p>
                  </div>
                  <div className="text-muted-foreground self-center">→</div>
                  <div className="flex-1 p-2 rounded-lg bg-primary/10 text-center cursor-pointer hover:bg-primary/20" onClick={() => navigate('/sales-operations?tab=leads')}>
                    <p className="text-sm font-bold">{categorizedLeads.contacted.length}</p>
                    <p className="text-[10px] text-muted-foreground">Contacted</p>
                  </div>
                  <div className="text-muted-foreground self-center">→</div>
                  <div className="flex-1 p-2 rounded-lg bg-warning/10 text-center cursor-pointer hover:bg-warning/20" onClick={() => navigate('/sales-operations?tab=leads')}>
                    <p className="text-sm font-bold">{categorizedLeads.qualified.length}</p>
                    <p className="text-[10px] text-muted-foreground">Qualified</p>
                  </div>
                  <div className="text-muted-foreground self-center">→</div>
                  <div className="flex-1 p-2 rounded-lg bg-success/10 text-center cursor-pointer hover:bg-success/20" onClick={() => navigate('/sales-operations?tab=leads')}>
                    <p className="text-sm font-bold">{categorizedLeads.converted.length}</p>
                    <p className="text-[10px] text-muted-foreground">Converted</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="md:col-span-2 xl:col-span-3">
              <Section
                title="Recent Activity"
                icon={MessageSquare}
                iconColor="text-muted-foreground"
                leads={categorizedLeads.recentlyUpdated}
                emptyText="No recent activity"
              />
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
