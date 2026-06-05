import { AlertCircle, Bot, CheckCircle, ChevronRight, Headphones, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { AIHandbackCriteria, AgentTakeoverCriteria } from '@/hooks/useKnowledgeBaseSettings';
import type { AgentType } from '@/lib/chatConfig';

interface HandoffSettingsCardProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  aiAgentType?: AgentType;
  handoffTab: 'takeover' | 'handback';
  onHandoffTabChange: (tab: 'takeover' | 'handback') => void;
  takeoverCriteria: AgentTakeoverCriteria;
  setTakeoverCriteria: React.Dispatch<React.SetStateAction<AgentTakeoverCriteria>>;
  agentTakeoverMessage: string;
  setAgentTakeoverMessage: (message: string) => void;
  aiHandbackMessage: string;
  setAiHandbackMessage: (message: string) => void;
  handbackCriteria: AIHandbackCriteria;
  setHandbackCriteria: React.Dispatch<React.SetStateAction<AIHandbackCriteria>>;
  isSavingTakeover: boolean;
  onSaveTakeover: () => void;
  isSavingHandback: boolean;
  onSaveHandback: () => void;
}

export function HandoffSettingsCard({
  expanded,
  onExpandedChange,
  aiAgentType,
  handoffTab,
  onHandoffTabChange,
  takeoverCriteria,
  setTakeoverCriteria,
  agentTakeoverMessage,
  setAgentTakeoverMessage,
  aiHandbackMessage,
  setAiHandbackMessage,
  handbackCriteria,
  setHandbackCriteria,
  isSavingTakeover,
  onSaveTakeover,
  isSavingHandback,
  onSaveHandback,
}: HandoffSettingsCardProps) {
  const agentLabel = aiAgentType === 'cece' ? 'Cece' : aiAgentType === 'may' ? 'May' : 'Jay';
  const takeoverPromptMissing = takeoverCriteria.enabled && !takeoverCriteria.criteria_prompt.trim();
  const handbackPromptMissing = handbackCriteria.enabled && !handbackCriteria.criteria_prompt.trim();

  return (
    <Card className={`border-warning/20 ${expanded ? 'lg:col-span-2' : ''}`}>
      <Collapsible open={expanded} onOpenChange={onExpandedChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-2.5 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-warning/20 to-warning/10 shrink-0">
                  <Headphones className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-lg">Agent Takeover & AI Handback</CardTitle>
                  <CardDescription className="text-xs sm:text-sm line-clamp-1">
                    Configurable workflow rules for {agentLabel} and your human team
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Badge variant={takeoverCriteria.enabled || handbackCriteria.enabled ? 'default' : 'secondary'} className="text-xs px-1.5 sm:px-2.5">
                  {takeoverCriteria.enabled && handbackCriteria.enabled ? '2 Active' : takeoverCriteria.enabled || handbackCriteria.enabled ? '1 Active' : 'Disabled'}
                </Badge>
                <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4 sm:space-y-6">
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs sm:text-sm text-muted-foreground">
              These rules are organization-configurable and apply to the current agent workflow. Manual takeover and manual handback actions remain available even when automation is disabled.
            </div>

            <Tabs value={handoffTab} onValueChange={(value) => onHandoffTabChange(value as 'takeover' | 'handback')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto">
                <TabsTrigger value="takeover" className="text-xs sm:text-sm py-2 gap-1 sm:gap-2">
                  <Headphones className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Agent Takeover</span>
                  <span className="sm:hidden">Takeover</span>
                </TabsTrigger>
                <TabsTrigger value="handback" className="text-xs sm:text-sm py-2 gap-1 sm:gap-2">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">AI Handback</span>
                  <span className="sm:hidden">Handback</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="takeover" className="space-y-4 sm:space-y-6 mt-4">
                <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-3">
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm sm:text-base">Enable Agent Takeover</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">AI monitors and suggests handoff when criteria are met</p>
                  </div>
                  <Switch
                    checked={takeoverCriteria.enabled}
                    onCheckedChange={(enabled) => setTakeoverCriteria((current) => ({ ...current, enabled }))}
                  />
                </div>

                {takeoverCriteria.enabled && (
                  <>
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-sm">Takeover Criteria Prompt</Label>
                      <Textarea
                          placeholder={`Example: Escalate ${agentLabel} to a human when the contact requests pricing exceptions, asks for policy overrides, or expresses frustration.`}
                        className="min-h-[80px] sm:min-h-[100px] text-sm"
                        value={takeoverCriteria.criteria_prompt}
                        onChange={(event) => setTakeoverCriteria((current) => ({ ...current, criteria_prompt: event.target.value }))}
                      />
                        {takeoverPromptMissing && (
                          <p className="text-xs text-destructive">A takeover criteria prompt is required when takeover automation is enabled.</p>
                        )}
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-sm">Example Scenarios</Label>
                      <ul className="space-y-1.5 sm:space-y-2">
                        {takeoverCriteria.examples.slice(0, 3).map((example, index) => (
                          <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 sm:line-clamp-none">{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between p-2.5 sm:p-3 border rounded-lg gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm">Auto-notify Agent</p>
                        <p className="text-xs text-muted-foreground hidden sm:block">Send notification when takeover triggers</p>
                      </div>
                      <Switch
                        checked={takeoverCriteria.auto_notify_agent}
                        onCheckedChange={(auto_notify_agent) => setTakeoverCriteria((current) => ({ ...current, auto_notify_agent }))}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
                  <h4 className="font-medium text-sm sm:text-base">Handoff Messages</h4>

                  <div className="space-y-2">
                    <Label className="text-sm">Agent Takeover Message</Label>
                    <Textarea
                      placeholder="Message shown when agent takes over..."
                      className="min-h-[60px] sm:min-h-[80px] text-sm"
                      value={agentTakeoverMessage}
                      onChange={(event) => setAgentTakeoverMessage(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">AI Handback Message</Label>
                    <Textarea
                      placeholder="Message shown when AI resumes..."
                      className="min-h-[60px] sm:min-h-[80px] text-sm"
                      value={aiHandbackMessage}
                      onChange={(event) => setAiHandbackMessage(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Use {'{agent_name}'} to include the AI agent's name.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-3 sm:pt-4 border-t">
                  <Button onClick={onSaveTakeover} disabled={isSavingTakeover || takeoverPromptMissing} size="sm" className="sm:h-10">
                    {isSavingTakeover ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    <span className="hidden sm:inline">Save Takeover Config</span>
                    <span className="sm:hidden">Save</span>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="handback" className="space-y-4 sm:space-y-6 mt-4">
                <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-3">
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm sm:text-base">Enable AI Handback</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">Auto-return control to AI when criteria are met</p>
                  </div>
                  <Switch
                    checked={handbackCriteria.enabled}
                    onCheckedChange={(enabled) => setHandbackCriteria((current) => ({ ...current, enabled }))}
                  />
                </div>

                {handbackCriteria.enabled && (
                  <>
                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-sm">Handback Automation Prompt</Label>
                      <Textarea
                          placeholder={`Example: Return the conversation to ${agentLabel} after the human agent resolves the exception and the contact confirms they can continue with the AI.`}
                        className="min-h-[80px] sm:min-h-[100px] text-sm"
                        value={handbackCriteria.criteria_prompt}
                        onChange={(event) => setHandbackCriteria((current) => ({ ...current, criteria_prompt: event.target.value }))}
                      />
                        {handbackPromptMissing && (
                          <p className="text-xs text-destructive">A handback criteria prompt is required when handback automation is enabled.</p>
                        )}
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                      <Label className="text-sm">Example Scenarios</Label>
                      <ul className="space-y-1.5 sm:space-y-2">
                        {handbackCriteria.examples.slice(0, 3).map((example, index) => (
                          <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 sm:line-clamp-none">{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between p-2.5 sm:p-3 border rounded-lg gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm">Auto-notify Team</p>
                        <p className="text-xs text-muted-foreground hidden sm:block">Notify when AI resumes control</p>
                      </div>
                      <Switch
                        checked={handbackCriteria.auto_notify}
                        onCheckedChange={(auto_notify) => setHandbackCriteria((current) => ({ ...current, auto_notify }))}
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end pt-3 sm:pt-4 border-t">
                  <Button onClick={onSaveHandback} disabled={isSavingHandback || handbackPromptMissing} size="sm" className="sm:h-10">
                    {isSavingHandback ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    <span className="hidden sm:inline">Save Handback Config</span>
                    <span className="sm:hidden">Save</span>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}