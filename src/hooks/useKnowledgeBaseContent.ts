import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function normalizeKnowledgeBaseError(error: unknown, action: 'fetch' | 'create' | 'update' | 'delete' | 'upload') {
  const fallbackMap = {
    fetch: 'Failed to fetch knowledge base',
    create: 'Failed to create entry',
    update: 'Failed to update entry',
    delete: 'Failed to delete knowledge base item',
    upload: 'Failed to upload knowledge base file',
  } as const;

  const fallback = fallbackMap[action];

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const maybeError = error as { message?: unknown; code?: unknown; hint?: unknown; details?: unknown };
  const message = typeof maybeError.message === 'string' ? maybeError.message : '';
  const code = typeof maybeError.code === 'string' ? maybeError.code : '';
  const hint = typeof maybeError.hint === 'string' ? maybeError.hint : '';
  const details = typeof maybeError.details === 'string' ? maybeError.details : '';
  const combined = [message, hint, details].filter(Boolean).join(' ');

  const isPermissionIssue = code === '42501'
    || /permission denied|new row violates row-level security policy|row-level security/i.test(combined);

  if (isPermissionIssue) {
    return action === 'fetch'
      ? 'Knowledge base access is blocked by database permissions or policy rules. Apply the latest knowledge base grants and policy migrations, then refresh.'
      : 'Knowledge base write access is blocked by database permissions or policy rules. Apply the latest knowledge base grants and policy migrations, then try again.';
  }

  return message || fallback;
}

