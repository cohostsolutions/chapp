import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { UserCheck, Bot, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getAgentAwareLeadLabel, getAgentAwareLeadNoun } from '@/lib/reportingAgentConfig';

interface AgentManagedLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  assigned_agent_id: string | null;
  organization_id: string;
  conversation_id?: string;
}

interface AgentManagedLeadsBannerProps {
  className?: string;
  onLeadHandback?: (leadId: string) => void;
}

export function AgentManagedLeadsBanner({ className, onLeadHandback }: AgentManagedLeadsBannerProps) {
  const { profile, isSuperAdmin, aiAgentType } = useAuth();
  const { toast } = useToast();
  const [agentManagedLeads, setAgentManagedLeads] = useState<AgentManagedLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [handingBackId, setHandingBackId] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const leadLabel = getAgentAwareLeadLabel(aiAgentType);
  const leadNoun = getAgentAwareLeadNoun(aiAgentType);
  const singularLeadLabel = aiAgentType === 'cece'
    ? 'Inquiry'
    : aiAgentType === 'may'
      ? 'Demand'
      : 'Lead';

  // Fetch leads that are under agent control (not AI managed)
  useEffect(() => {
    const fetchAgentManagedLeads = async () => {
      if (!profile?.organization_id) return;

      try {
        const { data, error } = await supabase
          .from('leads')
          .select(`
            id,
            name,
            email,
            phone,
            assigned_agent_id,
            organization_id
          `)
          .eq('organization_id', profile.organization_id)
          .eq('is_ai_managed', false);

        if (error) throw error;

        // Fetch conversation IDs for these leads
        const leadsWithConversations = await Promise.all(
          (data || []).map(async (lead) => {
            const { data: convData } = await supabase
              .from('ai_conversations')
              .select('id')
              .eq('lead_id', lead.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...lead,
              conversation_id: convData?.id
            };
          })
        );

        setAgentManagedLeads(leadsWithConversations);
      } catch (error) {
        devError('Failed to fetch agent-managed leads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentManagedLeads();

    // Subscribe to realtime updates on leads for this org
    const channel = supabase
      .channel('agent-managed-leads')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `organization_id=eq.${profile.organization_id}`
        },
        () => {
          fetchAgentManagedLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, isSuperAdmin]);

  const handleHandback = async (lead: AgentManagedLead) => {
    setHandingBackId(lead.id);
    try {
      const { error } = await supabase.functions.invoke('agent-handback', {
        body: { 
          leadId: lead.id,
          conversationId: lead.conversation_id
        }
      });

      if (error) throw error;

      // Remove from local state
      setAgentManagedLeads(prev => prev.filter(l => l.id !== lead.id));

      toast({
        title: "Handed Back to AI",
        description: `${lead.name} is now managed by the AI again.`,
      });

      onLeadHandback?.(lead.id);
    } catch (error) {
      devError('Handback error:', error);
      toast({
        title: "Handback Failed",
        description: error instanceof Error ? error.message : "Failed to hand back to AI",
        variant: "destructive"
      });
    } finally {
      setHandingBackId(null);
    }
  };

  // Don't show if no agent-managed leads or dismissed
  if (isLoading || agentManagedLeads.length === 0 || isDismissed) {
    return null;
  }

  return (
    <Card 
      className={cn(
        "border-amber-500/50 bg-amber-50 dark:bg-amber-950",
        className
      )}
      role="region"
      aria-label={`${agentManagedLeads.length} ${leadLabel.toLowerCase()} under agent control`}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center" aria-hidden="true">
                <UserCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200 text-sm" id="agent-banner-title">
                  {agentManagedLeads.length} {agentManagedLeads.length === 1 ? singularLeadLabel : leadLabel} Under Agent Control
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300" id="agent-banner-description">
                  AI responses are paused for {agentManagedLeads.length === 1 ? `this ${leadNoun}` : `these ${leadLabel.toLowerCase()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1 text-amber-700"
                  aria-expanded={isExpanded}
                  aria-controls="agent-managed-leads-list"
                  aria-label={isExpanded ? "Hide agent-managed leads" : "Show agent-managed leads"}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Hide</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Show</span>
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
                className="text-amber-700 hover:text-amber-800"
                aria-label="Dismiss agent control banner"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <CollapsibleContent id="agent-managed-leads-list">
            <ScrollArea className="mt-3 max-h-[200px]">
              <ul className="space-y-2" role="list" aria-label={`Agent-managed ${leadLabel.toLowerCase()}`}>
                {agentManagedLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg bg-background/50 border border-amber-200 dark:border-amber-800"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.email || lead.phone || 'No contact info'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleHandback(lead)}
                      disabled={handingBackId === lead.id}
                      className="shrink-0 gap-1.5 border-primary text-primary hover:bg-primary/10"
                      aria-label={`Return ${lead.name} to AI management`}
                      aria-busy={handingBackId === lead.id}
                    >
                      {handingBackId === lead.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Bot className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span className="hidden sm:inline">Return to AI</span>
                      <span className="sm:hidden">AI</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
