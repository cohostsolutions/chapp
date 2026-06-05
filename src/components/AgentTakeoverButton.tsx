import { useState } from "react";
import { devError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AgentTakeoverButtonProps {
  leadId: string;
  leadName: string;
  conversationId?: string;
  onTakeover?: () => void;
  disabled?: boolean;
}

export function AgentTakeoverButton({ 
  leadId, 
  leadName, 
  conversationId, 
  onTakeover,
  disabled 
}: AgentTakeoverButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isAlreadyManaged = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('is_ai_managed')
      .eq('id', leadId)
      .maybeSingle();
    if (error) throw error;
    return data ? !data.is_ai_managed : false;
  };

  const handleTakeover = async () => {
    setIsLoading(true);
    try {
      const alreadyTaken = await isAlreadyManaged();
      if (alreadyTaken) {
        toast({
          title: "Already managed",
          description: `${leadName} is already managed by an agent.`,
        });
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('agent-takeover', {
        body: { 
          leadId, 
          agentId: user.id,
          conversationId 
        }
      });

      if (error) throw error;

      toast({
        title: "Conversation Taken Over",
        description: `You are now managing the conversation with ${leadName}. The AI has sent a handoff message.`,
      });

      onTakeover?.();
    } catch (error) {
      devError('Takeover error:', error);
      toast({
        title: "Takeover Failed",
        description: error instanceof Error ? error.message : "Failed to take over conversation",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled || isLoading}
          className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          Take Over
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Take Over Conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to take over the conversation with <strong>{leadName}</strong>.
            <br /><br />
            The AI will send a handoff message: <em>"I'll connect you with someone from our team who can better assist you."</em>
            <br /><br />
            After this, the AI will stop auto-responding until you hand the conversation back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleTakeover} disabled={isLoading}>
            {isLoading ? "Taking Over..." : "Confirm Takeover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
