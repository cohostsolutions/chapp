import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, LayoutGrid, RotateCcw, Save, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Widget {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface WidgetCustomizerProps {
  widgets: Widget[];
  selectedWidgets: string[];
  onToggle: (widgetId: string) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
}

export function WidgetCustomizer({
  widgets,
  selectedWidgets,
  onToggle,
  onSave,
  onReset,
  isSaving = false,
}: WidgetCustomizerProps) {
  return (
    <Card className="glass border-primary/50 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Customize Dashboard</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {selectedWidgets.length} / {widgets.length} active
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Toggle widgets on or off to personalize your dashboard view
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {widgets.map((widget) => {
            const isSelected = selectedWidgets.includes(widget.id);
            return (
              <div
                key={widget.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                  isSelected 
                    ? "border-primary/50 bg-primary/5" 
                    : "border-border hover:border-muted-foreground/30"
                )}
                onClick={() => onToggle(widget.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-md",
                    isSelected ? "bg-primary/10" : "bg-muted"
                  )}>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{widget.label}</p>
                    {widget.description && (
                      <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={isSelected}
                  onCheckedChange={() => onToggle(widget.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button 
            onClick={onReset} 
            disabled={isSaving} 
            variant="ghost" 
            size="sm"
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
          <Button 
            onClick={onSave} 
            disabled={isSaving} 
            size="sm"
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Layout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
