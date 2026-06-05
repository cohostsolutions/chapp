import { useState } from 'react';
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow, useWorkflowRuns, WORKFLOW_TEMPLATES } from '@/hooks/useWorkflows';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EnhancedEmptyState, InlineEmptyState } from '@/components/shared/EnhancedEmptyState';
import { Loader2, Plus, Trash2, Edit, Zap, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

export default function Workflows() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || '';
  
  const { data: workflows, isLoading } = useWorkflows(organizationId);
  const createWorkflow = useCreateWorkflow(organizationId);
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [selectedWorkflowForRuns, setSelectedWorkflowForRuns] = useState<string | null>(null);

  const handleCreateFromTemplate = () => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate);
    if (!template) return;

    createWorkflow.mutate({
      name: workflowName || template.name,
      description: workflowDescription || template.description,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config as Json,
      actions: template.actions as Json,
      is_active: true,
    });

    setIsCreateOpen(false);
    setWorkflowName('');
    setWorkflowDescription('');
    setSelectedTemplate('');
  };

  const handleToggleActive = (workflowId: string, currentStatus: boolean) => {
    updateWorkflow.mutate({ id: workflowId, is_active: !currentStatus });
  };

  const handleDelete = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow? It will remain recoverable from Deleted Items for 5 hours, then it will be permanently removed.')) {
      deleteWorkflow.mutate(workflowId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Automation</h1>
          <p className="text-muted-foreground">Automate repetitive tasks and streamline your processes</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Workflow</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>Start with a template or build your own automation</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger id="template"><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_TEMPLATES.map((template) => (
                      <SelectItem key={template.name} value={template.name}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplate && (
                <>
                  <div>
                    <Label htmlFor="name">Workflow Name</Label>
                    <Input id="name" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder={WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate)?.name} />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} placeholder={WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate)?.description} />
                  </div>
                  <Button onClick={handleCreateFromTemplate} disabled={createWorkflow.isPending} className="w-full">
                    {createWorkflow.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                    Create Workflow
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          {workflows && workflows.length === 0 ? (
            <EnhancedEmptyState
              type="custom"
              title="No workflows yet"
              description="Get started by creating your first automation workflow"
              icon={Zap}
              action={{
                label: "Create Workflow",
                onClick: () => setIsCreateOpen(true),
                icon: Plus,
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workflows?.map((workflow) => (
                <Card key={workflow.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg truncate">{workflow.name}</CardTitle>
                          <Badge variant={workflow.is_active ? 'default' : 'secondary'}>{workflow.is_active ? 'Active' : 'Inactive'}</Badge>
                        </div>
                        <CardDescription className="mt-1 line-clamp-2">{workflow.description || 'No description'}</CardDescription>
                      </div>
                      <Switch checked={workflow.is_active} onCheckedChange={() => handleToggleActive(workflow.id, workflow.is_active)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Trigger</p><p className="font-medium capitalize">{workflow.trigger_type?.replace(/_/g, ' ')}</p></div>
                      <div><p className="text-muted-foreground">Actions</p><p className="font-medium">{Array.isArray(workflow.actions) ? workflow.actions.length : 0} steps</p></div>
                      <div><p className="text-muted-foreground">Runs</p><p className="font-medium">{workflow.run_count || 0}</p></div>
                      <div><p className="text-muted-foreground">Last Run</p><p className="font-medium text-xs">{workflow.last_run_at ? format(new Date(workflow.last_run_at), 'MMM d, yyyy') : 'Never'}</p></div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedWorkflowForRuns(workflow.id)}><Clock className="h-4 w-4 mr-1" />History</Button>
                      <Button variant="outline" size="sm"><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(workflow.id)} disabled={deleteWorkflow.isPending}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Recent Workflow Runs</CardTitle><CardDescription>View the execution history of your workflows</CardDescription></CardHeader>
            <CardContent>
              {selectedWorkflowForRuns ? <WorkflowRunsTable workflowId={selectedWorkflowForRuns} /> : <div className="text-center py-8 text-muted-foreground">Select a workflow to view its run history</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WorkflowRunsTable({ workflowId }: { workflowId: string }) {
  const { data: runs, isLoading } = useWorkflowRuns(workflowId);

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!runs || runs.length === 0) return <InlineEmptyState message="No runs recorded yet" />;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Completed</TableHead>
          <TableHead>Steps</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell><div className="flex items-center gap-2">{getStatusIcon(run.status)}<span className="capitalize">{run.status}</span></div></TableCell>
            <TableCell>{format(new Date(run.started_at), 'MMM d, yyyy HH:mm')}</TableCell>
            <TableCell>{run.completed_at ? format(new Date(run.completed_at), 'MMM d, yyyy HH:mm') : '-'}</TableCell>
            <TableCell>{run.steps_completed || 0}</TableCell>
            <TableCell className="max-w-[200px] truncate">{run.error_message || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
