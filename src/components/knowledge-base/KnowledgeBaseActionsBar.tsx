import type React from 'react';
import { Search, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KnowledgeEntryDialog } from '@/components/knowledge-base/KnowledgeEntryDialog';
import { sourcePriorityOptions, type KnowledgeSectionId, type NormalizedKnowledgeEntryPayload } from '@/components/knowledge-base/knowledgeEntryForm';
import type { KnowledgeSectionDefinition } from '@/components/knowledge-base/knowledgeSections';
import type { KnowledgeEntry } from '@/hooks/useKnowledgeBaseContent';

interface UploadedFileLike {
  name: string;
  size: number;
  type: string;
}

interface KnowledgeBaseActionsBarProps {
  showFilters?: boolean;
  showUploadAction?: boolean;
  showEntryDialogAction?: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  reviewStatusFilter: 'all' | 'fresh' | 'stale' | 'unreviewed';
  onReviewStatusFilterChange: (value: 'all' | 'fresh' | 'stale' | 'unreviewed') => void;
  sourcePriorityFilter: 'all' | (typeof sourcePriorityOptions)[number];
  onSourcePriorityFilterChange: (value: 'all' | (typeof sourcePriorityOptions)[number]) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  canManage: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  showEntryDialog: boolean;
  setShowEntryDialog: (open: boolean) => void;
  editingEntry: KnowledgeEntry | null;
  existingEntries: KnowledgeEntry[];
  currentUserDisplayName: string;
  selectedCategory: KnowledgeSectionId;
  uploadedFiles: UploadedFileLike[];
  clearUploadedFiles: () => void;
  removeUploadedFile: (index: number) => void;
  isDragging: boolean;
  isUploading: boolean;
  uploadProgress: number;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => Promise<void>;
  onCancelDialog: () => void;
  onSubmitDialog: (payload: NormalizedKnowledgeEntryPayload) => Promise<void>;
  knowledgeSections: KnowledgeSectionDefinition[];
  getFileIcon: (fileName: string, mimeType?: string | null) => React.ReactNode;
  getFileExtension: (fileName: string) => string;
  formatFileSize: (bytes: number | null) => string;
  resetEntryForm: () => void;
}

export function KnowledgeBaseActionsBar({
  showFilters = true,
  showUploadAction = true,
  showEntryDialogAction = true,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  reviewStatusFilter,
  onReviewStatusFilterChange,
  sourcePriorityFilter,
  onSourcePriorityFilterChange,
  hasActiveFilters,
  onClearFilters,
  canManage,
  fileInputRef,
  onFileUpload,
  showEntryDialog,
  setShowEntryDialog,
  editingEntry,
  existingEntries,
  currentUserDisplayName,
  selectedCategory,
  uploadedFiles,
  clearUploadedFiles,
  removeUploadedFile,
  isDragging,
  isUploading,
  uploadProgress,
  onDragOver,
  onDragLeave,
  onDrop,
  onCancelDialog,
  onSubmitDialog,
  knowledgeSections,
  getFileIcon,
  getFileExtension,
  formatFileSize,
  resetEntryForm,
}: KnowledgeBaseActionsBarProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      {showFilters ? (
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:w-auto xl:flex-1 xl:grid-cols-[minmax(220px,360px)_140px_170px_170px_auto]">
          <div className="relative min-w-0 md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              className="pl-9"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewStatusFilter} onValueChange={onReviewStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Review: All</SelectItem>
              <SelectItem value="fresh">Reviewed Recently</SelectItem>
              <SelectItem value="stale">Review Overdue</SelectItem>
              <SelectItem value="unreviewed">Never Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourcePriorityFilter} onValueChange={onSourcePriorityFilterChange}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Priority: All</SelectItem>
              <SelectItem value="canonical">Canonical</SelectItem>
              <SelectItem value="supporting">Supporting</SelectItem>
              <SelectItem value="reference">Reference Only</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1 md:w-fit md:self-center xl:justify-self-start">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      ) : <div className="hidden xl:block xl:flex-1" />}

      {canManage && (
        <div className="flex w-full flex-wrap gap-2 sm:justify-end xl:w-auto xl:flex-nowrap xl:justify-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,image/*"
            multiple
            onChange={(event) => {
              void onFileUpload(event);
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className={`${showUploadAction ? '' : 'hidden'} w-full sm:w-auto xl:w-auto`}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload documents or images</TooltipContent>
          </Tooltip>
          {showEntryDialogAction && (
            <KnowledgeEntryDialog
              open={showEntryDialog}
              onOpenChange={(open) => {
                setShowEntryDialog(open);
                if (!open) {
                  resetEntryForm();
                }
              }}
              editingEntry={editingEntry}
              defaultCategory={selectedCategory}
              existingEntries={existingEntries}
              currentUserDisplayName={currentUserDisplayName}
              uploadedFiles={uploadedFiles}
              clearUploadedFiles={clearUploadedFiles}
              removeUploadedFile={removeUploadedFile}
              isDragging={isDragging}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onCancel={onCancelDialog}
              onSubmit={onSubmitDialog}
              knowledgeSections={knowledgeSections}
              fileInputRef={fileInputRef}
              getFileIcon={getFileIcon}
              getFileExtension={getFileExtension}
              formatFileSize={formatFileSize}
            />
          )}
        </div>
      )}
    </div>
  );
}