export interface KnowledgeEntry {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  source_priority: 'canonical' | 'supporting' | 'reference';
  owner_name: string | null;
  is_active: boolean;
  created_by: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  organization_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  status: string;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntryInput {
  title: string;
  content: string;
  category: string | null;
  tags: string | null;
  source_priority: 'canonical' | 'supporting' | 'reference';
  owner_name: string | null;
  is_active: boolean;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
}

interface UseKnowledgeBaseContentOptions {
  organizationId?: string;
  userId?: string;
}

export function useKnowledgeBaseContent({ organizationId, userId }: UseKnowledgeBaseContentOptions) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; type: string }[]>([]);

  const fetchData = useCallback(async (targetOrganizationId = organizationId) => {
    if (!targetOrganizationId) {
      setEntries([]);
      setDocuments([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const [entriesRes, docsRes] = await Promise.all([
        supabase
          .from('knowledge_base_entries')
          .select('*')
          .eq('organization_id', targetOrganizationId)
          .order('created_at', { ascending: false }),
        supabase
          .from('knowledge_base_documents')
          .select('*')
          .eq('organization_id', targetOrganizationId)
          .order('created_at', { ascending: false }),
      ]);

      if (entriesRes.error) {
        throw entriesRes.error;
      }

      if (docsRes.error) {
        throw docsRes.error;
      }

      setEntries(entriesRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: normalizeKnowledgeBaseError(error, 'fetch'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const channel = supabase
      .channel(`knowledge-base-content-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_base_entries',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void fetchData(organizationId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_base_documents',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void fetchData(organizationId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, organizationId]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    toast({
      title: 'Refreshed',
      description: 'Knowledge base data updated',
    });
  }, [fetchData, toast]);

  const parseTags = (tags: string | null) => {
    if (!tags) {
      return null;
    }

    return Array.from(new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean)));
  };

  const createEntry = useCallback(async (entry: KnowledgeEntryInput) => {
    if (!organizationId) {
      throw new Error('Organization not found. Please refresh and try again.');
    }

    const { error } = await supabase
      .from('knowledge_base_entries')
      .insert({
        organization_id: organizationId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: parseTags(entry.tags),
        source_priority: entry.source_priority,
        owner_name: entry.owner_name,
        is_active: entry.is_active,
        created_by: userId,
        reviewed_at: entry.reviewed_at,
        reviewed_by_name: entry.reviewed_by_name,
      });

    if (error) {
      throw new Error(normalizeKnowledgeBaseError(error, 'create'));
    }

    toast({
      title: 'Success',
      description: 'Knowledge entry created',
    });

    await fetchData();
  }, [fetchData, organizationId, toast, userId]);

  const updateEntry = useCallback(async (entryId: string, entry: KnowledgeEntryInput) => {
    const { error } = await supabase
      .from('knowledge_base_entries')
      .update({
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: parseTags(entry.tags),
        source_priority: entry.source_priority,
        owner_name: entry.owner_name,
        is_active: entry.is_active,
        reviewed_at: entry.reviewed_at,
        reviewed_by_name: entry.reviewed_by_name,
      })
      .eq('id', entryId);

    if (error) {
      throw new Error(normalizeKnowledgeBaseError(error, 'update'));
    }

    toast({
      title: 'Success',
      description: 'Knowledge entry updated',
    });

    await fetchData();
  }, [fetchData, toast]);

  const deleteEntry = useCallback(async (entry: KnowledgeEntry) => {
    const { error } = await supabase
      .from('knowledge_base_entries')
      .delete()
      .eq('id', entry.id);

    if (error) {
      throw new Error(normalizeKnowledgeBaseError(error, 'delete'));
    }

    toast({
      title: 'Success',
      description: 'Entry deleted',
    });

    await fetchData();
  }, [fetchData, toast]);

  const toggleEntryStatus = useCallback(async (entry: KnowledgeEntry) => {
    const nextIsActive = !entry.is_active;
    const { error } = await supabase
      .from('knowledge_base_entries')
      .update({ is_active: nextIsActive })
      .eq('id', entry.id);

    if (error) {
      throw new Error(normalizeKnowledgeBaseError(error, 'delete'));
    }

    setEntries((currentEntries) => currentEntries.map((currentEntry) => (
      currentEntry.id === entry.id
        ? { ...currentEntry, is_active: nextIsActive }
        : currentEntry
    )));

    toast({
      title: 'Success',
      description: `Entry ${entry.is_active ? 'deactivated' : 'activated'}`,
    });
  }, [toast]);

  const triggerDocumentProcessing = useCallback(async (documentId: string) => {
    try {
      const { error } = await supabase.functions.invoke('process-document', {
        body: { documentId },
      });

      if (error) {
        await supabase
          .from('knowledge_base_documents')
          .update({ status: 'error' })
          .eq('id', documentId);
      }
    } catch {
      await supabase
        .from('knowledge_base_documents')
        .update({ status: 'error' })
        .eq('id', documentId);
    }
  }, []);

  const reprocessDocument = useCallback(async (document: KnowledgeDocument) => {
    await supabase
      .from('knowledge_base_documents')
      .update({ status: 'processing' })
      .eq('id', document.id);

    await fetchData();
    await triggerDocumentProcessing(document.id);

    toast({
      title: 'Processing started',
      description: `Processing "${document.file_name}"...`,
    });
  }, [fetchData, toast, triggerDocumentProcessing]);

  const processAllPendingDocuments = useCallback(async () => {
    const pendingDocuments = documents.filter((document) => document.status === 'pending');

    if (pendingDocuments.length === 0) {
      toast({
        title: 'No pending documents',
        description: 'All documents are already processed.',
      });
      return;
    }

    toast({
      title: 'Processing started',
      description: `Processing ${pendingDocuments.length} document(s)...`,
    });

    for (const document of pendingDocuments) {
      await supabase
        .from('knowledge_base_documents')
        .update({ status: 'processing' })
        .eq('id', document.id);
    }

    await fetchData();

    for (const document of pendingDocuments) {
      await triggerDocumentProcessing(document.id);
    }
  }, [documents, fetchData, toast, triggerDocumentProcessing]);

  const deleteDocument = useCallback(async (document: KnowledgeDocument) => {
    const { error: storageError } = await supabase.storage
      .from('knowledge-base')
      .remove([document.file_path]);

    if (storageError) {
      throw storageError;
    }

    const { error } = await supabase
      .from('knowledge_base_documents')
      .delete()
      .eq('id', document.id);

    if (error) {
      throw error;
    }

    setDocuments((currentDocuments) => currentDocuments.filter((currentDocument) => currentDocument.id !== document.id));

    toast({
      title: 'Success',
      description: 'Document deleted',
    });
  }, [toast]);

  const processFiles = useCallback(async (files: File[]) => {
    if (!organizationId) {
      throw new Error('Organization not found. Please refresh the page.');
    }

    const allowedDocTypes = new Set([
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ]);
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    const isAllowedFile = (file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (allowedDocTypes.has(file.type)) {
        return true;
      }
      if (['pdf', 'txt', 'doc', 'docx'].includes(extension)) {
        return true;
      }
      if (allowedImageTypes.includes(file.type)) {
        return true;
      }
      return file.type.startsWith('image/');
    };

    const validFiles = files.filter((file) => {
      const isAllowed = isAllowedFile(file);
      if (!isAllowed) {
        toast({
          title: 'Invalid file type',
          description: `"${file.name}" is not supported. Please upload PDF, TXT, DOC, DOCX, or image files (JPG, PNG, WebP, GIF).`,
          variant: 'destructive',
        });
      }
      return isAllowed;
    });

    if (validFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const progressPerFile = 100 / validFiles.length;
    let currentProgress = 0;
    let successfulUploads = 0;

    for (const file of validFiles) {
      try {
        const filePath = `${organizationId}/${crypto.randomUUID()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('knowledge-base')
          .upload(filePath, file);

        if (uploadError) {
          toast({
            title: 'Upload failed',
            description: `Failed to upload "${file.name}": ${uploadError.message}`,
            variant: 'destructive',
          });
          continue;
        }

        const { data: documentData, error: databaseError } = await supabase
          .from('knowledge_base_documents')
          .insert({
            organization_id: organizationId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            status: 'pending',
            created_by: userId,
          })
          .select('id')
          .single();

        if (databaseError) {
          await supabase.storage.from('knowledge-base').remove([filePath]);
          toast({
            title: 'Upload failed',
            description: `Failed to save "${file.name}" metadata: ${databaseError.message}`,
            variant: 'destructive',
          });
          continue;
        }

        if (documentData?.id) {
          void triggerDocumentProcessing(documentData.id);
        }

        setUploadedFiles((currentFiles) => [...currentFiles, { name: file.name, size: file.size, type: file.type }]);
        successfulUploads += 1;
        currentProgress += progressPerFile;
        setUploadProgress(Math.min(currentProgress, 100));
      } catch {
        toast({
          title: 'Error',
          description: `Failed to upload "${file.name}"`,
          variant: 'destructive',
        });
      }
    }

    if (successfulUploads > 0) {
      toast({
        title: 'Success',
        description: `${successfulUploads} file(s) uploaded successfully`,
      });
      await fetchData();
    }

    setIsUploading(false);
    setUploadProgress(0);
  }, [fetchData, organizationId, toast, triggerDocumentProcessing, userId]);

  const removeUploadedFile = useCallback((index: number) => {
    setUploadedFiles((currentFiles) => currentFiles.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const clearUploadedFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  return {
    entries,
    documents,
    isLoading,
    isRefreshing,
    isUploading,
    uploadProgress,
    uploadedFiles,
    fetchData,
    refresh,
    createEntry,
    updateEntry,
    deleteEntry,
    toggleEntryStatus,
    processAllPendingDocuments,
    triggerDocumentProcessing,
    reprocessDocument,
    deleteDocument,
    processFiles,
    removeUploadedFile,
    clearUploadedFiles,
  };
}
