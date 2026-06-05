import { useRef, useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';

export interface UploadedAttachment {
  url: string;
  originalName: string;
}

interface ChatAttachmentUploadProps {
  onAttachmentSelect: (attachments: UploadedAttachment[]) => void;
  disabled?: boolean;
  pendingCount?: number; // Show how many files are pending
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export function ChatAttachmentUpload({ onAttachmentSelect, disabled, pendingCount = 0 }: ChatAttachmentUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles file selection and upload to Supabase storage.
   * Validates file size, uploads to storage bucket, and returns public URLs.
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedAttachments: Array<{ url: string; originalName: string }> = [];

    try {
      // Generate a unique folder name for this batch
      const folderName = crypto.randomUUID();
      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast({ title: `${file.name} must be under 20MB`, variant: 'destructive' });
          continue;
        }
        validFiles.push(file);
      }

      for (const file of validFiles) {
        // Sanitize file name
        const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `chat-attachments/${folderName}/${safeOriginalName}`;

        const { error: uploadError } = await supabase.storage
          .from('communications')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          toast({ title: `Failed to upload ${file.name}`, description: uploadError.message, variant: 'destructive' });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('communications')
          .getPublicUrl(filePath);

        uploadedAttachments.push({ url: urlData.publicUrl, originalName: file.name });
      }

      if (uploadedAttachments.length > 0) {
        onAttachmentSelect(uploadedAttachments);
        toast({ title: `${uploadedAttachments.length} file(s) added. Tap again to add more.` });
      }
    } catch (error: unknown) {
      devLog('Attachment upload error:', error);
      const message = error instanceof Error ? error.message : 'Please try again';
      toast({
        title: 'Failed to upload attachments',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        title="Attach images or documents (tap multiple times to add more)"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
      {pendingCount > 0 && !uploading && (
        <Badge 
          variant="default" 
          className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary"
        >
          {pendingCount}
        </Badge>
      )}
    </div>
  );
}
