import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Flame,
  Thermometer,
  Snowflake,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { isToday, formatDistanceToNow } from 'date-fns';

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

interface SimpleLeadsWidgetProps {
  leads: Lead[];
  isLoading: boolean;
}

export function SimpleLeadsWidget({ leads, isLoading }: SimpleLeadsWidgetProps) {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const hot = leads.filter(l => l.lead_temperature === 'hot').length;
    const warm = leads.filter(l => l.lead_temperature === 'warm').length;
    const cold = leads.filter(l => l.lead_temperature === 'cold').length;
    const aiManaged = leads.filter(l => l.is_ai_managed).length;
    const todayNew = leads.filter(l => isToday(new Date(l.created_at))).length;

    // Most recent hot lead
    const hotLead = leads
      .filter(l => l.lead_temperature === 'hot')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

    return {
      hot,
      warm,
      cold,
      aiManaged,
      todayNew,
      hotLead,
    };
  }, [leads]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2 p-3 md:p-4">
          <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Leads Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted/50 rounded-lg" />
            <div className="h-8 bg-muted/50 rounded-lg" />
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
          Leads Overview
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/sales-operations?tab=leads')}
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {/* Hot Leads */}
          <div 
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors"
            onClick={() => navigate('/sales-operations?tab=leads')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Hot</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.hot}</p>
          </div>

          {/* Warm Leads */}
          <div 
            className="p-3 rounded-lg bg-warning/10 border border-warning/20 cursor-pointer hover:bg-warning/20 transition-colors"
            onClick={() => navigate('/sales-operations?tab=leads')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">Warm</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.warm}</p>
          </div>

          {/* Cold Leads */}
          <div 
            className="p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => navigate('/sales-operations?tab=leads')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Snowflake className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Cold</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.cold}</p>
          </div>

          {/* AI Managed */}
          <div 
            className="p-3 rounded-lg bg-info/10 border border-info/20 cursor-pointer hover:bg-info/20 transition-colors"
            onClick={() => navigate('/chats')}
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-info" />
              <span className="text-xs text-muted-foreground">AI Managed</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.aiManaged}</p>
          </div>
        </div>

        {/* Hot Lead Preview */}
        {summary.hotLead && (
          <div 
            className="mt-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2 border-l-destructive"
            onClick={() => navigate('/sales-operations?tab=leads')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-xs text-foreground truncate">
                    Hot: {summary.hotLead.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {summary.hotLead.status} • {formatDistanceToNow(new Date(summary.hotLead.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/30">
                Priority
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
