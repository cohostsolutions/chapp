import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeadScoringConfig, useUpdateScoringConfig, DEFAULT_SCORING_CRITERIA } from '@/hooks/useLeadScoring';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, RefreshCw } from 'lucide-react';

interface ScoringCriteria {
  [category: string]: {
    [criterion: string]: number;
  };
}

export function LeadScoringConfig() {
  const { profile, roles } = useAuth();
  const organizationId = profile?.organization_id;
  
  const { data: config, isLoading } = useLeadScoringConfig(organizationId || '');
  const updateConfig = useUpdateScoringConfig(organizationId || '');
  
  const [criteria, setCriteria] = useState<ScoringCriteria>(
    (config?.criteria as any) ?? DEFAULT_SCORING_CRITERIA
  );
  const [isActive, setIsActive] = useState(config?.is_active ?? true);

  const canEdit = roles.includes('client_admin') || roles.includes('super_admin');

  const handleSave = () => {
    updateConfig.mutate({
      criteria,
      weights: {}, // Can be extended for weighted categories
      is_active: isActive,
    });
  };

  const handleReset = () => {
    setCriteria(DEFAULT_SCORING_CRITERIA);
  };

  const handleCriterionChange = (category: string, criterion: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [criterion]: Math.min(Math.max(numValue, 0), 100),
      },
    }));
  };

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Scoring Configuration</CardTitle>
          <CardDescription>
            You don't have permission to edit lead scoring configuration.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lead Scoring Configuration</CardTitle>
            <CardDescription>
              Configure how leads are scored and prioritized using AI-powered predictions
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="engagement" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="demographic">Demographic</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="firmographic">Firmographic</TabsTrigger>
          </TabsList>

          {Object.entries(criteria).map(([category, criteriaItems]) => (
            <TabsContent key={category} value={category} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(criteriaItems).map(([criterion, value]) => (
                  <div key={criterion} className="space-y-2">
                    <Label htmlFor={`${category}-${criterion}`} className="capitalize">
                      {criterion.replace(/_/g, ' ')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${category}-${criterion}`}
                        type="number"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) =>
                          handleCriterionChange(category, criterion, e.target.value)
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">points</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">How Lead Scoring Works</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Each criterion contributes points to the overall lead score (0-100)</li>
            <li>• Higher scores indicate leads more likely to convert</li>
            <li>• AI analyzes historical data to predict conversion probability</li>
            <li>• Scores are automatically recalculated when lead data changes</li>
            <li>• Use scores to prioritize follow-ups and automate workflows</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
