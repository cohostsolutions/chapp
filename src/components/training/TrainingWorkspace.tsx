import { RefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiveFeedbackPanel } from '@/components/training/LiveFeedbackPanel';
import { SessionSummary } from '@/components/training/SessionSummary';
import { TrainingOnboarding } from '@/components/training/TrainingOnboarding';
import { TrainingSimulator } from '@/components/training/TrainingSimulator';
import { Target, UserRound, WandSparkles } from 'lucide-react';
import { TrainingModule, TrainingSessionRecord } from '@/lib/training/types';

interface Props {
  modules: TrainingModule[];
  selectedId?: string;
  selectedModule?: TrainingModule;
  loading: boolean;
  isModuleSwitching: boolean;
  canManageModules: boolean;
  sessionKey: number;
  summary: TrainingSessionRecord | null;
  organizationId: string;
  userId: string;
  latestUserMessage?: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  managerRef: RefObject<HTMLDivElement>;
  onModuleChange: (moduleId: string) => void;
  onStartNew: () => void;
  onSessionEnd: (record: TrainingSessionRecord) => void;
  onUserMessage: (message: string) => void;
  onConversationUpdate: (history: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  onOpenModuleManager: () => void;
}

function getDifficultyBadge(difficulty?: string) {
  switch (difficulty) {
    case 'easy':
      return <Badge variant="outline" className="text-green-600 border-green-300 text-xs ml-2">Easy</Badge>;
    case 'hard':
      return <Badge variant="outline" className="text-red-600 border-red-300 text-xs ml-2">Hard</Badge>;
    default:
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs ml-2">Medium</Badge>;
  }
}

export function TrainingWorkspace({
  modules,
  selectedId,
  selectedModule,
  loading,
  isModuleSwitching,
  canManageModules,
  sessionKey,
  summary,
  organizationId,
  userId,
  latestUserMessage,
  conversationHistory,
  managerRef,
  onModuleChange,
  onStartNew,
  onSessionEnd,
  onUserMessage,
  onConversationUpdate,
  onOpenModuleManager,
}: Props) {
  const objectiveProgress = selectedModule?.objectives?.length
    ? Math.min(100, Math.round((conversationHistory.filter((entry) => entry.role === 'user').length / selectedModule.objectives.length) * 100))
    : 0;

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-[#F4E7D3] via-background to-[#E7EDF6]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <CardTitle>AI Training Simulator</CardTitle>
            <CardDescription>
              Practice live objection handling, discovery, and closing in a focused training workspace.
            </CardDescription>
          </div>
          {selectedModule && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:w-[520px]">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <WandSparkles className="h-3.5 w-3.5" />
                  Scenario
                </div>
                <p className="text-sm font-medium leading-snug">{selectedModule.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedModule.industry || 'General'} workflow</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  Persona
                </div>
                <p className="text-sm font-medium leading-snug">{selectedModule.persona?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">Mood: {selectedModule.persona?.mood || 'neutral'}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5" />
                  Objective Pulse
                </div>
                <p className="text-sm font-medium leading-snug">{selectedModule.objectives?.length || 0} targets</p>
                <Progress value={objectiveProgress} className="mt-2 h-2" />
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="rounded-full border-[#C6843A]/40 bg-[#F5E7D4] px-3 py-1 text-[#7D4B24]">
                  Live Practice Workspace
                </Badge>
                {selectedModule?.difficulty && (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {selectedModule.difficulty} difficulty
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedId}
                onValueChange={onModuleChange}
                disabled={loading || modules.length === 0 || isModuleSwitching}
              >
                <SelectTrigger className="w-full min-w-[280px] lg:w-[360px]">
                  <SelectValue placeholder={loading ? 'Loading modules...' : isModuleSwitching ? 'Switching module...' : 'Select a training module'} />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id} className="py-2">
                      <div className="flex items-center">
                        <span>{module.title}</span>
                        {getDifficultyBadge(module.difficulty)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                <Button variant="outline" onClick={onStartNew}>New Session</Button>
              </div>
            </div>

            {!selectedModule ? (
              <TrainingOnboarding
                onSelectModule={() => {
                  const trigger = document.querySelector('[data-radix-select-trigger]') as HTMLElement;
                  trigger?.click();
                }}
                hasModules={modules.length > 0}
                canManageModules={canManageModules}
                onCreateModule={() => {
                  onOpenModuleManager();
                  managerRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            ) : !summary ? (
              <TrainingSimulator
                key={`${selectedModule.id}-${sessionKey}`}
                module={selectedModule}
                organizationId={organizationId}
                userId={userId}
                onEnd={onSessionEnd}
                onUserMessage={onUserMessage}
                onConversationUpdate={onConversationUpdate}
              />
            ) : (
              <div className="space-y-4">
                <SessionSummary record={summary} onNewSession={onStartNew} />
                <Button onClick={onStartNew} variant="outline" className="w-full">
                  Start New Session
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {selectedModule && (
              <Tabs defaultValue="brief" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="brief">Scenario Brief</TabsTrigger>
                  <TabsTrigger value="coach">Live Coach</TabsTrigger>
                </TabsList>

                <TabsContent value="brief" className="space-y-4">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Scenario Brief</CardTitle>
                      <CardDescription>Keep this panel visible during practice for context and success criteria.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="rounded-2xl bg-muted/30 p-4 leading-relaxed text-foreground/90">
                        {selectedModule.description || 'No scenario description provided.'}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-border/60 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Industry</p>
                          <p className="mt-1 font-medium capitalize">{selectedModule.industry || 'general'}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Difficulty</p>
                          <p className="mt-1 font-medium capitalize">{selectedModule.difficulty || 'medium'}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer Persona</p>
                        <p className="mt-2 font-medium">{selectedModule.persona?.name} · <span className="capitalize">{selectedModule.persona?.mood}</span></p>
                        {selectedModule.persona?.background && (
                          <p className="mt-2 text-muted-foreground">{selectedModule.persona.background}</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/60 p-4">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Objectives</p>
                        <div className="space-y-2">
                          {selectedModule.objectives?.map((objective, index) => (
                            <div key={index} className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-2">
                              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E5EFEA] text-[11px] font-semibold text-[#2F6E5B]">
                                {index + 1}
                              </div>
                              <p className="flex-1 leading-relaxed">{objective}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 p-4">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Rubric Focus</p>
                        <div className="space-y-3">
                          {selectedModule.rubric?.map((rubric) => (
                            <div key={rubric.id} className="rounded-xl bg-muted/30 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium">{rubric.name}</p>
                                <Badge variant="outline">Weight {rubric.weight || 1}</Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">{rubric.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="coach" className="space-y-4">
                  <LiveFeedbackPanel
                    module={selectedModule}
                    latestUserMessage={latestUserMessage}
                    conversationHistory={conversationHistory}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TrainingWorkspace;