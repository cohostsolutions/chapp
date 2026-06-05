import { X, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedAttachment } from './ChatAttachmentUpload';

export interface Attachment {
  url: string;
  name: string;
  type: 'image' | 'document';
  extension: string;
}

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (index: number) => void;
  className?: string;
}

// Get file extension from URL or filename
export function getFileExtension(urlOrName: string): string {
  const match = urlOrName.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : '';
}

// Check if URL is an image
export function isImageUrl(urlOrName: string): boolean {
  const ext = getFileExtension(urlOrName);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  return imageExtensions.includes(ext);
}

// Create attachment from uploaded file info (with original name)
export function createAttachmentFromUpload(uploaded: UploadedAttachment): Attachment {
  const extension = getFileExtension(uploaded.originalName);
  const isImage = isImageUrl(uploaded.originalName);
  return {
    url: uploaded.url,
    name: uploaded.originalName,
    type: isImage ? 'image' : 'document',
    extension: extension || 'file',
  };
}

// Create attachment from URL only (legacy/fallback)
// Create attachment from URL only (legacy/fallback)
export function createAttachmentFromUrl(url: string): Attachment {
  const extension = getFileExtension(url);
  const isImage = isImageUrl(url);
  // Try to extract filename from URL - handle new folder structure
  let name = 'attachment';
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    const fullName = segments[segments.length - 1] || 'file';
    // Decode and use as-is (folder structure means filename is clean)
    name = decodeURIComponent(fullName);
  } catch {
    // Ignore URL parsing errors and fall back to default name
  }
  return {
    url,
    name,
    type: isImage ? 'image' : 'document',
    extension: extension || 'file',
  };
}

// Get icon for document type
function getDocumentIcon(extension: string) {
  switch (extension) {
    case 'pdf':
      return FileText;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return FileSpreadsheet;
    case 'doc':
    case 'docx':
    case 'txt':
      return FileText;
    case 'ppt':
    case 'pptx':
      return FileImage;
    default:
      return File;
  }
}

// Get color for document type
function getDocumentColor(extension: string): string {
  switch (extension) {
    case 'pdf':
      return 'text-red-500 bg-red-500/10';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'text-green-500 bg-green-500/10';
    case 'doc':
    case 'docx':
    case 'txt':
      return 'text-blue-500 bg-blue-500/10';
    case 'ppt':
    case 'pptx':
      return 'text-orange-500 bg-orange-500/10';
    default:
      return 'text-muted-foreground bg-muted';
  }
}

export function AttachmentPreview({ attachments, onRemove, className }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 p-2 bg-secondary/30 rounded-lg border border-border/50", className)}>
      {attachments.map((attachment, idx) => {
        if (attachment.type === 'image') {
          return (
            <div key={idx} className="relative group">
              <img
                src={attachment.url}
                alt={attachment.name}
                className="w-16 h-16 object-cover rounded-lg border border-border/50"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        }

        const IconComponent = getDocumentIcon(attachment.extension);
        const colorClass = getDocumentColor(attachment.extension);

        return (
          <div key={idx} className="relative group flex items-center gap-2 p-2 bg-background rounded-lg border border-border/50 pr-8">
            <div className={cn("p-1.5 rounded", colorClass)}>
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate max-w-[100px]">{attachment.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{attachment.extension}</p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-1.5 -right-1.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(idx)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}