import { File, FileText, FileType, Image as ImageIcon } from 'lucide-react';

export function formatKnowledgeBaseFileSize(bytes: number | null) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getKnowledgeBaseFileIcon(fileType: string) {
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

export function getKnowledgeBaseFileExtension(fileType: string) {
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