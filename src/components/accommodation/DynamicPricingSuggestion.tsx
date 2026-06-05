import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import type { DynamicPricingSuggestion } from "@/lib/bookingPricing";

interface DynamicPricingSuggestionProps {
  suggestion: DynamicPricingSuggestion;
  formatCurrency: (amount: number) => string;
}

export function DynamicPricingSuggestionComponent({ 
  suggestion, 
  formatCurrency 
}: DynamicPricingSuggestionProps) {
  const priceDifference = suggestion.suggestedPrice - suggestion.basePrice;
  const percentDifference = ((priceDifference / suggestion.basePrice) * 100).toFixed(1);
  const isIncrease = priceDifference > 0;
  const isDecrease = priceDifference < 0;
  const isUnchanged = priceDifference === 0;

  // Determine icon
  const getIcon = () => {
    if (isIncrease) return <TrendingUp className="h-4 w-4" />;
    if (isDecrease) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getOccupancyColor = () => {
    if (suggestion.occupancyRate >= 80) return "bg-red-100 text-red-800 border-red-200";
    if (suggestion.occupancyRate >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  return (
    <Alert 
      className={`border-2 ${
        isIncrease ? 'border-blue-200 bg-blue-50' : 
        isDecrease ? 'border-green-200 bg-green-50' : 
        'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <Sparkles className="h-5 w-5 text-purple-600" />
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              Dynamic Pricing Suggestion
            </span>
            {getIcon()}
          </div>

          <AlertDescription className="space-y-2">
            {/* Price comparison */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-gray-500">Base Price:</span>
                <span className="text-sm font-medium text-gray-700">
                  {formatCurrency(suggestion.basePrice)}
                </span>
              </div>
              
              <span className="text-gray-400">→</span>
              
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-gray-500">Suggested Price:</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(suggestion.suggestedPrice)}
                </span>
              </div>

              {!isUnchanged && (
                <Badge 
                  variant="outline" 
                  className={`${
                    isIncrease ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                    'bg-green-100 text-green-800 border-green-200'
                  }`}
                >
                  {isIncrease ? '+' : ''}{percentDifference}%
                </Badge>
              )}
            </div>

            {/* Adjustment reason */}
            <div className="text-xs text-gray-600 italic">
              {suggestion.adjustmentReason}
            </div>

            {/* Metrics badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className={getOccupancyColor()}>
                Occupancy: {suggestion.occupancyRate.toFixed(1)}%
              </Badge>
              
              {suggestion.occupancyMultiplier !== 1.0 && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                  Demand: {((suggestion.occupancyMultiplier - 1) * 100).toFixed(0) > '0' ? '+' : ''}
                  {((suggestion.occupancyMultiplier - 1) * 100).toFixed(0)}%
                </Badge>
              )}
              
              {suggestion.seasonalMultiplier !== 1.0 && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  Seasonal: {((suggestion.seasonalMultiplier - 1) * 100).toFixed(0) > '0' ? '+' : ''}
                  {((suggestion.seasonalMultiplier - 1) * 100).toFixed(0)}%
                </Badge>
              )}

              {suggestion.locationMultiplier !== 1.0 && (
                <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-200">
                  Market: {((suggestion.locationMultiplier - 1) * 100).toFixed(0) > '0' ? '+' : ''}
                  {((suggestion.locationMultiplier - 1) * 100).toFixed(0)}%
                </Badge>
              )}

              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                {suggestion.marketPositioning}
              </Badge>
            </div>

            {suggestion.locationSummary && (
              <div className="text-xs text-gray-500">
                Market context: {suggestion.locationSummary}
              </div>
            )}

            {/* Helpful tip */}
            {isDecrease && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2 mt-2">
                💡 Lower demand detected. Consider offering this discounted rate to increase occupancy.
              </div>
            )}
            
            {isIncrease && suggestion.occupancyRate >= 80 && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                💡 High demand period. You can maximize revenue with this premium pricing.
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
