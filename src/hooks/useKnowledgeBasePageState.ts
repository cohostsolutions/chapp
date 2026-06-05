import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { devError } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { knowledgeSections } from '@/components/knowledge-base/knowledgeSections';
import {
  useKnowledgeBaseSettings,
  type AIHandbackCriteria,
  type AgentTakeoverCriteria,
  type CustomLeadStatuses,
  type CustomStatus,
  type SalesProcessConfig,
} from '@/hooks/useKnowledgeBaseSettings';
import {
  type KnowledgeDocument,
  type KnowledgeEntry,
  type KnowledgeEntryInput,
} from '@/hooks/useKnowledgeBaseContent';
import { useKnowledgeBaseEntryDialog } from '@/hooks/useKnowledgeBaseEntryDialog';
import { sourcePriorityOptions, type NormalizedKnowledgeEntryPayload } from '@/components/knowledge-base/knowledgeEntryForm';

interface UseKnowledgeBasePageStateOptions {
  organizationId?: string;
  aiAgentType?: string | null;
  canManage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  entries: KnowledgeEntry[];
  documents: KnowledgeDocument[];
  processFiles: (files: File[]) => Promise<void>;
  clearUploadedFiles: () => void;
  createEntry: (entry: KnowledgeEntryInput) => Promise<void>;
  updateEntry: (entryId: string, entry: KnowledgeEntryInput) => Promise<void>;
  deleteEntry: (entry: KnowledgeEntry) => Promise<void>;
  toggleEntryStatus: (entry: KnowledgeEntry) => Promise<void>;
  deleteDocument: (document: KnowledgeDocument) => Promise<void>;
}

