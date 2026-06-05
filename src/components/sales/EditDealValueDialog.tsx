import { useState } from 'react';
import { devError } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, TrendingUp } from 'lucide-react';
import { useUpdateDealValue } from '@/hooks/useUpdateDealValue';
import { useCurrencySymbol, useFormatCurrency } from '@/hooks/useMultiCurrency';
import { dealValueSchema } from '@/lib/validations';

export interface EditDealValueDialogProps {
  leadId: string;
  leadName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialValues?: {
    dealValue?: number;
    expectedCloseDate?: string;
    dealStage?: string;
    probability?: number;
  };
}

/**
 * Dialog for editing deal value, stage, and probability
 */
export function EditDealValueDialog({
  leadId,
  leadName,
  isOpen,
  onOpenChange,
  onSuccess,
  initialValues,
}: EditDealValueDialogProps) {
  const { updateDealValue, isLoading } = useUpdateDealValue();
  const currencySymbol = useCurrencySymbol();
  const formatCurrency = useFormatCurrency();
  const [formData, setFormData] = useState({
    dealValue: initialValues?.dealValue || 0,
    expectedCloseDate: initialValues?.expectedCloseDate || '',
    dealStage: initialValues?.dealStage || 'prospecting',
    probability: initialValues?.probability || 25,
  });

  const expectedRevenue = (formData.dealValue * formData.probability) / 100;

  const handleSave = async () => {
    try {
      // Validate using schema
      dealValueSchema.parse(formData);

      // Cast dealStage to proper enum type
      const typedFormData = {
        ...formData,
        dealStage: formData.dealStage as
          | 'prospecting'
          | 'qualification'
          | 'proposal'
          | 'negotiation'
          | 'closed_won'
          | 'closed_lost',
      };

      const success = await updateDealValue(leadId, typedFormData);
      if (success) {
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err) {
      devError('Validation error:', err);
    }
  };

  const dealStageLabels: Record<string, string> = {
    prospecting: '🎯 Prospecting',
    qualification: '📋 Qualification',
    proposal: '📄 Proposal',
    negotiation: '🤝 Negotiation',
    closed_won: '✅ Closed Won',
    closed_lost: '❌ Closed Lost',
  };

  const dealStageColors: Record<string, string> = {
    prospecting: 'bg-blue-100 text-blue-900',
    qualification: 'bg-purple-100 text-purple-900',
    proposal: 'bg-orange-100 text-orange-900',
    negotiation: 'bg-yellow-100 text-yellow-900',
    closed_won: 'bg-green-100 text-green-900',
    closed_lost: 'bg-red-100 text-red-900',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Deal Value Tracking
          </DialogTitle>
          <DialogDescription>
            Update deal information for {leadName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Deal Value */}
          <div className="space-y-2">
            <Label htmlFor="dealValue">Deal Value ({currencySymbol})</Label>
            <Input
              id="dealValue"
              type="number"
              min="0"
              step="1000"
              value={formData.dealValue}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  dealValue: parseInt(e.target.value) || 0,
                }))
              }
              placeholder="0"
            />
          </div>

          {/* Expected Close Date */}
          <div className="space-y-2">
            <Label htmlFor="closeDate">Expected Close Date</Label>
            <Input
              id="closeDate"
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  expectedCloseDate: e.target.value,
                }))
              }
            />
          </div>

          {/* Deal Stage */}
          <div className="space-y-2">
            <Label htmlFor="stage">Deal Stage</Label>
            <Select
              value={formData.dealStage}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  dealStage: value,
                }))
              }
            >
              <SelectTrigger id="stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospecting">🎯 Prospecting</SelectItem>
                <SelectItem value="qualification">📋 Qualification</SelectItem>
                <SelectItem value="proposal">📄 Proposal</SelectItem>
                <SelectItem value="negotiation">🤝 Negotiation</SelectItem>
                <SelectItem value="closed_won">✅ Closed Won</SelectItem>
                <SelectItem value="closed_lost">❌ Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Win Probability */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Win Probability: {formData.probability}%</Label>
            </div>
            <Slider
              value={[formData.probability]}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  probability: value[0],
                }))
              }
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex gap-2 text-xs">
              <span className="text-muted-foreground">0%</span>
              <span className="text-muted-foreground ml-auto">100%</span>
            </div>
          </div>

          {/* Expected Revenue (Calculated) */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-muted-foreground mb-1">Expected Revenue</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(expectedRevenue)}
            </p>
            <p className="text-xs text-green-600 mt-2">
              Deal Value × Win Probability = {formatCurrency(formData.dealValue)} × {formData.probability}%
            </p>
          </div>

          {/* Current Stage Indicator */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Current Stage</Label>
            <div
              className={`p-3 rounded-md text-center font-medium ${
                dealStageColors[formData.dealStage]
              }`}
            >
              {dealStageLabels[formData.dealStage]}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
