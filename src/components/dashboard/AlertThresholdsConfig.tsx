import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Settings2, 
  Save, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Threshold {
  id: string;
  threshold_name: string;
  warning_value: number;
  critical_value: number;
  description: string | null;
}

export function AlertThresholdsConfig() {
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [editedThresholds, setEditedThresholds] = useState<Record<string, { warning: number; critical: number }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchThresholds = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('health_check_thresholds')
        .select('*')
        .order('threshold_name');

      if (error) throw error;

      setThresholds(data || []);
      const edited: Record<string, { warning: number; critical: number }> = {};
      (data || []).forEach((t: Threshold) => {
        edited[t.id] = { warning: t.warning_value, critical: t.critical_value };
      });
      setEditedThresholds(edited);
    } catch (error) {
      devError('Error fetching thresholds:', error);
      toast.error('Failed to load thresholds');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

  const handleValueChange = (id: string, type: 'warning' | 'critical', value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedThresholds(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [type]: numValue,
      },
    }));
  };

  const hasChanges = (threshold: Threshold) => {
    const edited = editedThresholds[threshold.id];
    if (!edited) return false;
    return edited.warning !== threshold.warning_value || edited.critical !== threshold.critical_value;
  };

  const saveThreshold = async (threshold: Threshold) => {
    const edited = editedThresholds[threshold.id];
    if (!edited || !hasChanges(threshold)) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('health_check_thresholds')
        .update({
          warning_value: edited.warning,
          critical_value: edited.critical,
        })
        .eq('id', threshold.id);

      if (error) throw error;

      toast.success(`Updated ${formatThresholdName(threshold.threshold_name)}`);
      await fetchThresholds();
    } catch (error) {
      devError('Error saving threshold:', error);
      toast.error('Failed to save threshold');
    } finally {
      setIsSaving(false);
    }
  };

  const saveAllChanges = async () => {
    const changedThresholds = thresholds.filter(hasChanges);
    if (changedThresholds.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    try {
      for (const threshold of changedThresholds) {
        const edited = editedThresholds[threshold.id];
        const { error } = await supabase
          .from('health_check_thresholds')
          .update({
            warning_value: edited.warning,
            critical_value: edited.critical,
          })
          .eq('id', threshold.id);

        if (error) throw error;
      }

      toast.success(`Updated ${changedThresholds.length} threshold(s)`);
      await fetchThresholds();
    } catch (error) {
      devError('Error saving thresholds:', error);
      toast.error('Failed to save thresholds');
    } finally {
      setIsSaving(false);
    }
  };

  const formatThresholdName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getThresholdIcon = (name: string) => {
    if (name.includes('login')) return '🔐';
    if (name.includes('secret')) return '🔑';
    if (name.includes('table')) return '📊';
    if (name.includes('query')) return '⚡';
    if (name.includes('backlog')) return '📬';
    if (name.includes('score')) return '💯';
    return '📈';
  };

  const changedCount = thresholds.filter(hasChanges).length;

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Alert Thresholds Configuration
            </CardTitle>
            <CardDescription>
              Customize when health check alerts are triggered
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchThresholds}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {changedCount > 0 && (
              <Button
                size="sm"
                onClick={saveAllChanges}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-1" />
                Save All ({changedCount})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {thresholds.map((threshold) => (
            <div
              key={threshold.id}
              className={`p-4 rounded-lg border transition-colors ${
                hasChanges(threshold) 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border/50 bg-muted/20'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getThresholdIcon(threshold.threshold_name)}</span>
                  <div>
                    <h4 className="font-medium text-foreground">
                      {formatThresholdName(threshold.threshold_name)}
                    </h4>
                    {threshold.description && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {threshold.description}
                      </p>
                    )}
                  </div>
                </div>
                {hasChanges(threshold) && (
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    Modified
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1 text-warning">
                    <AlertTriangle className="w-3 h-3" />
                    Warning Threshold
                  </Label>
                  <Input
                    type="number"
                    value={editedThresholds[threshold.id]?.warning ?? threshold.warning_value}
                    onChange={(e) => handleValueChange(threshold.id, 'warning', e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1 text-destructive">
                    <AlertTriangle className="w-3 h-3" />
                    Critical Threshold
                  </Label>
                  <Input
                    type="number"
                    value={editedThresholds[threshold.id]?.critical ?? threshold.critical_value}
                    onChange={(e) => handleValueChange(threshold.id, 'critical', e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>

              {hasChanges(threshold) && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => saveThreshold(threshold)}
                    disabled={isSaving}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          ))}

          {thresholds.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No thresholds configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
