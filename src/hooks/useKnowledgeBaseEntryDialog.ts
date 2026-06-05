import { useCallback, useState, type ChangeEvent, type DragEvent, type RefObject } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { KnowledgeEntry } from '@/hooks/useKnowledgeBaseContent';
import { knowledgeSectionIds, type KnowledgeSectionId } from '@/components/knowledge-base/knowledgeEntryForm';

interface UseKnowledgeBaseEntryDialogOptions {
  activeTab: string;
  canManage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  clearUploadedFiles: () => void;
  processFiles: (files: File[]) => Promise<void>;
}

export function useKnowledgeBaseEntryDialog({
  activeTab,
  canManage,
  fileInputRef,
  clearUploadedFiles,
  processFiles,
}: UseKnowledgeBaseEntryDialogOptions) {
  const { toast } = useToast();
  const resolveCategory = useCallback((value: string): KnowledgeSectionId => {
    return knowledgeSectionIds.includes(value as KnowledgeSectionId)
      ? (value as KnowledgeSectionId)
      : 'tone-personality';
  }, []);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeSectionId>(resolveCategory(activeTab));
  const [isDragging, setIsDragging] = useState(false);

  const resetEntryForm = useCallback(() => {
    setEditingEntry(null);
    setSelectedCategory(resolveCategory(activeTab));
    clearUploadedFiles();
  }, [activeTab, clearUploadedFiles, resolveCategory]);

  const openEditDialog = useCallback((entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setSelectedCategory(resolveCategory(entry.category || activeTab));
    setShowEntryDialog(true);
  }, [activeTab, resolveCategory]);

  const openCreateDialog = useCallback((category?: string) => {
    setEditingEntry(null);
    setSelectedCategory(resolveCategory(category || activeTab));
    setShowEntryDialog(true);
  }, [activeTab, resolveCategory]);

  const handleProcessFiles = useCallback(async (files: File[]) => {
    if (!canManage) {
      toast({
        title: 'Insufficient permissions',
        description: 'Only admins can upload documents.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await processFiles(files);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [canManage, fileInputRef, processFiles, toast]);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await handleProcessFiles(Array.from(files));
  }, [handleProcessFiles]);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      await handleProcessFiles(Array.from(files));
    }
  }, [handleProcessFiles]);

  return {
    showEntryDialog,
    setShowEntryDialog,
    editingEntry,
    setEditingEntry,
    selectedCategory,
    setSelectedCategory,
    isDragging,
    openEditDialog,
    openCreateDialog,
    resetEntryForm,
    handleFileUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}