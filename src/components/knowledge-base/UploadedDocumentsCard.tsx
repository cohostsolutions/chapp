import { AlertCircle, ChevronDown, Eye, File, FileCheck, FileText, FileType, Image as ImageIcon, Loader2, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { KnowledgeDocument } from '@/hooks/useKnowledgeBaseContent';

const documentStatusConfig: Record<string, { icon: typeof FileCheck; color: string; label: string }> = {
  pending: { icon: Loader2, color: 'text-amber-500', label: 'Pending' },
  processing: { icon: Loader2, color: 'text-blue-500', label: 'Processing' },
  processed: { icon: FileCheck, color: 'text-green-500', label: 'Processed' },
  error: { icon: AlertCircle, color: 'text-destructive', label: 'Error' },
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (fileType === 'text/plain') {
    return <FileType className="h-5 w-5 text-muted-foreground" />;
  }
  if (fileType.includes('word') || fileType.includes('document')) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  if (fileType.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5 text-green-500" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function getFileExtension(fileType: string) {
  if (fileType === 'application/pdf') return 'PDF';
  if (fileType === 'text/plain') return 'TXT';
  if (fileType.includes('word') || fileType.includes('document')) return 'DOC';
  if (fileType === 'image/jpeg' || fileType === 'image/jpg') return 'JPG';
  if (fileType === 'image/png') return 'PNG';
  if (fileType === 'image/webp') return 'WEBP';
  if (fileType === 'image/gif') return 'GIF';
  if (fileType.startsWith('image/')) return 'IMG';
  return 'FILE';
}

interface UploadedDocumentsCardProps {
  documents: KnowledgeDocument[];
  pendingDocs: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessAll: () => void;
  onReprocess: (document: KnowledgeDocument) => void;
  onDelete: (document: KnowledgeDocument) => void;
  onViewExtractedText: (text: string) => void;
  getRelativeTime: (dateString: string) => string;
}

export function UploadedDocumentsCard({
  documents,
  pendingDocs,
  open,
  onOpenChange,
  onProcessAll,
  onReprocess,
  onDelete,
  onViewExtractedText,
  getRelativeTime,
}: UploadedDocumentsCardProps) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <Card className={open ? 'lg:col-span-2' : ''}>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-2.5 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 shrink-0">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-lg">Uploaded Documents</CardTitle>
                  <CardDescription className="text-xs sm:text-sm line-clamp-1">
                    Documents to train your AI
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {pendingDocs > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 sm:px-2.5 bg-amber-500/10 text-amber-600">
                    {pendingDocs} pending
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs px-1.5 sm:px-2.5">
                  {documents.length} file{documents.length !== 1 ? 's' : ''}
                </Badge>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {pendingDocs > 0 && (
              <div className="mb-4 p-3 border border-amber-500/20 rounded-lg bg-amber-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-muted-foreground">
                      {pendingDocs} document{pendingDocs !== 1 ? 's' : ''} pending processing
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      onProcessAll();
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Process All
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {documents.map((document) => {
                const statusConfig = documentStatusConfig[document.status] || documentStatusConfig.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        {getFileIcon(document.file_type)}
                      </div>
                      <div>
                        <p className="font-medium text-sm truncate max-w-[200px] sm:max-w-[300px]">
                          {document.file_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{getFileExtension(document.file_type)}</span>
                          <span>•</span>
                          <span>{formatFileSize(document.file_size)}</span>
                          <span>•</span>
                          <span>{getRelativeTime(document.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`gap-1 ${statusConfig.color}`}>
                        <StatusIcon className={`h-3 w-3 ${document.status === 'processing' ? 'animate-spin' : ''}`} />
                        {statusConfig.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {document.status !== 'processing' && (
                            <DropdownMenuItem onClick={() => onReprocess(document)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              {document.status === 'pending' ? 'Process Now' : 'Reprocess'}
                            </DropdownMenuItem>
                          )}
                          {document.extracted_text && (
                            <DropdownMenuItem onClick={() => onViewExtractedText(document.extracted_text!)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Extracted Text
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(document)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}