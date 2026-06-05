import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { devError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TrainingSessionRecord, TrainingModule, RubricTemplate } from '@/lib/training/types';
import { TrainingProgressCard } from '@/components/training/TrainingProgressCard';
import { TeamLeaderboard } from '@/components/training/TeamLeaderboard';
import { MetricsDashboard } from '@/components/training/MetricsDashboard';
import { TrainingWorkspace } from '@/components/training/TrainingWorkspace';
import { TrainingModuleManager } from '@/components/training/TrainingModuleManager';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { deleteTemplate, fetchOrganizationTraining, listModules, listTemplates, saveTemplate, upsertModule } from '@/lib/training/api';
import { useToast } from '@/hooks/use-toast';
import { createEmptyDraft, DraftModule } from '@/lib/training/drafts';

export default function AITraining() {
  const { profile, isClientAdmin, isSuperAdmin, effectiveIsClientAdmin, effectiveIsAgent, impersonatedRole } = useAuth();
  const { toast } = useToast();
  const orgId = profile?.organization_id;
  const canManageModules = effectiveIsClientAdmin && !effectiveIsAgent;

  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [latestUserMessage, setLatestUserMessage] = useState<string | undefined>(undefined);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [summary, setSummary] = useState<TrainingSessionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [trainingEnabled, setTrainingEnabled] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const managerRef = useRef<HTMLDivElement>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; rubricIndex: number | null }>({ open: false, rubricIndex: null });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isModuleSwitching, setIsModuleSwitching] = useState(false);
  const moduleSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [draft, setDraft] = useState<DraftModule>(createEmptyDraft());

  const selectedModule = useMemo(() => modules.find((module) => module.id === selectedId), [modules, selectedId]);

  const refreshModules = useCallback(async (preserveSelection = false) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await listModules(orgId);
      setModules(data);
      if (!preserveSelection && !selectedId) {
        setSelectedId(data[0]?.id);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('permission denied') || errorMsg.includes('row level security')) {
        toast({ title: 'Access Denied', description: 'You do not have permission to access training modules. Contact your admin to enable this feature.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to load training modules', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedId, toast]);

  const refreshTemplates = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await listTemplates(orgId);
      setTemplates(data);
    } catch (err) {
      devError('[AITraining] Error loading templates:', err);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const org = await fetchOrganizationTraining(orgId);
        const isEnabled = org?.training_enabled ?? false;
        setTrainingEnabled(isEnabled);

        if (isEnabled || (isSuperAdmin && !impersonatedRole)) {
          await refreshModules();
          await refreshTemplates();
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('permission denied') || errorMsg.includes('row level security')) {
          devError('[AITraining] RLS/Permission Error - Check database policies and training_enabled flag');
        }
        setTrainingEnabled(false);
      }
    })();
  }, [orgId, isSuperAdmin, impersonatedRole, refreshModules, refreshTemplates]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back Online',
        description: 'Connection restored. You can continue your training.',
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'No Internet Connection',
        description: 'You are offline. Some features may not be available.',
        variant: 'destructive',
        duration: 3000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  useEffect(() => {
    return () => {
      if (moduleSwitchTimeoutRef.current) {
        clearTimeout(moduleSwitchTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveTemplate = async () => {
    if (!orgId || !templateName.trim()) return;
    try {
      await saveTemplate({
        organization_id: orgId,
        name: templateName,
        description: templateDescription,
        rubric: draft.rubric,
      });
      toast({ title: 'Template saved', description: 'Rubric template saved successfully' });
      setTemplateDialogOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      await refreshTemplates();
    } catch (err) {
      devError('[AITraining] Error saving template:', err);
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    }
  };

  const handleLoadTemplate = (template: RubricTemplate) => {
    setDraft((prev) => ({ ...prev, rubric: template.rubric }));
    toast({ title: 'Template loaded', description: `Loaded ${template.name}` });
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteTemplate(id);
      toast({ title: 'Template deleted' });
      await refreshTemplates();
    } catch (err) {
      devError('[AITraining] Error deleting template:', err);
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' });
    }
  };

  const handleArchiveModule = async (moduleId: string) => {
    if (!window.confirm('Are you sure you want to archive this module? It will no longer appear in the training list.')) {
      return;
    }

    try {
      await upsertModule({ id: moduleId, organization_id: orgId!, visibility: 'archived' });
      toast({ title: 'Module archived', description: 'Module has been archived successfully' });
      await refreshModules(true);
      if (selectedId === moduleId) {
        setSelectedId(modules.filter((module) => module.id !== moduleId)[0]?.id);
      }
    } catch (err) {
      devError('[AITraining] Error archiving module:', err);
      toast({ title: 'Error', description: 'Failed to archive module', variant: 'destructive' });
    }
  };

  const handleSaveModule = async () => {
    if (!orgId) return;

    if (!draft.title.trim()) {
      toast({ title: 'Validation Error', description: 'Module title is required', variant: 'destructive' });
      return;
    }
    if (!draft.persona.name.trim()) {
      toast({ title: 'Validation Error', description: 'Persona name is required', variant: 'destructive' });
      return;
    }
    if (draft.rubric.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one rubric category is required', variant: 'destructive' });
      return;
    }

    for (let index = 0; index < draft.rubric.length; index += 1) {
      const rubric = draft.rubric[index];
      if (!rubric.name?.trim()) {
        toast({ title: 'Validation Error', description: `Rubric category ${index + 1} must have a name`, variant: 'destructive' });
        return;
      }
      if (!rubric.description?.trim()) {
        toast({ title: 'Validation Error', description: `Rubric category "${rubric.name}" must have a description`, variant: 'destructive' });
        return;
      }
      if (!rubric.weight || rubric.weight <= 0) {
        toast({ title: 'Validation Error', description: `Rubric category "${rubric.name}" must have a weight greater than 0`, variant: 'destructive' });
        return;
      }
      if (!rubric.guidelines || rubric.guidelines.length === 0) {
        toast({ title: 'Validation Error', description: `Rubric category "${rubric.name}" must have at least one guideline`, variant: 'destructive' });
        return;
      }
      if (rubric.guidelines.find((guideline) => !guideline?.trim()) !== undefined) {
        toast({ title: 'Validation Error', description: `Rubric category "${rubric.name}" has empty guidelines. Please remove or fill them.`, variant: 'destructive' });
        return;
      }
    }

    const payload = {
      id: draft.id,
      organization_id: orgId,
      title: draft.title,
      description: draft.description,
      industry: draft.industry as unknown,
      difficulty: draft.difficulty as unknown,
      persona: {
        name: draft.persona.name,
        mood: draft.persona.mood as unknown,
        goals: draft.persona.goals.split(',').map((entry) => entry.trim()).filter(Boolean),
        constraints: draft.persona.constraints.split(',').map((entry) => entry.trim()).filter(Boolean),
        background: draft.persona.background,
        ai_language: draft.persona.ai_language || 'en',
      },
      objectives: draft.objectives.split('\n').map((entry) => entry.trim()).filter(Boolean),
      rubric: draft.rubric,
      visibility: 'active' as const,
      first_message_sender: draft.first_message_sender || 'ai',
      call_type: draft.call_type || 'warm_call',
    };

    setIsSaving(true);
    try {
      const saved = await upsertModule(payload as never);
      toast({ title: 'Saved', description: 'Module saved' });
      setDraft(createEmptyDraft());
      await refreshModules(true);
      setSelectedId(saved.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save module. Check console for details.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const startNew = useCallback(() => {
    setSummary(null);
    setLatestUserMessage(undefined);
    setConversationHistory([]);
    setSessionKey((key) => key + 1);
  }, []);

  const handleSessionEnd = useCallback((record: TrainingSessionRecord) => {
    setSummary(record);
  }, []);

  const handleUserMessage = useCallback((message: string) => {
    setLatestUserMessage(message);
  }, []);

  const handleConversationUpdate = useCallback((history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    setConversationHistory(history);
  }, []);

  const handleModuleChange = useCallback((moduleId: string) => {
    if (moduleSwitchTimeoutRef.current) {
      clearTimeout(moduleSwitchTimeoutRef.current);
    }

    setIsModuleSwitching(true);
    moduleSwitchTimeoutRef.current = setTimeout(() => {
      setSelectedId(moduleId);
      startNew();
      setIsModuleSwitching(false);
    }, 300);
  }, [startNew]);

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">No organization context. Please re-login.</p>;
  }

  if (trainingEnabled === false && !(isSuperAdmin && !impersonatedRole)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Training</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Training is not enabled for this organization. Contact your super admin to enable this feature.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (trainingEnabled === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Training</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const trainingErrorFallback = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          Training Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred in the training system. Our team has been notified.
        </p>
        <Button onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary fallback={trainingErrorFallback}>
      <div className="space-y-4">
        {!isOnline && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are currently offline. Some features may not be available. Please check your internet connection.
            </AlertDescription>
          </Alert>
        )}

        {profile?.id && orgId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TrainingProgressCard userId={profile.id} organizationId={orgId} />
            <TeamLeaderboard organizationId={orgId} currentUserId={profile.id} />
          </div>
        )}

        {(isClientAdmin || isSuperAdmin) && <MetricsDashboard />}

        <TrainingWorkspace
          modules={modules}
          selectedId={selectedId}
          selectedModule={selectedModule}
          loading={loading}
          isModuleSwitching={isModuleSwitching}
          canManageModules={canManageModules}
          sessionKey={sessionKey}
          summary={summary}
          organizationId={orgId}
          userId={profile?.id || ''}
          latestUserMessage={latestUserMessage}
          conversationHistory={conversationHistory}
          managerRef={managerRef}
          onModuleChange={handleModuleChange}
          onStartNew={startNew}
          onSessionEnd={handleSessionEnd}
          onUserMessage={handleUserMessage}
          onConversationUpdate={handleConversationUpdate}
          onOpenModuleManager={() => setModuleFormOpen(true)}
        />

        {canManageModules && (
          <TrainingModuleManager
            modules={modules}
            templates={templates}
            draft={draft}
            setDraft={setDraft}
            moduleFormOpen={moduleFormOpen}
            setModuleFormOpen={setModuleFormOpen}
            templateDialogOpen={templateDialogOpen}
            setTemplateDialogOpen={setTemplateDialogOpen}
            templateName={templateName}
            setTemplateName={setTemplateName}
            templateDescription={templateDescription}
            setTemplateDescription={setTemplateDescription}
            isSaving={isSaving}
            managerRef={managerRef}
            deleteConfirmation={deleteConfirmation}
            setDeleteConfirmation={setDeleteConfirmation}
            onSaveModule={handleSaveModule}
            onSaveTemplate={handleSaveTemplate}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onArchiveModule={handleArchiveModule}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
