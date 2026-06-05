import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useKnowledgeBasePageState } from '@/hooks/useKnowledgeBasePageState';
import type { KnowledgeDocument, KnowledgeEntry, KnowledgeEntryInput } from '@/hooks/useKnowledgeBaseContent';

const toastMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/logger', () => ({
  devError: vi.fn(),
}));

vi.mock('@/hooks/useKnowledgeBaseSettings', () => ({
  useKnowledgeBaseSettings: () => ({
    loadSettings: vi.fn().mockResolvedValue(null),
    saveSalesProcess: vi.fn().mockResolvedValue({
      opening: { enabled: true, message: '' },
      qualification: { enabled: true, description: '', questions: [] },
      conversion: {
        reservation: { enabled: true, description: '', required_info: [] },
        sale: { enabled: true, description: '', required_info: [] },
        order: { enabled: true, description: '', required_info: [] },
      },
      confirmation: { enabled: true, process: '' },
      after_sales: { enabled: true, follow_up: '' },
    }),
    saveCustomStatuses: vi.fn().mockResolvedValue(undefined),
    saveTakeoverCriteria: vi.fn().mockResolvedValue(undefined),
    saveHandbackCriteria: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useKnowledgeBaseEntryDialog', () => ({
  useKnowledgeBaseEntryDialog: () => ({
    showEntryDialog: false,
    setShowEntryDialog: vi.fn(),
    editingEntry: null,
    setEditingEntry: vi.fn(),
    selectedCategory: 'tone-personality',
    setSelectedCategory: vi.fn(),
    isDragging: false,
    openEditDialog: vi.fn(),
    openCreateDialog: vi.fn(),
    resetEntryForm: vi.fn(),
    handleFileUpload: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
  }),
}));

const baseOptions = {
  organizationId: 'org-1',
  aiAgentType: 'cece',
  canManage: true,
  fileInputRef: { current: null },
  entries: [] as KnowledgeEntry[],
  documents: [] as KnowledgeDocument[],
  processFiles: async (_files: File[]) => {},
  clearUploadedFiles: vi.fn(),
  createEntry: async (_entry: KnowledgeEntryInput) => {},
  updateEntry: async (_entryId: string, _entry: KnowledgeEntryInput) => {},
  deleteEntry: async (_entry: KnowledgeEntry) => {},
  toggleEntryStatus: async (_entry: KnowledgeEntry) => {},
  deleteDocument: async (_document: KnowledgeDocument) => {},
};

describe('useKnowledgeBasePageState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('defaults uploaded documents card to expanded', () => {
    const { result } = renderHook(() => useKnowledgeBasePageState(baseOptions));

    expect(result.current.showDocuments).toBe(true);
  });

  test('prevents adding duplicate custom lead statuses', () => {
    const { result } = renderHook(() => useKnowledgeBasePageState(baseOptions));

    act(() => {
      result.current.setNewStatusName('new');
    });

    act(() => {
      result.current.handleAddCustomStatus();
    });

    expect(result.current.customLeadStatuses.custom_statuses).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Duplicate status',
      variant: 'destructive',
    }));
  });
});
