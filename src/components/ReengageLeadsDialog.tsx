import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { AlertTriangle, MessageCircle, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AffectedLead {
  lead_id: string;
  name: string;
  phone: string;
  platform: string;
  conversation_id: string;
  organization_id: string;
  lastUserMessage?: string;
}

interface ReengageLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function ReengageLeadsDialog({ open, onOpenChange, onComplete }: ReengageLeadsDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const [affectedLeads, setAffectedLeads] = useState<AffectedLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingLeads, setProcessingLeads] = useState<Set<string>>(new Set());
  const [completedLeads, setCompletedLeads] = useState<Set<string>>(new Set());
  const [failedLeads, setFailedLeads] = useState<Map<string, string>>(new Map());
  const [isReengagingAll, setIsReengagingAll] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAffectedLeads();
    }
  }, [open, organizationId]);

  const fetchAffectedLeads = async () => {
    setIsLoading(true);
    try {
      // Fetch AI-managed leads with active conversations
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          phone,
          organization_id,
          last_ai_response_at,
          ai_conversations!inner (
            id,
            platform,
            status
          )
        `)
        .eq('is_ai_managed', true)
        .eq('ai_conversations.status', 'active')
        .eq('organization_id', organizationId || '')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For each lead, check if the last message is from user (unanswered)
      const leadMap = new Map<string, AffectedLead & { lastUserMessage?: string }>();
      
      for (const lead of data || []) {
        const leadData = lead as unknown as { 
          id: string; 
          name: string; 
          phone: string; 
          organization_id: string; 
          last_ai_response_at: string | null;
          ai_conversations?: Array<{ id: string; platform: string }> 
        };
        const conv = leadData.ai_conversations?.[0];
        if (!conv) continue;

        // Check last message for this lead
        const { data: lastComm } = await supabase
          .from('communications')
          .select('direction, role, content, created_at')
          .eq('lead_id', leadData.id)
          .eq('channel', conv.platform === 'messenger' ? 'messenger' : conv.platform)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Include lead if:
        // 1. Never got an AI response (last_ai_response_at is null), OR
        // 2. Last message is from user (direction=inbound or role=user)
        const lastMessageFromUser = lastComm && (lastComm.direction === 'inbound' || lastComm.role === 'user');
        const neverGotResponse = !leadData.last_ai_response_at;

        if ((neverGotResponse || lastMessageFromUser) && !leadMap.has(leadData.id)) {
          leadMap.set(leadData.id, {
            lead_id: leadData.id,
            name: leadData.name,
            phone: leadData.phone,
            platform: conv.platform,
            conversation_id: conv.id,
            organization_id: leadData.organization_id,
            lastUserMessage: lastComm?.content?.slice(0, 50) || undefined,
          });
        }
      }

      setAffectedLeads(Array.from(leadMap.values()));
    } catch (error) {
      devError('Error fetching affected leads:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch affected leads',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reengageLead = async (lead: AffectedLead) => {
    setProcessingLeads(prev => new Set(prev).add(lead.lead_id));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('reengage-lead', {
        body: {
          leadId: lead.lead_id,
          organizationId: lead.organization_id,
        },
      });

      if (error) throw error;

      setCompletedLeads(prev => new Set(prev).add(lead.lead_id));
      toast({
        title: 'Re-engagement sent',
        description: `Message sent to ${lead.name}`,
      });
    } catch (error: unknown) {
      devError('Error re-engaging lead:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed';
      setFailedLeads(prev => new Map(prev).set(lead.lead_id, errMsg));
      toast({
        title: 'Failed to re-engage',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setProcessingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.lead_id);
        return next;
      });
    }
  };

  const reengageAll = async () => {
    setIsReengagingAll(true);
    const remaining = affectedLeads.filter(
      l => !completedLeads.has(l.lead_id) && !failedLeads.has(l.lead_id)
    );

    for (const lead of remaining) {
      await reengageLead(lead);
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsReengagingAll(false);
    
    if (onComplete) {
      onComplete();
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'facebook':
      case 'messenger':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'whatsapp':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'instagram':
        return 'bg-pink-500/10 text-pink-600 border-pink-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const pendingCount = affectedLeads.filter(
    l => !completedLeads.has(l.lead_id) && !failedLeads.has(l.lead_id)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Re-engage Affected Leads
          </DialogTitle>
          <DialogDescription>
            These leads have unanswered messages and are waiting for a response.
            Send them an AI-generated contextual reply based on their conversation.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : affectedLeads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">No affected leads found</p>
            <p className="text-sm">All leads have received AI responses</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-2">
                {affectedLeads.map(lead => {
                  const isProcessing = processingLeads.has(lead.lead_id);
                  const isCompleted = completedLeads.has(lead.lead_id);
                  const isFailed = failedLeads.has(lead.lead_id);

                  return (
                    <div
                      key={lead.lead_id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isCompleted
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                          : isFailed
                          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{lead.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${getPlatformColor(lead.platform)}`}>
                            {lead.platform}
                          </Badge>
                        </div>
                        {lead.lastUserMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            "{lead.lastUserMessage}{lead.lastUserMessage.length >= 50 ? '...' : ''}"
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{lead.phone}</p>
                        {isFailed && (
                          <p className="text-xs text-red-600 mt-1">{failedLeads.get(lead.lead_id)}</p>
                        )}
                      </div>
                      <div className="ml-2">
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : isFailed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reengageLead(lead)}
                            disabled={isProcessing || isReengagingAll}
                          >
                            Retry
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reengageLead(lead)}
                            disabled={isProcessing || isReengagingAll}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5 mr-1" />
                                Send
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {completedLeads.size} of {affectedLeads.length} re-engaged
              </div>
              {pendingCount > 0 && (
                <Button
                  onClick={reengageAll}
                  disabled={isReengagingAll || pendingCount === 0}
                >
                  {isReengagingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Re-engaging...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Re-engage All ({pendingCount})
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
