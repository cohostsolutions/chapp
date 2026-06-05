import { useMemo, useRef } from 'react';
import { AlertCircle, BookOpenText, BotMessageSquare, ChevronDown, ExternalLink, FileCheck, FileText, FileX, Filter, GitBranchPlus, Headphones, MoreHorizontal, Plus, Settings2, X } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { AIChatPreview } from '@/components/knowledge-base/AIChatPreview';
import { KnowledgeBaseActionsBar } from '@/components/knowledge-base/KnowledgeBaseActionsBar';
import { KnowledgeBaseHeader } from '@/components/knowledge-base/KnowledgeBaseHeader';
import { HandoffSettingsCard } from '@/components/knowledge-base/HandoffSettingsCard';
import { KnowledgeSectionContent } from '@/components/knowledge-base/KnowledgeSectionContent';
import { LeadStatusesCard } from '@/components/knowledge-base/LeadStatusesCard';
import { SalesProcessCard } from '@/components/knowledge-base/SalesProcessCard';
import { UploadedDocumentsCard } from '@/components/knowledge-base/UploadedDocumentsCard';
import { formatKnowledgeBaseFileSize, getKnowledgeBaseFileExtension, getKnowledgeBaseFileIcon } from '@/components/knowledge-base/fileDisplay';
import { knowledgeSections } from '@/components/knowledge-base/knowledgeSections';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useKnowledgeBaseContent,
  type KnowledgeDocument,
} from '@/hooks/useKnowledgeBaseContent';
import { useKnowledgeBasePageState } from '@/hooks/useKnowledgeBasePageState';
import { knowledgeSectionIds } from '@/components/knowledge-base/knowledgeEntryForm';

const structuredSections = [
  {
    id: 'sales-process',
    label: 'Sales Process',
    icon: BookOpenText,
    description: 'Structured AI customer journey configuration',
  },
  {
    id: 'lead-workflow',
    label: 'Lead Workflow',
    icon: GitBranchPlus,
    description: 'Lead status pipeline and workflow settings',
  },
  {
    id: 'agent-handoff',
    label: 'Agent Handoff',
    icon: BotMessageSquare,
    description: 'Agent takeover and AI handback rules',
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    description: 'Uploaded training documents and processing state',
  },
] as const;

const getSectionCompactLabel = (sectionId: string, label: string): string => {
  switch (sectionId) {
    case 'tone-personality':
      return 'Tone';
    case 'business-overview':
      return 'Biz';
    case 'faqs':
      return 'FAQ';
    case 'sample-conversations':
      return 'Samples';
    case 'sales-process':
      return 'Sales';
    case 'lead-workflow':
      return 'Leads';
    case 'agent-handoff':
      return 'Handoff';
    case 'documents':
      return 'Docs';
    default:
      return label;
  }
};

// Helper to get relative time
const getRelativeTime = (dateString: string): string => {
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
};

