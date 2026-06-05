import { AlertTriangle, Clock, Edit, Eye, EyeOff, Plus, Tag, Trash2, UserRound, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KnowledgeListSkeleton } from '@/components/shared/skeletons';
import { stripKnowledgeEntryMetadata } from '@/components/knowledge-base/knowledgeEntryForm';
import type { KnowledgeEntry } from '@/hooks/useKnowledgeBaseContent';
import type { KnowledgeSectionDefinition } from '@/components/knowledge-base/knowledgeSections';

interface KnowledgeSectionContentProps {
  section: KnowledgeSectionDefinition;
  entries: KnowledgeEntry[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  canManage: boolean;
  clearFilters: () => void;
  onAddEntry: (category: string) => void;
  onToggleEntryStatus: (entry: KnowledgeEntry) => void;
  onEditEntry: (entry: KnowledgeEntry) => void;
  onDeleteEntry: (entry: KnowledgeEntry) => void;
  getRelativeTime: (dateString: string) => string;
}

export function KnowledgeSectionContent({
  section,
  entries,
  isLoading,
  hasActiveFilters,
  canManage,
  clearFilters,
  onAddEntry,
  onToggleEntryStatus,
  onEditEntry,
  onDeleteEntry,
  getRelativeTime,
}: KnowledgeSectionContentProps) {
  const SectionIcon = section.icon;

  const getEntryPreview = (content: string) => stripKnowledgeEntryMetadata(content);

  const getPriorityLabel = (priority: KnowledgeEntry['source_priority']) => {
    switch (priority) {
      case 'canonical':
        return 'Canonical';
      case 'supporting':
        return 'Supporting';
      case 'reference':
        return 'Reference';
      default:
        return 'Canonical';
    }
  };

  const isReviewStale = (entry: KnowledgeEntry) => {
    if (!entry.reviewed_at) return true;
    const reviewedDate = new Date(entry.reviewed_at);
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - 90);
    return Number.isNaN(reviewedDate.getTime()) || reviewedDate < staleThreshold;
  };

  return (
    <div className="mt-4 space-y-6">
      {isLoading ? (
        <KnowledgeListSkeleton count={3} />
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-muted mb-4">
              <SectionIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">
              {hasActiveFilters ? 'No matching entries' : `No entries in ${section.label}`}
            </p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
              {hasActiveFilters
                ? "Try adjusting your search or filters to find what you're looking for."
                : `${section.description}. Click "Add Entry" to create your first one.`}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            ) : canManage ? (
              <Button className="mt-4" onClick={() => onAddEntry(section.id)}>
                <Plus className="h-4 w-4 mr-2" />
                Add {section.label} Entry
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Card key={entry.id} className={`transition-opacity ${!entry.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                      {!entry.is_active && (
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={entry.source_priority === 'canonical' ? 'default' : 'outline'} className="text-xs">
                        {getPriorityLabel(entry.source_priority)}
                      </Badge>
                      {entry.tags?.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                      {isReviewStale(entry) && (
                        <Badge variant="outline" className="text-xs border-warning/40 text-warning">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Review overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => onToggleEntryStatus(entry)}>
                            {entry.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{entry.is_active ? 'Deactivate' : 'Activate'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => onEditEntry(entry)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit entry</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDeleteEntry(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete entry</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{getEntryPreview(entry.content)}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Updated {getRelativeTime(entry.updated_at)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3 w-3" />
                    Owner: {entry.owner_name || 'Unassigned'}
                  </span>
                  <span>
                    Reviewed {entry.reviewed_at ? getRelativeTime(entry.reviewed_at) : 'never'}
                    {entry.reviewed_by_name ? ` by ${entry.reviewed_by_name}` : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}