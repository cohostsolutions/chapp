import { Dispatch, RefObject, SetStateAction } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ModuleTemplateLibrary } from '@/components/training/ModuleTemplateLibrary';
import type { TemplateModule } from '@/components/training/ModuleTemplateLibrary';
import { RubricTemplate, TrainingModule } from '@/lib/training/types';
import { createDraftFromModule, createDraftFromTemplate, createEmptyDraft, DraftModule } from '@/lib/training/drafts';

interface Props {
  modules: TrainingModule[];
  templates: RubricTemplate[];
  draft: DraftModule;
  setDraft: Dispatch<SetStateAction<DraftModule>>;
  moduleFormOpen: boolean;
  setModuleFormOpen: Dispatch<SetStateAction<boolean>>;
  templateDialogOpen: boolean;
  setTemplateDialogOpen: Dispatch<SetStateAction<boolean>>;
  templateName: string;
  setTemplateName: Dispatch<SetStateAction<string>>;
  templateDescription: string;
  setTemplateDescription: Dispatch<SetStateAction<string>>;
  isSaving: boolean;
  managerRef: RefObject<HTMLDivElement>;
  deleteConfirmation: { open: boolean; rubricIndex: number | null };
  setDeleteConfirmation: Dispatch<SetStateAction<{ open: boolean; rubricIndex: number | null }>>;
  onSaveModule: () => void;
  onSaveTemplate: () => void;
  onLoadTemplate: (template: RubricTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onArchiveModule: (moduleId: string) => void;
}

export function TrainingModuleManager({
  modules,
  templates,
  draft,
  setDraft,
  moduleFormOpen,
  setModuleFormOpen,
  templateDialogOpen,
  setTemplateDialogOpen,
  templateName,
  setTemplateName,
  templateDescription,
  setTemplateDescription,
  isSaving,
  managerRef,
  deleteConfirmation,
  setDeleteConfirmation,
  onSaveModule,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onArchiveModule,
}: Props) {
  const handleApplyTemplate = (template: TemplateModule) => {
    setDraft(createDraftFromTemplate(template));
    setModuleFormOpen(true);
    managerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <ModuleTemplateLibrary onApplyTemplate={handleApplyTemplate} />

      <Card data-manage-modules ref={managerRef}>
        <Collapsible open={moduleFormOpen} onOpenChange={setModuleFormOpen}>
          <CardHeader className="cursor-pointer" onClick={() => setModuleFormOpen(!moduleFormOpen)}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Manage Training Modules</CardTitle>
                  <CardDescription className="mt-1">
                    Create and edit training scenarios for your team
                  </CardDescription>
                </div>
                {moduleFormOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="persona">Persona</TabsTrigger>
                  <TabsTrigger value="objectives">Objectives</TabsTrigger>
                  <TabsTrigger value="rubric">Rubric</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Industry</Label>
                      <Select value={draft.industry || 'general'} onValueChange={(value) => setDraft((prev) => ({ ...prev, industry: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="ecommerce">Ecommerce</SelectItem>
                          <SelectItem value="saas">SaaS</SelectItem>
                          <SelectItem value="hospitality">Hospitality</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <Select value={draft.difficulty || 'medium'} onValueChange={(value) => setDraft((prev) => ({ ...prev, difficulty: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>First Message (Chat Mode)</Label>
                      <Select value={draft.first_message_sender || 'ai'} onValueChange={(value: 'ai' | 'trainee') => setDraft((prev) => ({ ...prev, first_message_sender: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ai">AI starts conversation</SelectItem>
                          <SelectItem value="trainee">Trainee starts conversation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Call Type</Label>
                      <Select value={draft.call_type || 'warm_call'} onValueChange={(value: 'cold_call' | 'warm_call') => setDraft((prev) => ({ ...prev, call_type: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warm_call">Warm Call (Inbound - Lead calls you)</SelectItem>
                          <SelectItem value="cold_call">Cold Call (Outbound - You call lead)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>AI Response Language</Label>
                      <Select value={draft.persona.ai_language || 'en'} onValueChange={(value) => setDraft((prev) => ({ ...prev, persona: { ...prev.persona, ai_language: value } }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fil">Filipino (Tagalog)</SelectItem>
                          <SelectItem value="ceb">Cebuano</SelectItem>
                          <SelectItem value="ilo">Ilocano</SelectItem>
                          <SelectItem value="es">Spanish (Español)</SelectItem>
                          <SelectItem value="fr">French (Français)</SelectItem>
                          <SelectItem value="de">German (Deutsch)</SelectItem>
                          <SelectItem value="it">Italian (Italiano)</SelectItem>
                          <SelectItem value="pt">Portuguese (Português)</SelectItem>
                          <SelectItem value="zh">Chinese (中文)</SelectItem>
                          <SelectItem value="ja">Japanese (日本語)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="persona" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Persona Name</Label>
                      <Input value={draft.persona.name} onChange={(e) => setDraft((prev) => ({ ...prev, persona: { ...prev.persona, name: e.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Persona Mood</Label>
                      <Input value={draft.persona.mood} onChange={(e) => setDraft((prev) => ({ ...prev, persona: { ...prev.persona, mood: e.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Goals (comma separated)</Label>
                      <Input value={draft.persona.goals} onChange={(e) => setDraft((prev) => ({ ...prev, persona: { ...prev.persona, goals: e.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Constraints (comma separated)</Label>
                      <Input value={draft.persona.constraints} onChange={(e) => setDraft((prev) => ({ ...prev, persona: { ...prev.persona, constraints: e.target.value } }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Background</Label>
                      <Textarea value={draft.persona.background} onChange={(e) => setDraft((prev) => ({ ...prev, persona: { ...prev.persona, background: e.target.value } }))} rows={5} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="objectives" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Training Objectives (one per line)</Label>
                    <Textarea
                      value={draft.objectives}
                      onChange={(e) => setDraft((prev) => ({ ...prev, objectives: e.target.value }))}
                      placeholder="Enter each objective on a new line..."
                      rows={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Define what the trainee should accomplish in this scenario. Each line will be treated as a separate objective.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="rubric" className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Rubric Categories</Label>
                      <div className="flex gap-2">
                        {templates.length > 0 && (
                          <Select onValueChange={(id) => {
                            const template = templates.find((entry) => entry.id === id);
                            if (template) onLoadTemplate(template);
                          }}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Load Template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)}>
                          Save as Template
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              rubric: [
                                ...prev.rubric,
                                {
                                  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
                                  name: 'New',
                                  description: '',
                                  guidelines: [],
                                  weight: 1,
                                },
                              ],
                            }))
                          }
                        >
                          Add Category
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {draft.rubric.map((rubric, index) => (
                        <Card key={rubric.id} className="border-dashed">
                          <CardContent className="space-y-2 pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-sm">Category {index + 1}</h4>
                              {draft.rubric.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmation({ open: true, rubricIndex: index })}
                                  className="h-8 text-destructive hover:text-destructive"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <Label>Name</Label>
                                <Input value={rubric.name} onChange={(e) => setDraft((prev) => ({ ...prev, rubric: prev.rubric.map((entry, rubricIndex) => rubricIndex === index ? { ...entry, name: e.target.value } : entry) }))} />
                              </div>
                              <div>
                                <Label>Weight</Label>
                                <Input type="number" value={rubric.weight ?? 1} onChange={(e) => setDraft((prev) => ({ ...prev, rubric: prev.rubric.map((entry, rubricIndex) => rubricIndex === index ? { ...entry, weight: Number(e.target.value) } : entry) }))} />
                              </div>
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Input value={rubric.description} onChange={(e) => setDraft((prev) => ({ ...prev, rubric: prev.rubric.map((entry, rubricIndex) => rubricIndex === index ? { ...entry, description: e.target.value } : entry) }))} />
                            </div>
                            <div>
                              <Label>Guidelines (comma separated)</Label>
                              <Input value={rubric.guidelines.join(', ')} onChange={(e) => setDraft((prev) => ({ ...prev, rubric: prev.rubric.map((entry, rubricIndex) => rubricIndex === index ? { ...entry, guidelines: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) } : entry) }))} />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2">
                {draft.id && (
                  <Button variant="outline" onClick={() => setDraft(createEmptyDraft())}>
                    Cancel Edit
                  </Button>
                )}
                <Button onClick={onSaveModule} disabled={isSaving}>
                  {isSaving ? 'Saving...' : draft.id ? 'Update Module' : 'Save Module'}
                </Button>
              </div>

              {modules.length > 0 && (
                <div className="space-y-2">
                  <Label>Edit Existing Modules</Label>
                  <p className="text-xs text-muted-foreground mb-2">Click a module to load it into the form above for editing</p>
                  <div className="flex flex-wrap gap-2">
                    {modules.map((module) => (
                      <div key={module.id} className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => setDraft(createDraftFromModule(module))}>
                          {module.title}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onArchiveModule(module.id);
                          }}
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          title="Archive module"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Rubric Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template Name</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., Customer Service Basic" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="What is this template for?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={onSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Rubric Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((template) => (
                <Card key={template.id} className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{template.rubric.length} categories</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onLoadTemplate(template)}>Load</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDeleteTemplate(template.id)}>Delete</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteConfirmation.open} onOpenChange={(open) => setDeleteConfirmation((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Rubric Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove the rubric category "{deleteConfirmation.rubricIndex !== null ? draft.rubric[deleteConfirmation.rubricIndex]?.name : ''}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmation({ open: false, rubricIndex: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmation.rubricIndex !== null) {
                  setDraft((prev) => ({
                    ...prev,
                    rubric: prev.rubric.filter((_, index) => index !== deleteConfirmation.rubricIndex),
                  }));
                }
                setDeleteConfirmation({ open: false, rubricIndex: null });
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TrainingModuleManager;