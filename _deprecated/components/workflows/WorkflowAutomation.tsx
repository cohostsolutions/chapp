import { useState } from 'react';
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow, useExecuteWorkflow, WORKFLOW_TEMPLATES } from '@/hooks/useWorkflows';
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
import { Loader2, Plus, Play, Trash2, Edit, Zap } from 'lucide-react';

export function WorkflowAutomation() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || '';
  
  const { data: workflows, isLoading } = useWorkflows(organizationId);
  const createWorkflow = useCreateWorkflow(organizationId);
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');

  const handleCreateFromTemplate = () => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate);
    if (!template) return;

    createWorkflow.mutate({
      name: workflowName || template.name,
      description: workflowDescription || template.description,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config,
      actions: template.actions,
      is_active: true,
    });

    setIsCreateOpen(false);
    setWorkflowName('');
    setWorkflowDescription('');
    setSelectedTemplate('');
  };

  const handleToggleActive = (workflowId: string, currentStatus: boolean) => {
    updateWorkflow.mutate({
      id: workflowId,
      is_active: !currentStatus,
    });
  };

  const handleExecute = (workflowId: string) => {
    executeWorkflow.mutate({ workflowId });
  };

  const handleDelete = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
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
          <h2 className="text-3xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">
            Automate repetitive tasks and streamline your processes
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>
                Start with a template or build your own automation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_TEMPLATES.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <>
                  <div>
                    <Label htmlFor="name">Workflow Name</Label>
                    <Input
                      id="name"
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      placeholder={
                        WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate)?.name
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={workflowDescription}
                      onChange={(e) => setWorkflowDescription(e.target.value)}
                      placeholder={
                        WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate)?.description
                      }
                    />
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2">Template Details</h4>
                    {WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate) && (
                      <div className="text-sm space-y-2">
                        <p>
                          <span className="font-medium">Trigger:</span>{' '}
                          {WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate)
                            ?.trigger_type?.replace(/_/g, ' ')}
                        </p>
                        <p>
                          <span className="font-medium">Actions:</span>{' '}
                          {WORKFLOW_TEMPLATES.find((t) => t.name === selectedTemplate)
                            ?.actions.length}{' '}
                          steps
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={createWorkflow.isPending}
                    className="w-full"
                  >
                    {createWorkflow.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Create Workflow
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workflows && workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first automation workflow
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workflows?.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      {workflow.description}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={workflow.is_active}
                    onCheckedChange={() => handleToggleActive(workflow.id, workflow.is_active)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Trigger</p>
                    <p className="font-medium capitalize">
                      {workflow.trigger_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actions</p>
                    <p className="font-medium">
                      {(workflow.actions as unknown as unknown[])?.length || 0} steps
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Executions</p>
                    <p className="font-medium">{workflow.run_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Run</p>
                    <p className="font-medium">
                      {workflow.last_run_at
                        ? new Date(workflow.last_run_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecute(workflow.id)}
                    disabled={executeWorkflow.isPending}
                  >
                    {executeWorkflow.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(workflow.id)}
                    disabled={deleteWorkflow.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
