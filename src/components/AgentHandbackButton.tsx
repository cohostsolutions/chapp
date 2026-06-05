import { useState } from "react";
import { devError } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Bot, Loader2 } from "lucide-react";
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

interface AgentHandbackButtonProps {
  leadId: string;
  leadName: string;
  aiAgentName?: string;
  conversationId?: string;
  onHandback?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "icon";
}

export function AgentHandbackButton({ 
  leadId, 
  leadName,
  aiAgentName = 'AI',
  conversationId, 
  onHandback,
  disabled,
  className,
  variant = "default"
}: AgentHandbackButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleHandback = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('agent-handback', {
        body: { 
          leadId,
          conversationId 
        }
      });

      if (error) throw error;

      toast({
        title: "Handed Back to AI",
        description: `${aiAgentName} is now managing the conversation with ${leadName}.`,
      });

      onHandback?.();
    } catch (error) {
      devError('Handback error:', error);
      toast({
        title: "Handback Failed",
        description: error instanceof Error ? error.message : "Failed to hand back to AI",
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
          size={variant === "icon" ? "icon" : "sm"}
          disabled={disabled || isLoading}
          className={variant === "icon" 
            ? `h-7 w-7 border-primary text-primary hover:bg-primary/10 ${className || ''}`
            : `gap-2 border-primary text-primary hover:bg-primary/10 ${className || ''}`
          }
        >
          {isLoading ? (
            <Loader2 className={variant === "icon" ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
          ) : (
            <Bot className={variant === "icon" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          )}
          {variant !== "icon" && "Hand to AI"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hand Back to {aiAgentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to hand the conversation with <strong>{leadName}</strong> back to {aiAgentName}.
            <br /><br />
            {aiAgentName} will send a message: <em>"{aiAgentName} is back to assist you! Feel free to continue your conversation."</em>
            <br /><br />
            The AI will resume full management of this conversation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleHandback} disabled={isLoading}>
            {isLoading ? "Handing Back..." : "Confirm Handback"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
