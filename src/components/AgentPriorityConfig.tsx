import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ArrowUpDown, Save, Loader2, GripVertical } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface AgentPriority {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  priority: number;
  is_available: boolean;
}

interface Organization {
  id: string;
  name: string;
  agent_assignment_method: 'round_robin' | 'priority';
}

export function AgentPriorityConfig() {
  const { profile, isSuperAdmin, isClientAdmin } = useAuth();
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [agents, setAgents] = useState<AgentPriority[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile?.organization_id) return;
    setIsLoading(true);

    try {
      // Fetch organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, agent_assignment_method')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData as Organization);

      // Fetch agents in organization - use profiles_safe view for security
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles_safe')
        .select('id, full_name, email')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      if (agentsError) throw agentsError;

      // Fetch existing priorities
      const { data: prioritiesData } = await supabase
        .from('agent_priorities')
        .select('*')
        .eq('organization_id', profile.organization_id);

      // Merge agents with priorities
      const priorityMap = new Map(prioritiesData?.map(p => [p.agent_id, p]) || []);
      const mergedAgents: AgentPriority[] = (agentsData || []).map((agent, index) => {
        const existing = priorityMap.get(agent.id);
        return {
          id: existing?.id || '',
          agent_id: agent.id,
          agent_name: agent.full_name || agent.email,
          agent_email: agent.email,
          priority: existing?.priority || index + 1,
          is_available: existing?.is_available ?? true,
        };
      });

      // Sort by priority
      mergedAgents.sort((a, b) => a.priority - b.priority);
      setAgents(mergedAgents);
    } catch (error) {
      devError('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent configuration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignmentMethodChange = async (method: 'round_robin' | 'priority') => {
    if (!organization) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ agent_assignment_method: method })
        .eq('id', organization.id);

      if (error) throw error;

      setOrganization({ ...organization, agent_assignment_method: method });
      toast({
        title: 'Assignment Method Updated',
        description: `Now using ${method === 'round_robin' ? 'Round Robin' : 'Priority-based'} assignment`,
      });
    } catch (error) {
      devError('Error updating method:', error);
      toast({
        title: 'Error',
        description: 'Failed to update assignment method',
        variant: 'destructive',
      });
    }
  };

  const handlePriorityChange = (agentId: string, newPriority: number) => {
    setAgents(prev => 
      prev.map(a => a.agent_id === agentId ? { ...a, priority: newPriority } : a)
        .sort((a, b) => a.priority - b.priority)
    );
  };

  const handleAvailabilityChange = (agentId: string, isAvailable: boolean) => {
    setAgents(prev => 
      prev.map(a => a.agent_id === agentId ? { ...a, is_available: isAvailable } : a)
    );
  };

  const moveAgent = (index: number, direction: 'up' | 'down') => {
    const newAgents = [...agents];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (swapIndex < 0 || swapIndex >= agents.length) return;
    
    // Swap priorities
    const tempPriority = newAgents[index].priority;
    newAgents[index].priority = newAgents[swapIndex].priority;
    newAgents[swapIndex].priority = tempPriority;
    
    // Swap positions
    [newAgents[index], newAgents[swapIndex]] = [newAgents[swapIndex], newAgents[index]];
    
    setAgents(newAgents);
  };

  const savePriorities = async () => {
    if (!profile?.organization_id) return;
    setIsSaving(true);

    try {
      // Upsert all agent priorities
      for (const agent of agents) {
        const { error } = await supabase
          .from('agent_priorities')
          .upsert({
            organization_id: profile.organization_id,
            agent_id: agent.agent_id,
            priority: agent.priority,
            is_available: agent.is_available,
          }, {
            onConflict: 'organization_id,agent_id'
          });

        if (error) throw error;
      }

      toast({
        title: 'Priorities Saved',
        description: 'Agent priorities have been updated successfully',
      });
    } catch (error) {
      devError('Error saving priorities:', error);
      toast({
        title: 'Error',
        description: 'Failed to save agent priorities',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <CardTitle>Agent Assignment Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure how leads are assigned to agents when qualified
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assignment Method */}
        <div className="space-y-3">
          <Label>Assignment Method</Label>
          <Select
            value={organization?.agent_assignment_method || 'round_robin'}
            onValueChange={(v) => handleAssignmentMethodChange(v as 'round_robin' | 'priority')}
          >
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round_robin">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Round Robin
                </div>
              </SelectItem>
              <SelectItem value="priority">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4" />
                  Priority-based
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {organization?.agent_assignment_method === 'round_robin'
              ? 'Leads are distributed evenly among available agents in rotation'
              : 'Leads are assigned to the highest-priority available agent'}
          </p>
        </div>

        <Separator />

        {/* Agent Priorities */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Agent Priorities</Label>
            <Button onClick={savePriorities} disabled={isSaving} size="sm">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Priorities
            </Button>
          </div>

          {agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No agents found in this organization</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent, index) => (
                <div
                  key={agent.agent_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    agent.is_available 
                      ? 'bg-muted/30 border-border' 
                      : 'bg-muted/10 border-border/50 opacity-60'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveAgent(index, 'up')}
                      disabled={index === 0 || organization?.agent_assignment_method === 'round_robin'}
                    >
                      <span className="text-xs">▲</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveAgent(index, 'down')}
                      disabled={index === agents.length - 1 || organization?.agent_assignment_method === 'round_robin'}
                    >
                      <span className="text-xs">▼</span>
                    </Button>
                  </div>
                  
                  <Badge 
                    variant="outline" 
                    className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                      organization?.agent_assignment_method === 'priority' 
                        ? 'bg-primary/10 border-primary/30' 
                        : ''
                    }`}
                  >
                    {index + 1}
                  </Badge>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agent.agent_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{agent.agent_email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`available-${agent.agent_id}`} className="text-sm text-muted-foreground">
                      Available
                    </Label>
                    <Switch
                      id={`available-${agent.agent_id}`}
                      checked={agent.is_available}
                      onCheckedChange={(checked) => handleAvailabilityChange(agent.agent_id, checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
