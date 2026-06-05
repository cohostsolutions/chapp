import { useState, useRef } from 'react';
import { devError } from '@/lib/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, Save, Paperclip, X, FileText, Image } from 'lucide-react';
import { useMessageTemplates, useCreateMessageTemplate, useUpdateMessageTemplate, useDeleteMessageTemplate } from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TemplateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

const channelOptions = [
  { value: 'all', label: 'All Channels' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'email', label: 'Email' },
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB for templates

export function TemplateManagerDialog({ open, onOpenChange, organizationId }: TemplateManagerDialogProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [channel, setChannel] = useState('all');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templates, isLoading } = useMessageTemplates(organizationId);
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const resetForm = () => {
    setName('');
    setContent('');
    setChannel('all');
    setAttachmentUrl(null);
    setAttachmentName(null);
    setEditingId(null);
    setIsEditing(false);
  };

  const handleEdit = (template: { id: string; name: string; content: string; channel: string; attachment_url?: string | null; attachment_name?: string | null }) => {
    setEditingId(template.id);
    setName(template.name);
    setContent(template.content);
    setChannel(template.channel);
    setAttachmentUrl(template.attachment_url || null);
    setAttachmentName(template.attachment_name || null);
    setIsEditing(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ title: 'File must be under 10MB', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const folderName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const safeOriginalName = file.name
        .replace(/[\\/]/g, '-')
        .replace(/[^a-zA-Z0-9 .()_-]/g, '_')
        .slice(0, 120);
      const filePath = `template-attachments/${folderName}/${safeOriginalName}`;

      const { error: uploadError } = await supabase.storage
        .from('communications')
        .upload(filePath, file, { contentType: file.type || undefined });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('communications')
        .getPublicUrl(filePath);

      setAttachmentUrl(urlData.publicUrl);
      setAttachmentName(file.name);
      toast({ title: 'File attached successfully' });
    } catch (error: unknown) {
      devError('Template attachment upload error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Failed to upload file', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName(null);
  };

  const isImageAttachment = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await updateTemplate.mutateAsync({
          id: editingId,
          name: name.trim(),
          content: content.trim(),
          channel,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        });
      } else {
        await createTemplate.mutateAsync({
          organization_id: organizationId,
          name: name.trim(),
          content: content.trim(),
          channel,
          is_active: true,
          created_by: null,
          subject: null,
          variables: null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        });
      }
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string, templateName: string) => {
    try {
      await deleteTemplate.mutateAsync({ id, name: templateName });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Reply Templates</DialogTitle>
          <DialogDescription>
            Create and manage reusable message templates. Use {'{{name}}'}, {'{{email}}'}, {'{{phone}}'} as variables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="template-name" className="text-xs">Template Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Welcome Message"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="template-channel" className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="template-content" className="text-xs">Message Content</Label>
              <Textarea
                id="template-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Hi {{name}}, thanks for reaching out!"
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Attachment Upload */}
            <div>
              <Label className="text-xs">Attachment (optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              {attachmentUrl ? (
                <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-background">
                  {isImageAttachment(attachmentUrl) ? (
                    <Image className="h-4 w-4 text-blue-500 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                  )}
                  <span className="text-xs truncate flex-1">{attachmentName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={removeAttachment}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-1 h-8"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? 'Uploading...' : 'Attach Image or Document'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending} size="sm" className="flex-1">
                {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {editingId ? 'Update' : 'Create'} Template
              </Button>
              {isEditing && (
                <Button onClick={resetForm} variant="outline" size="sm">
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Template List */}
          <ScrollArea className="h-[200px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{template.name}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                            {template.channel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(template)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(template.id, template.name)}
                          disabled={deleteTemplate.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No templates yet</p>
                <p className="text-xs">Create your first template above</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