function KnowledgeBaseContent() {
  const { isSuperAdmin, isClientAdmin, profile, user, aiAgentType } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    entries,
    documents,
    isLoading,
    isRefreshing,
    isUploading,
    uploadProgress,
    uploadedFiles,
    refresh: handleRefresh,
    createEntry,
    updateEntry,
    deleteEntry,
    toggleEntryStatus,
    processAllPendingDocuments,
    reprocessDocument,
    deleteDocument,
    processFiles,
    removeUploadedFile,
    clearUploadedFiles,
  } = useKnowledgeBaseContent({
    organizationId: profile?.organization_id,
    userId: user?.id,
  });
  const canManage = isSuperAdmin || isClientAdmin;
  const {
    activeTab,
    setActiveTab,
    showDocuments,
    setShowDocuments,
    showChatPreview,
    setShowChatPreview,
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
  } = useKnowledgeBasePageState({
    organizationId: profile?.organization_id,
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
  });

  const isKnowledgeEntrySection = useMemo(
    () => knowledgeSectionIds.includes(activeTab as (typeof knowledgeSectionIds)[number]),
    [activeTab]
  );

  const isDocumentsSection = activeTab === 'documents';

  const visibleSections = useMemo(() => [...knowledgeSections, ...structuredSections], []);

  return (
    <div className="space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6" data-tour="knowledge-base-content">
      <KnowledgeBaseHeader
        totalEntries={stats.total}
        activeEntries={stats.active}
        staleEntries={stats.stale}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onNeedsReview={activateNeedsReview}
        onOpenChatPreview={() => setShowChatPreview(true)}
      />

      <KnowledgeBaseActionsBar
        showFilters={isKnowledgeEntrySection}
        showUploadAction={isKnowledgeEntrySection || isDocumentsSection}
        showEntryDialogAction={isKnowledgeEntrySection}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        reviewStatusFilter={reviewStatusFilter}
        onReviewStatusFilterChange={setReviewStatusFilter}
        sourcePriorityFilter={sourcePriorityFilter}
        onSourcePriorityFilterChange={setSourcePriorityFilter}
        hasActiveFilters={Boolean(hasActiveFilters)}
        onClearFilters={clearFilters}
        canManage={canManage}
        fileInputRef={fileInputRef}
        onFileUpload={handleFileUpload}
        showEntryDialog={showEntryDialog}
        setShowEntryDialog={setShowEntryDialog}
        editingEntry={editingEntry}
        existingEntries={entries}
        currentUserDisplayName={profile?.full_name || profile?.email || 'Unknown User'}
        selectedCategory={selectedCategory}
        uploadedFiles={uploadedFiles}
        clearUploadedFiles={clearUploadedFiles}
        removeUploadedFile={removeUploadedFile}
        isDragging={isDragging}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onCancelDialog={() => {
          setShowEntryDialog(false);
          resetEntryForm();
        }}
        onSubmitDialog={handleSubmitEntry}
        knowledgeSections={knowledgeSections}
        getFileIcon={getKnowledgeBaseFileIcon}
        getFileExtension={getKnowledgeBaseFileExtension}
        formatFileSize={formatKnowledgeBaseFileSize}
        resetEntryForm={resetEntryForm}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="relative mb-6 w-full rounded-lg border border-border/60 bg-muted/30 p-1.5">
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 z-10 w-6 bg-gradient-to-r from-muted/30 to-transparent" />
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 top-1.5 z-10 w-6 bg-gradient-to-l from-muted/30 to-transparent" />
          <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex h-auto min-w-max gap-2 bg-transparent p-0">
              {visibleSections.map((section) => {
            const sectionEntries = entries.filter(e => e.category === section.id);
            const count = section.id === 'sales-process'
              ? 1
              : section.id === 'lead-workflow'
                ? Object.values(customLeadStatuses.default_statuses).filter((status) => status.enabled).length + customLeadStatuses.custom_statuses.length
                : section.id === 'agent-handoff'
                  ? Number(takeoverCriteria.enabled) + Number(handbackCriteria.enabled)
                  : section.id === 'documents'
                    ? documents.length
                    : sectionEntries.length;
                return (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="shrink-0 gap-2 px-2.5 py-2.5 sm:px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="hidden max-w-[150px] truncate 2xl:inline">{section.label}</span>
                    <span className="hidden text-xs font-medium lg:inline 2xl:hidden">
                      {getSectionCompactLabel(section.id, section.label)}
                    </span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        {/* Section Content */}
        {knowledgeSections.map((section) => {
          const sectionEntries = filteredEntries.filter((entry) => entry.category === section.id);

          return (
            <TabsContent key={section.id} value={section.id}>
              <KnowledgeSectionContent
                section={section}
                entries={sectionEntries}
                isLoading={isLoading}
                hasActiveFilters={hasActiveFilters}
                canManage={canManage}
                clearFilters={clearFilters}
                onAddEntry={handleAddEntryForCategory}
                onToggleEntryStatus={handleToggleEntryStatus}
                onEditEntry={openEditDialog}
                onDeleteEntry={handleDeleteEntry}
                getRelativeTime={getRelativeTime}
              />
            </TabsContent>
          );
        })}

        <TabsContent value="sales-process">
          <SalesProcessCard
            expanded={salesProcessExpanded}
            onExpandedChange={setSalesProcessExpanded}
            tab={salesProcessTab}
            onTabChange={setSalesProcessTab}
            salesProcessConfig={salesProcessConfig}
            updateSalesProcessField={updateSalesProcessField}
            updateConversionField={updateConversionField}
            requiredInfoText={requiredInfoText}
            setRequiredInfoText={setRequiredInfoText}
            qualificationQuestionsText={qualificationQuestionsText}
            setQualificationQuestionsText={setQualificationQuestionsText}
            isSaving={isSavingSalesProcess}
            onSave={handleSaveSalesProcess}
          />
        </TabsContent>

        <TabsContent value="lead-workflow">
          <LeadStatusesCard
            expanded={statusesExpanded}
            onExpandedChange={setStatusesExpanded}
            customLeadStatuses={customLeadStatuses}
            handleToggleDefaultStatus={handleToggleDefaultStatus}
            handleRemoveCustomStatus={handleRemoveCustomStatus}
            newStatusName={newStatusName}
            setNewStatusName={setNewStatusName}
            newStatusColor={newStatusColor}
            setNewStatusColor={setNewStatusColor}
            handleAddCustomStatus={handleAddCustomStatus}
            isSaving={isSavingStatuses}
            onSave={handleSaveCustomStatuses}
          />
        </TabsContent>

        <TabsContent value="agent-handoff">
          <HandoffSettingsCard
            expanded={takeoverExpanded}
            onExpandedChange={setTakeoverExpanded}
            aiAgentType={aiAgentType}
            handoffTab={handoffTab}
            onHandoffTabChange={setHandoffTab}
            takeoverCriteria={takeoverCriteria}
            setTakeoverCriteria={setTakeoverCriteria}
            agentTakeoverMessage={agentTakeoverMessage}
            setAgentTakeoverMessage={setAgentTakeoverMessage}
            aiHandbackMessage={aiHandbackMessage}
            setAiHandbackMessage={setAiHandbackMessage}
            handbackCriteria={handbackCriteria}
            setHandbackCriteria={setHandbackCriteria}
            isSavingTakeover={isSavingTakeover}
            onSaveTakeover={handleSaveTakeoverCriteria}
            isSavingHandback={isSavingHandback}
            onSaveHandback={handleSaveHandbackCriteria}
          />
        </TabsContent>

        <TabsContent value="documents">
          {documents.length > 0 ? (
            <UploadedDocumentsCard
              documents={documents}
              pendingDocs={stats.pendingDocs}
              open={showDocuments}
              onOpenChange={setShowDocuments}
              onProcessAll={processAllPendingDocuments}
              onReprocess={(document) => {
                void reprocessDocument(document);
              }}
              onDelete={(document) => {
                void handleDeleteDocument(document);
              }}
              onViewExtractedText={handleViewExtractedText}
              getRelativeTime={getRelativeTime}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium">No uploaded documents yet</p>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                  Upload PDFs, docs, text files, or images to train your AI with additional source material.
                </p>
                {canManage ? (
                  <Button className="mt-4" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Settings2 className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Chat Preview Sheet */}
      <AIChatPreview open={showChatPreview} onOpenChange={setShowChatPreview} />
    </div>
  );
}

export default function KnowledgeBase() {
  return (
    <ErrorBoundary fullPage>
      <KnowledgeBaseContent />
    </ErrorBoundary>
  );
}