export function useKnowledgeBasePageState({
  organizationId,
  aiAgentType,
  canManage,
  fileInputRef,
  entries,
  documents,
  processFiles,
  clearUploadedFiles,
  createEntry,
  updateEntry,
  deleteEntry,
  toggleEntryStatus,
  deleteDocument,
}: UseKnowledgeBasePageStateOptions) {
  const { toast } = useToast();
  const {
    loadSettings,
    saveSalesProcess,
    saveCustomStatuses,
    saveTakeoverCriteria,
    saveHandbackCriteria,
  } = useKnowledgeBaseSettings({ organizationId });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'fresh' | 'stale' | 'unreviewed'>('all');
  const [sourcePriorityFilter, setSourcePriorityFilter] = useState<'all' | (typeof sourcePriorityOptions)[number]>('all');
  const [activeTab, setActiveTab] = useState('tone-personality');
  const [showDocuments, setShowDocuments] = useState(true);
  const [showChatPreview, setShowChatPreview] = useState(false);

  const [salesProcessConfig, setSalesProcessConfig] = useState<SalesProcessConfig>({
    opening: { enabled: true, message: '' },
    qualification: { enabled: true, description: '', questions: [] },
    conversion: {
      reservation: { enabled: true, description: '', required_info: [] },
      sale: { enabled: true, description: '', required_info: [] },
      order: { enabled: true, description: '', required_info: [] },
    },
    confirmation: { enabled: true, process: '' },
    after_sales: { enabled: true, follow_up: '' },
  });
  const [isSavingSalesProcess, setIsSavingSalesProcess] = useState(false);
  const [salesProcessExpanded, setSalesProcessExpanded] = useState(false);
  const [salesProcessTab, setSalesProcessTab] = useState('opening');
  const [requiredInfoText, setRequiredInfoText] = useState({
    reservation: '',
    sale: '',
    order: '',
  });
  const [qualificationQuestionsText, setQualificationQuestionsText] = useState('');

  const [customLeadStatuses, setCustomLeadStatuses] = useState<CustomLeadStatuses>({
    default_statuses: {
      new: { enabled: true, color: 'primary', order: 1 },
      contacted: { enabled: true, color: 'warning', order: 2 },
      qualified: { enabled: true, color: 'success', order: 3 },
      converted: { enabled: true, color: 'success', order: 4 },
      lost: { enabled: true, color: 'destructive', order: 5 },
    },
    custom_statuses: [],
  });
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('primary');
  const [isSavingStatuses, setIsSavingStatuses] = useState(false);
  const [statusesExpanded, setStatusesExpanded] = useState(false);

  const [takeoverCriteria, setTakeoverCriteria] = useState<AgentTakeoverCriteria>({
    enabled: false,
    criteria_prompt: '',
    examples: [
      'Customer explicitly requests to speak with a human agent',
      'Customer expresses frustration or dissatisfaction repeatedly',
      'Conversation exceeds 10 messages without resolution',
      'Customer mentions legal action or formal complaint',
      'Technical issues the AI cannot resolve',
    ],
    auto_notify_agent: true,
  });
  const [isSavingTakeover, setIsSavingTakeover] = useState(false);
  const [takeoverExpanded, setTakeoverExpanded] = useState(false);
  const [agentTakeoverMessage, setAgentTakeoverMessage] = useState(
    "I'll connect you with someone from our team who can better assist you. They'll be in touch shortly!"
  );
  const [aiHandbackMessage, setAiHandbackMessage] = useState(
    '{agent_name} is back to assist you! Feel free to continue your conversation.'
  );
  const [handbackCriteria, setHandbackCriteria] = useState<AIHandbackCriteria>({
    enabled: false,
    criteria_prompt: '',
    examples: [
      'Customer confirms their issue is resolved',
      'Customer thanks the agent and says goodbye',
      'Agent explicitly hands back to AI',
      'Conversation has been idle for a specified period',
      'Customer requests to speak with AI again',
    ],
    auto_notify: true,
  });
  const [isSavingHandback, setIsSavingHandback] = useState(false);
  const [handoffTab, setHandoffTab] = useState<'takeover' | 'handback'>('takeover');

  const {
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
  } = useKnowledgeBaseEntryDialog({
    activeTab,
    canManage,
    fileInputRef,
    clearUploadedFiles,
    processFiles,
  });

  const isJayOrg = aiAgentType === 'jay';

  const isReviewStale = useCallback((entry: KnowledgeEntry) => {
    if (!entry.reviewed_at) return true;

    const reviewedDate = new Date(entry.reviewed_at);
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - 90);

    return Number.isNaN(reviewedDate.getTime()) || reviewedDate < staleThreshold;
  }, []);

  const stats = useMemo(() => {
    const total = entries.length;
    const active = entries.filter((entry) => entry.is_active).length;
    const inactive = entries.filter((entry) => !entry.is_active).length;
    const stale = entries.filter((entry) => entry.is_active && isReviewStale(entry)).length;
    const byCategory = knowledgeSections.reduce((accumulator, section) => {
      accumulator[section.id] = entries.filter((entry) => entry.category === section.id).length;
      return accumulator;
    }, {} as Record<string, number>);

    const totalDocs = documents.length;
    const processedDocs = documents.filter((document) => document.status === 'processed').length;
    const pendingDocs = documents.filter((document) => document.status === 'pending' || document.status === 'processing').length;

    return { total, active, inactive, stale, byCategory, totalDocs, processedDocs, pendingDocs };
  }, [documents, entries, isReviewStale]);

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all' || reviewStatusFilter !== 'all' || sourcePriorityFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setReviewStatusFilter('all');
    setSourcePriorityFilter('all');
  }, []);

  const activateNeedsReview = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('active');
    setReviewStatusFilter('stale');
    setSourcePriorityFilter('all');
  }, []);

  const loadKnowledgeBaseSettings = useCallback(async () => {
    try {
      const settings = await loadSettings();
      if (!settings) {
        return;
      }

      setSalesProcessConfig(settings.salesProcessConfig);
      setRequiredInfoText({
        reservation: settings.salesProcessConfig.conversion.reservation.required_info.join(', '),
        sale: settings.salesProcessConfig.conversion.sale.required_info.join(', '),
        order: settings.salesProcessConfig.conversion.order.required_info.join(', '),
      });
      setQualificationQuestionsText(settings.salesProcessConfig.qualification.questions.join(', '));

      if (settings.customLeadStatuses) {
        setCustomLeadStatuses((currentStatuses) => ({
          default_statuses: settings.customLeadStatuses?.default_statuses || currentStatuses.default_statuses,
          custom_statuses: settings.customLeadStatuses?.custom_statuses || [],
        }));
      }

      if (settings.takeoverCriteria) {
        setTakeoverCriteria((currentCriteria) => ({
          ...currentCriteria,
          ...settings.takeoverCriteria,
          examples: settings.takeoverCriteria.examples || currentCriteria.examples,
        }));
      }

      if (typeof settings.agentTakeoverMessage === 'string') {
        setAgentTakeoverMessage(settings.agentTakeoverMessage);
      }

      if (typeof settings.aiHandbackMessage === 'string') {
        setAiHandbackMessage(settings.aiHandbackMessage);
      }

      if (settings.handbackCriteria) {
        setHandbackCriteria((currentCriteria) => ({
          ...currentCriteria,
          ...settings.handbackCriteria,
          examples: settings.handbackCriteria.examples || currentCriteria.examples,
        }));
      }
    } catch (error) {
      devError('Failed to fetch sales process config:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load knowledge base settings',
        variant: 'destructive',
      });
    }
  }, [loadSettings, toast]);

  useEffect(() => {
    void loadKnowledgeBaseSettings();
  }, [loadKnowledgeBaseSettings]);

  const handleSaveSalesProcess = async () => {
    setIsSavingSalesProcess(true);
    try {
      const normalizedConfig = await saveSalesProcess(salesProcessConfig);
      setSalesProcessConfig(normalizedConfig);
    } catch (error) {
      devError('Failed to save sales process config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save sales process configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSalesProcess(false);
    }
  };

  const updateSalesProcessField = <
    Section extends keyof SalesProcessConfig,
    Key extends keyof SalesProcessConfig[Section]
  >(
    section: Section,
    field: Key,
    value: SalesProcessConfig[Section][Key]
  ) => {
    setSalesProcessConfig((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  const updateConversionField = <
    Step extends keyof SalesProcessConfig['conversion'],
    Key extends keyof SalesProcessConfig['conversion'][Step]
  >(
    type: Step,
    field: Key,
    value: SalesProcessConfig['conversion'][Step][Key]
  ) => {
    setSalesProcessConfig((current) => ({
      ...current,
      conversion: {
        ...current.conversion,
        [type]: {
          ...current.conversion[type],
          [field]: value,
        },
      },
    }));
  };

  const handleSaveCustomStatuses = async () => {
    setIsSavingStatuses(true);
    try {
      await saveCustomStatuses(customLeadStatuses);
    } catch (error) {
      devError('Failed to save custom statuses:', error);
      toast({
        title: 'Error',
        description: 'Failed to save lead statuses',
        variant: 'destructive',
      });
    } finally {
      setIsSavingStatuses(false);
    }
  };

  const handleAddCustomStatus = () => {
    if (!newStatusName.trim()) return;

    const normalizedName = newStatusName.trim().toLowerCase().replace(/\s+/g, '_');
    const duplicateDefault = normalizedName in customLeadStatuses.default_statuses;
    const duplicateCustom = customLeadStatuses.custom_statuses.some((status) => status.name === normalizedName);

    if (duplicateDefault || duplicateCustom) {
      toast({
        title: 'Duplicate status',
        description: 'A status with this name already exists.',
        variant: 'destructive',
      });
      return;
    }

    const newStatus: CustomStatus = {
      id: `custom_${Date.now()}`,
      name: normalizedName,
      color: newStatusColor,
      order: Object.keys(customLeadStatuses.default_statuses).length + customLeadStatuses.custom_statuses.length + 1,
    };

    setCustomLeadStatuses((current) => ({
      ...current,
      custom_statuses: [...current.custom_statuses, newStatus],
    }));
    setNewStatusName('');
  };

  const handleRemoveCustomStatus = (id: string) => {
    setCustomLeadStatuses((current) => ({
      ...current,
      custom_statuses: current.custom_statuses.filter((status) => status.id !== id),
    }));
  };

  const handleToggleDefaultStatus = (status: string, enabled: boolean) => {
    setCustomLeadStatuses((current) => ({
      ...current,
      default_statuses: {
        ...current.default_statuses,
        [status]: {
          ...current.default_statuses[status],
          enabled,
        },
      },
    }));
  };

  const handleSaveTakeoverCriteria = async () => {
    setIsSavingTakeover(true);
    try {
      await saveTakeoverCriteria({
        takeoverCriteria,
        agentTakeoverMessage,
        aiHandbackMessage,
      });
    } catch (error) {
      devError('Failed to save takeover criteria:', error);
      toast({
        title: 'Error',
        description: 'Failed to save takeover configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSavingTakeover(false);
    }
  };

  const handleSaveHandbackCriteria = async () => {
    setIsSavingHandback(true);
    try {
      await saveHandbackCriteria({
        handbackCriteria,
        aiHandbackMessage,
      });
    } catch (error) {
      devError('Failed to save handback criteria:', error);
      toast({
        title: 'Error',
        description: 'Failed to save handback configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSavingHandback(false);
    }
  };

  const handleSubmitEntry = async (payload: NormalizedKnowledgeEntryPayload) => {
    if (!canManage) {
      toast({
        title: 'Insufficient permissions',
        description: 'Only admins can manage knowledge entries.',
        variant: 'destructive',
      });
      throw new Error('Insufficient permissions');
    }

    try {
      if (editingEntry) {
        await updateEntry(editingEntry.id, {
          title: payload.title,
          content: payload.content,
          category: payload.category || null,
          tags: payload.tags || null,
          source_priority: payload.source_priority,
          owner_name: payload.owner_name,
          is_active: payload.is_active,
          reviewed_at: payload.reviewed_at,
          reviewed_by_name: payload.reviewed_by_name,
        });
      } else {
        await createEntry({
          title: payload.title,
          content: payload.content,
          category: payload.category || null,
          tags: payload.tags || null,
          source_priority: payload.source_priority,
          owner_name: payload.owner_name,
          is_active: payload.is_active,
          reviewed_at: payload.reviewed_at,
          reviewed_by_name: payload.reviewed_by_name,
        });
      }

      setShowEntryDialog(false);
      setEditingEntry(null);
      resetEntryForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error
          ? error.message
          : editingEntry
            ? 'Failed to update entry'
            : 'Failed to create entry',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('Knowledge entry submission failed');
    }
  };

  const handleDeleteEntry = async (entry: KnowledgeEntry) => {
    if (!canManage) {
      toast({
        title: 'Insufficient permissions',
        description: 'Only admins can delete knowledge entries.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Delete "${entry.title}"?`)) return;

    try {
      await deleteEntry(entry);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete entry',
        variant: 'destructive',
      });
    }
  };

  const handleToggleEntryStatus = async (entry: KnowledgeEntry) => {
    if (!canManage) return;

    try {
      await toggleEntryStatus(entry);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update entry status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDocument = async (document: KnowledgeDocument) => {
    if (!canManage) return;

    if (!confirm(`Delete document "${document.file_name}"?`)) return;

    try {
      await deleteDocument(document);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesSearch = !normalizedQuery
        || entry.title.toLowerCase().includes(normalizedQuery)
        || entry.content.toLowerCase().includes(normalizedQuery)
        || entry.category?.toLowerCase().includes(normalizedQuery)
        || entry.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && entry.is_active)
        || (statusFilter === 'inactive' && !entry.is_active);
      const matchesReviewStatus = reviewStatusFilter === 'all'
        || (reviewStatusFilter === 'unreviewed' && !entry.reviewed_at)
        || (reviewStatusFilter === 'stale' && isReviewStale(entry))
        || (reviewStatusFilter === 'fresh' && Boolean(entry.reviewed_at) && !isReviewStale(entry));
      const matchesSourcePriority = sourcePriorityFilter === 'all' || entry.source_priority === sourcePriorityFilter;

      return matchesSearch && matchesStatus && matchesReviewStatus && matchesSourcePriority;
    }).sort((left, right) => {
      const reviewWorkflowActive = reviewStatusFilter !== 'all';
      if (reviewWorkflowActive) {
        const leftUnreviewed = !left.reviewed_at;
        const rightUnreviewed = !right.reviewed_at;

        if (leftUnreviewed !== rightUnreviewed) {
          return leftUnreviewed ? -1 : 1;
        }

        const leftStale = isReviewStale(left);
        const rightStale = isReviewStale(right);

        if (leftStale !== rightStale) {
          return leftStale ? -1 : 1;
        }
      }

      const priorityWeight: Record<(typeof sourcePriorityOptions)[number], number> = {
        canonical: 0,
        supporting: 1,
        reference: 2,
      };
      const leftPriority = priorityWeight[left.source_priority || 'canonical'];
      const rightPriority = priorityWeight[right.source_priority || 'canonical'];

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  }, [entries, searchQuery, statusFilter, reviewStatusFilter, sourcePriorityFilter, isReviewStale]);

  const handleActiveTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedCategory(value as typeof selectedCategory);
  };

  const handleAddEntryForCategory = (category: string) => {
    openCreateDialog(category);
  };

  const handleViewExtractedText = (text: string) => {
    toast({
      title: 'Extracted Content',
      description: `${text.substring(0, 200)}...`,
    });
  };

  return {
    activeTab,
    setActiveTab: handleActiveTabChange,
    showDocuments,
    setShowDocuments,
    showChatPreview,
    setShowChatPreview,
    isJayOrg,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    reviewStatusFilter,
    setReviewStatusFilter,
    sourcePriorityFilter,
    setSourcePriorityFilter,
    hasActiveFilters,
    clearFilters,
    activateNeedsReview,
    stats,
    filteredEntries,
    salesProcessConfig,
    isSavingSalesProcess,
    salesProcessExpanded,
    setSalesProcessExpanded,
    salesProcessTab,
    setSalesProcessTab,
    requiredInfoText,
    setRequiredInfoText,
    qualificationQuestionsText,
    setQualificationQuestionsText,
    customLeadStatuses,
    newStatusName,
    setNewStatusName,
    newStatusColor,
    setNewStatusColor,
    isSavingStatuses,
    statusesExpanded,
    setStatusesExpanded,
    takeoverCriteria,
    setTakeoverCriteria,
    isSavingTakeover,
    takeoverExpanded,
    setTakeoverExpanded,
    agentTakeoverMessage,
    setAgentTakeoverMessage,
    aiHandbackMessage,
    setAiHandbackMessage,
    handbackCriteria,
    setHandbackCriteria,
    isSavingHandback,
    handoffTab,
    setHandoffTab,
    showEntryDialog,
    setShowEntryDialog,
    editingEntry,
    selectedCategory,
    isDragging,
    openEditDialog,
    resetEntryForm,
    handleFileUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSaveSalesProcess,
    updateSalesProcessField,
    updateConversionField,
    handleSaveCustomStatuses,
    handleAddCustomStatus,
    handleRemoveCustomStatus,
    handleToggleDefaultStatus,
    handleSaveTakeoverCriteria,
    handleSaveHandbackCriteria,
    handleSubmitEntry,
    handleDeleteEntry,
    handleToggleEntryStatus,
    handleDeleteDocument,
    handleAddEntryForCategory,
    handleViewExtractedText,
  };
}