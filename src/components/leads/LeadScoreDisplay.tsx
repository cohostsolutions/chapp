import { useLeadScore, useLeadPrediction, useCalculateLeadScore } from '@/hooks/useLeadScoring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, RefreshCw, Loader2, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LeadScoreDisplayProps {
  leadId: string;
  organizationId: string;
}

export function LeadScoreDisplay({ leadId, organizationId }: LeadScoreDisplayProps) {
  const { data: score, isLoading: scoreLoading } = useLeadScore(leadId);
  const { data: prediction, isLoading: predictionLoading } = useLeadPrediction(leadId);
  const calculateScore = useCalculateLeadScore();

  const handleRecalculate = () => {
    calculateScore.mutate({ leadId, organizationId });
  };

  if (scoreLoading || predictionLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const scoreValue = score?.score || 0;
  const conversionProb = prediction?.conversion_probability || 0;
  const confidenceLevel = prediction?.confidence_level || 'low';

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (level: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      high: 'default',
      medium: 'secondary',
      low: 'destructive',
    };
    return variants[level] || 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Lead Score
            </CardTitle>
            <CardDescription>
              AI-powered prediction based on lead behavior and attributes
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={calculateScore.isPending}
          >
            {calculateScore.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="text-center">
          <div className={`text-6xl font-bold ${getScoreColor(scoreValue)}`}>
            {scoreValue}
          </div>
          <p className="text-sm text-muted-foreground mt-1">out of 100</p>
          <Progress value={scoreValue} className="mt-4 h-2" />
        </div>

        {/* Conversion Probability */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm font-medium">Conversion Probability</p>
            <p className="text-2xl font-bold mt-1">
              {(conversionProb * 100).toFixed(1)}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            {conversionProb >= 0.7 ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Prediction Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Confidence</p>
            <Badge variant={getConfidenceBadge(confidenceLevel)} className="mt-1 capitalize">
              {confidenceLevel}
            </Badge>
          </div>
          {prediction?.predicted_value && (
            <div>
              <p className="text-sm text-muted-foreground">Predicted Value</p>
              <p className="text-lg font-semibold mt-1">
                ${prediction.predicted_value.toLocaleString()}
              </p>
            </div>
          )}
          {prediction?.predicted_close_date && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Expected Close Date</p>
              <p className="text-lg font-semibold mt-1">
                {new Date(prediction.predicted_close_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        {score?.prediction_data && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Score Breakdown</p>
            <div className="space-y-2">
              {Object.entries(score.prediction_data as Record<string, number>).map(
                ([factor, value]) => (
                  <div key={factor} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{factor.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{value} pts</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Last Updated */}
        {score?.calculated_at && (
          <p className="text-xs text-muted-foreground text-center">
            Last updated {formatDistanceToNow(new Date(score.calculated_at), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
