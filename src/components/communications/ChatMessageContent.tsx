import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { FileText, FileSpreadsheet, FileImage, File, Download } from 'lucide-react';

interface ChatMessageContentProps {
  content: string;
  isUser?: boolean;
  metadata?: Record<string, unknown> | null;
}

interface ExtractedFile {
  url: string;
  name: string;
  type: 'image' | 'document';
  extension: string;
}

// Get file extension from URL
function getFileExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : '';
}

// Get filename from URL
function getFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    const fullName = segments[segments.length - 1] || 'file';
    // Remove the random ID prefix if present (e.g., chat-1234567890-abc123.pdf -> file.pdf)
    const cleaned = fullName.replace(/^chat-\d+-[a-z0-9]+\./, 'attachment.');
    return decodeURIComponent(cleaned);
  } catch {
    return 'attachment';
  }
}

// Check if URL is an image
function isImageUrl(url: string): boolean {
  const ext = getFileExtension(url);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  return imageExtensions.includes(ext);
}

// Check if URL is a document
function isDocumentUrl(url: string): boolean {
  const ext = getFileExtension(url);
  const docExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
  return docExtensions.includes(ext);
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

// Extract files from message content and metadata
function extractFilesFromContent(content: string, metadata?: Record<string, unknown> | null): { text: string; files: ExtractedFile[] } {
  const files: ExtractedFile[] = [];
  const processedUrls = new Set<string>();
  
  // Check metadata for image_urls (from webhook)
  if (metadata && typeof metadata === 'object') {
    if (Array.isArray(metadata.image_urls)) {
      for (const url of metadata.image_urls as string[]) {
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          files.push({
            url,
            name: getFileName(url),
            type: 'image',
            extension: getFileExtension(url),
          });
        }
      }
    }
  }
  
  // First, strip out all [FILE:...] and [IMAGE:...] markers and collect them
  let cleanedContent = content;
  
  // Extract [FILE:url|filename] markers (new format with original filename)
  const fileMarkerRegex = /\[FILE:(https?:\/\/[^\]|]+)\|([^\]]+)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = fileMarkerRegex.exec(content)) !== null) {
    const url = match[1];
    const filename = match[2];
    if (!processedUrls.has(url)) {
      processedUrls.add(url);
      const ext = getFileExtension(filename);
      files.push({
        url,
        name: filename,
        type: isImageUrl(filename) ? 'image' : 'document',
        extension: ext,
      });
    }
  }
  // Remove [FILE:...] markers from content
  cleanedContent = cleanedContent.replace(fileMarkerRegex, '');
  
  // Extract [IMAGE: url] markers (legacy format)
  const imageMarkerRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
  while ((match = imageMarkerRegex.exec(content)) !== null) {
    if (!processedUrls.has(match[1])) {
      processedUrls.add(match[1]);
      files.push({
        url: match[1],
        name: getFileName(match[1]),
        type: 'image',
        extension: getFileExtension(match[1]),
      });
    }
  }
  // Remove [IMAGE:...] markers from content
  cleanedContent = cleanedContent.replace(imageMarkerRegex, '');
  
  // Now extract standalone URLs from the CLEANED content (markers already removed)
  const urlRegex = /https?:\/\/[^\s)\]]+/gi;
  while ((match = urlRegex.exec(cleanedContent)) !== null) {
    const url = match[0];
    if (!processedUrls.has(url)) {
      if (isImageUrl(url)) {
        processedUrls.add(url);
        files.push({
          url,
          name: getFileName(url),
          type: 'image',
          extension: getFileExtension(url),
        });
      } else if (isDocumentUrl(url)) {
        processedUrls.add(url);
        files.push({
          url,
          name: getFileName(url),
          type: 'document',
          extension: getFileExtension(url),
        });
      } else if (url.includes('/storage/v1/object/public/')) {
        // Supabase storage URL - determine type from extension or default to document
        processedUrls.add(url);
        const ext = getFileExtension(url);
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        files.push({
          url,
          name: getFileName(url),
          type: isImage ? 'image' : 'document',
          extension: ext || 'file',
        });
      }
    }
  }
  
  // Clean text: remove URLs that were captured as files
  let text = cleanedContent;
  for (const file of files) {
    text = text.split(file.url).join('');
  }
  // Remove "[Image sent]", "[image sent]", "Image sent", etc.
  text = text.replace(/\[?\s*image\s*sent\s*\]?/gi, '');
  text = text.replace(/\s{2,}/g, ' ').trim();
  
  return { text, files };
}

export function ChatMessageContent({ content, isUser = false, metadata }: ChatMessageContentProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const { text, files } = extractFilesFromContent(content, metadata);
  const imageFiles = files.filter(f => f.type === 'image');
  const documentFiles = files.filter(f => f.type === 'document');
  
  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  
  return (
    <>
      {/* Text content - whitespace-pre-wrap preserves line breaks and paragraphs */}
      {text && (
        <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
      )}
      
      {/* Image thumbnails */}
      {imageFiles.length > 0 && (
        <div className={cn(
          "flex flex-wrap gap-2",
          text ? "mt-2" : "mt-0"
        )}>
          {imageFiles.map((file, idx) => (
            <button
              key={idx}
              onClick={() => handleImageClick(idx)}
              className="relative overflow-hidden rounded-xl border border-border/50 shadow-md transition-all hover:opacity-90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-secondary/30"
            >
              <img
                src={file.url}
                alt={file.name}
                className={cn(
                  "object-cover rounded-xl",
                  imageFiles.length === 1 
                    ? "max-w-[240px] max-h-[240px] min-w-[120px] min-h-[80px]" 
                    : "w-24 h-24 sm:w-28 sm:h-28"
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Document thumbnails */}
      {documentFiles.length > 0 && (
        <div className={cn(
          "flex flex-wrap gap-2",
          (text || imageFiles.length > 0) ? "mt-2" : "mt-0"
        )}>
          {documentFiles.map((file, idx) => {
            const IconComponent = getDocumentIcon(file.extension);
            const colorClass = getDocumentColor(file.extension);
            
            return (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-secondary/30 shadow-md hover:shadow-lg hover:bg-secondary/50 transition-all group max-w-[260px]"
              >
                <div className={cn("p-2.5 rounded-lg", colorClass)}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{file.extension}</p>
                </div>
                <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            );
          })}
        </div>
      )}
      
      {/* Lightbox for viewing full images */}
      <ImageLightbox
        src={imageFiles[lightboxIndex]?.url || ''}
        alt={imageFiles[lightboxIndex]?.name || 'Image'}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={imageFiles.map((f) => ({ src: f.url, alt: f.name }))}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
