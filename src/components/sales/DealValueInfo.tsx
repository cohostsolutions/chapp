import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditDealValueDialog } from './EditDealValueDialog';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { TrendingUp, Calendar, Percent, AlertCircle } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

export interface DealValueInfoProps {
  leadId: string;
  leadName: string;
  dealValue?: number;
  expectedCloseDate?: string;
  dealStage?: string;
  probability?: number;
  expectedRevenue?: number;
  onUpdate?: () => void;
}

/**
 * Display deal value, stage, and expected close date
 */
export function DealValueInfo({
  leadId,
  leadName,
  dealValue = 0,
  expectedCloseDate,
  dealStage = 'prospecting',
  probability = 25,
  expectedRevenue = 0,
  onUpdate,
}: DealValueInfoProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const formatCurrency = useFormatCurrency();

  const dealStageColors: Record<string, string> = {
    prospecting: 'bg-blue-100 text-blue-900',
    qualification: 'bg-purple-100 text-purple-900',
    proposal: 'bg-orange-100 text-orange-900',
    negotiation: 'bg-yellow-100 text-yellow-900',
    closed_won: 'bg-green-100 text-green-900',
    closed_lost: 'bg-red-100 text-red-900',
  };

  const dealStageEmoji: Record<string, string> = {
    prospecting: '🎯',
    qualification: '📋',
    proposal: '📄',
    negotiation: '🤝',
    closed_won: '✅',
    closed_lost: '❌',
  };

  const isOverdue = expectedCloseDate && isPast(new Date(expectedCloseDate));

  // Show minimal info if no deal value set
  if (dealValue === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowEditDialog(true)}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="w-4 h-4" />
        Add deal value
      </Button>
    );
  }

  return (
    <>
      <Card className="p-3 bg-gradient-to-r from-slate-50 to-blue-50 border-blue-200">
        <div className="space-y-3">
          {/* Deal Value Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(dealValue)}
              </p>
              <p className="text-xs text-slate-600">Deal Value</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="h-8 w-8 p-0"
              title="Edit deal"
            >
              ✏️
            </Button>
          </div>

          {/* Expected Revenue */}
          {expectedRevenue > 0 && (
            <div className="pt-2 border-t border-blue-200">
              <p className="text-xs text-slate-600 mb-1">Expected Revenue</p>
              <p className="text-sm font-semibold text-green-700">
                {formatCurrency(Math.round(expectedRevenue))}
              </p>
            </div>
          )}

          {/* Deal Stage */}
          <Badge
            variant="secondary"
            className={`w-full justify-center font-medium ${dealStageColors[dealStage]}`}
          >
            {dealStageEmoji[dealStage]} {dealStage.replace(/_/g, ' ').toUpperCase()}
          </Badge>

          {/* Win Probability */}
          <div className="flex items-center gap-2 pt-2">
            <Percent className="w-4 h-4 text-slate-600" />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Win Probability</span>
                <span className="font-semibold text-slate-900">{probability}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                  style={{ width: `${probability}%` }}
                />
              </div>
            </div>
          </div>

          {/* Expected Close Date */}
          {expectedCloseDate && (
            <div className="flex items-center gap-2 pt-2">
              {isOverdue ? (
                <AlertCircle className="w-4 h-4 text-red-600" />
              ) : (
                <Calendar className="w-4 h-4 text-slate-600" />
              )}
              <div className="text-xs">
                <p className={isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                  {isOverdue ? 'OVERDUE' : 'Expected Close'}
                </p>
                <p className={isOverdue ? 'text-red-500' : 'text-slate-700'}>
                  {format(new Date(expectedCloseDate), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDistanceToNow(new Date(expectedCloseDate), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <EditDealValueDialog
        leadId={leadId}
        leadName={leadName}
        isOpen={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={onUpdate}
        initialValues={{
          dealValue,
          expectedCloseDate,
          dealStage,
          probability,
        }}
      />
    </>
  );
}
