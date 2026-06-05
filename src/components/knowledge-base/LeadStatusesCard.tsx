import type React from 'react';
import { ChevronRight, Loader2, Plus, Save, Tag, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { CustomLeadStatuses } from '@/hooks/useKnowledgeBaseSettings';

interface LeadStatusesCardProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  customLeadStatuses: CustomLeadStatuses;
  handleToggleDefaultStatus: (status: string, enabled: boolean) => void;
  handleRemoveCustomStatus: (id: string) => void;
  newStatusName: string;
  setNewStatusName: (name: string) => void;
  newStatusColor: string;
  setNewStatusColor: (color: string) => void;
  handleAddCustomStatus: () => void;
  isSaving: boolean;
  onSave: () => void;
}

function badgeClass(color: string) {
  if (color === 'primary') return 'bg-primary/20 text-primary border-primary/30';
  if (color === 'warning') return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
  if (color === 'success') return 'bg-green-500/20 text-green-600 border-green-500/30';
  if (color === 'destructive') return 'bg-destructive/20 text-destructive border-destructive/30';
  if (color === 'purple') return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
  if (color === 'blue') return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
  return 'bg-muted text-muted-foreground';
}

export function LeadStatusesCard({
  expanded,
  onExpandedChange,
  customLeadStatuses,
  handleToggleDefaultStatus,
  handleRemoveCustomStatus,
  newStatusName,
  setNewStatusName,
  newStatusColor,
  setNewStatusColor,
  handleAddCustomStatus,
  isSaving,
  onSave,
}: LeadStatusesCardProps) {
  return (
    <Card className={`border-primary/20 ${expanded ? 'lg:col-span-2' : ''}`}>
      <Collapsible open={expanded} onOpenChange={onExpandedChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-2.5 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 shrink-0">
                  <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-lg">Lead Workflow</CardTitle>
                  <CardDescription className="text-xs sm:text-sm line-clamp-1">
                    Sales pipeline status configuration
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Badge variant="outline" className="text-xs px-1.5 sm:px-2.5">
                  {Object.values(customLeadStatuses.default_statuses).filter((status) => status.enabled).length + customLeadStatuses.custom_statuses.length} active
                </Badge>
                <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Default Statuses</Label>
              <p className="text-xs text-muted-foreground">Toggle which default statuses to use in your pipeline</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(customLeadStatuses.default_statuses).map(([status, config]) => (
                  <div key={status} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`capitalize ${badgeClass(config.color)}`}>
                        {status}
                      </Badge>
                    </div>
                    <Switch checked={config.enabled} onCheckedChange={(checked) => handleToggleDefaultStatus(status, checked)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Custom Statuses</Label>
              <p className="text-xs text-muted-foreground">Add your own statuses to fit your sales process</p>

              {customLeadStatuses.custom_statuses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customLeadStatuses.custom_statuses.map((status) => (
                    <Badge key={status.id} variant="outline" className={`capitalize gap-1 ${badgeClass(status.color)}`}>
                      {status.name.replace(/_/g, ' ')}
                      <button onClick={() => handleRemoveCustomStatus(status.id)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="New status name"
                  value={newStatusName}
                  onChange={(event) => setNewStatusName(event.target.value)}
                  className="max-w-[200px]"
                />
                <Select value={newStatusColor} onValueChange={setNewStatusColor}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="success">Green</SelectItem>
                    <SelectItem value="warning">Amber</SelectItem>
                    <SelectItem value="destructive">Red</SelectItem>
                    <SelectItem value="purple">Purple</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddCustomStatus} disabled={!newStatusName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Status Configuration
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}