import { AlertTriangle, BookOpen, Bot, CheckCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface KnowledgeBaseHeaderProps {
  totalEntries: number;
  activeEntries: number;
  staleEntries: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onNeedsReview: () => void;
  onOpenChatPreview: () => void;
}

export function KnowledgeBaseHeader({
  totalEntries,
  activeEntries,
  staleEntries,
  isRefreshing,
  onRefresh,
  onNeedsReview,
  onOpenChatPreview,
}: KnowledgeBaseHeaderProps) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="space-y-1 shrink-0">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Knowledge Base
        </h1>
        <p className="text-muted-foreground text-sm">
          Train your AI with custom knowledge, FAQs, and conversation examples
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground hidden 2xl:inline">Total Entries</span>
          <span className="text-muted-foreground hidden lg:inline 2xl:hidden">Entries</span>
          <span className="font-semibold text-foreground">{totalEntries}</span>
        </Badge>

        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-normal">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted-foreground hidden lg:inline">Active</span>
          <span className="font-semibold text-foreground">{activeEntries}</span>
        </Badge>

        <Button variant="outline" onClick={onNeedsReview} className="gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="hidden sm:inline">Needs Review</span>
          <span className="font-semibold">{staleEntries}</span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>
        <Button onClick={onOpenChatPreview} className="gap-2">
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">Test AI</span>
        </Button>
      </div>
    </div>
  );
}