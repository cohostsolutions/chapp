import { useState, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Clock, DollarSign, TrendingUp, Bot, Sparkles, Globe } from 'lucide-react';

interface ROICalculatorProps {
  formatPrice?: (price: number) => string;
  currency?: string;
  currencyRates?: Record<string, { rate: number; symbol: string; name: string }>;
}

const defaultCurrencyRates: Record<string, { rate: number; symbol: string; name: string }> = {
  USD: { rate: 1, symbol: '$', name: 'US Dollar' },
  PHP: { rate: 56, symbol: '₱', name: 'Philippine Peso' },
  EUR: { rate: 0.92, symbol: '€', name: 'Euro' },
  GBP: { rate: 0.79, symbol: '£', name: 'British Pound' },
  SGD: { rate: 1.34, symbol: 'S$', name: 'Singapore Dollar' },
  AUD: { rate: 1.53, symbol: 'A$', name: 'Australian Dollar' },
  JPY: { rate: 149, symbol: '¥', name: 'Japanese Yen' },
};

export function ROICalculator({ 
  formatPrice: externalFormatPrice, 
  currency: externalCurrency, 
  currencyRates: externalRates 
}: ROICalculatorProps) {
  const [internalCurrency, setInternalCurrency] = useState('USD');
  const [monthlyConversations, setMonthlyConversations] = useState([2000]);
  const [avgHandleTime, setAvgHandleTime] = useState([15]); // minutes
  const [agentHourlyCostUSD, setAgentHourlyCostUSD] = useState([15]); // USD per hour (base)
  const [agentMonthlySalaryUSD, setAgentMonthlySalaryUSD] = useState([2400]); // USD per month (base, ~$15/hr * 160hrs)

  // Use internal or external currency/rates
  const currency = externalCurrency || internalCurrency;
  const currencyRates = externalRates || defaultCurrencyRates;
  const setCurrency = externalCurrency ? undefined : setInternalCurrency;
  
  // Determine if we should show monthly salary instead of hourly cost
  const useMonthlyMode = currency === 'PHP' || currency === 'JPY';

  // Round up: PHP and JPY to next 1000, others to next 10
  const roundPrice = (price: number, currencyCode: string) => {
    if (currencyCode === 'PHP' || currencyCode === 'JPY') {
      return Math.ceil(price / 1000) * 1000;
    }
    return Math.ceil(price / 10) * 10;
  };

  const formatPrice = externalFormatPrice || ((usdPrice: number) => {
    const { rate, symbol } = currencyRates[currency];
    const converted = usdPrice * rate;
    const rounded = currency === 'USD' ? Math.round(converted) : roundPrice(converted, currency);
    return `${symbol}${rounded.toLocaleString()}`;
  });

  const calculations = useMemo(() => {
    const conversations = monthlyConversations[0];
    const handleTimeMinutes = avgHandleTime[0];
    
    // Calculate hourly rate from monthly salary if in monthly mode
    const hourlyRateUSD = useMonthlyMode 
      ? agentMonthlySalaryUSD[0] / 160 // Convert monthly to hourly (160 hours/month)
      : agentHourlyCostUSD[0];

    // Manual customer service costs (calculated in USD)
    const totalHoursNeeded = (conversations * handleTimeMinutes) / 60;
    const monthlyAgentCost = useMonthlyMode
      ? agentMonthlySalaryUSD[0] * Math.ceil(totalHoursNeeded / 160) // Monthly salary * agents needed
      : totalHoursNeeded * hourlyRateUSD;
    const agentsNeeded = Math.ceil(totalHoursNeeded / 160); // 160 hours per month per agent

    // AI costs (average of our plans)
    const avgAIMonthly = 299; // Average plan cost in USD

    // Savings
    const monthlySavings = monthlyAgentCost - avgAIMonthly;
    const annualSavings = monthlySavings * 12;
    const savingsPercent = monthlyAgentCost > 0 ? Math.round((monthlySavings / monthlyAgentCost) * 100) : 0;

    // Additional benefits
    const hoursReclaimed = totalHoursNeeded;
    const responseTimeImprovement = 95; // AI responds 95% faster

    return {
      conversations,
      totalHoursNeeded: Math.round(totalHoursNeeded),
      monthlyAgentCost: Math.round(monthlyAgentCost),
      agentsNeeded,
      avgAIMonthly,
      monthlySavings: Math.max(0, Math.round(monthlySavings)),
      annualSavings: Math.max(0, Math.round(annualSavings)),
      savingsPercent: Math.max(0, savingsPercent),
      hoursReclaimed: Math.round(hoursReclaimed),
      responseTimeImprovement,
    };
  }, [monthlyConversations, avgHandleTime, agentHourlyCostUSD, agentMonthlySalaryUSD, useMonthlyMode]);

  const getConvertedValue = (usdValue: number) => {
    const { rate } = currencyRates[currency];
    const converted = usdValue * rate;
    return currency === 'USD' ? Math.round(converted) : roundPrice(converted, currency);
  };

  return (
    <div className="space-y-8">
      {/* Currency Picker - only show if we're managing currency internally */}
      {setCurrency && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Currency:</span>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[140px] h-9" aria-label="Select currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(currencyRates).map(([code, { symbol, name }]) => (
                  <SelectItem key={code} value={code}>
                    {symbol} {code} - {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
        {/* Inputs */}
        <div className="space-y-4 sm:space-y-8">
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-card border border-border/50">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6">Your Current Situation</h3>
            
            <div className="space-y-4 sm:space-y-6">
            {/* Monthly Conversations */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="hidden sm:inline">Monthly Conversations</span>
                  <span className="sm:hidden">Conversations</span>
                </Label>
                <span className="text-sm sm:text-lg font-bold text-foreground tabular-nums">
                  {monthlyConversations[0].toLocaleString()}
                </span>
              </div>
              <Slider
                value={monthlyConversations}
                onValueChange={setMonthlyConversations}
                min={100}
                max={10000}
                step={100}
                className="w-full touch-pan-y"
                aria-label="Monthly conversations slider"
              />
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>100</span>
                <span>10,000</span>
              </div>
            </div>

            {/* Average Handle Time */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="hidden sm:inline">Avg. Handle Time (minutes)</span>
                  <span className="sm:hidden">Handle Time</span>
                </Label>
                <span className="text-sm sm:text-lg font-bold text-foreground tabular-nums">
                  {avgHandleTime[0]} min
                </span>
              </div>
              <Slider
                value={avgHandleTime}
                onValueChange={setAvgHandleTime}
                min={5}
                max={30}
                step={1}
                className="w-full touch-pan-y"
                aria-label="Average handle time slider"
              />
              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>5 min</span>
                <span>30 min</span>
              </div>
            </div>

            {/* Agent Cost - Monthly for PHP/JPY, Hourly for others */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="hidden sm:inline">{useMonthlyMode ? 'Agent Monthly Salary' : 'Agent Hourly Cost'}</span>
                  <span className="sm:hidden">{useMonthlyMode ? 'Monthly' : 'Hourly'} Cost</span>
                </Label>
                <span className="text-sm sm:text-lg font-bold text-foreground tabular-nums">
                  {useMonthlyMode 
                    ? `${currencyRates[currency].symbol}${getConvertedValue(agentMonthlySalaryUSD[0]).toLocaleString()}/mo`
                    : `${currencyRates[currency].symbol}${getConvertedValue(agentHourlyCostUSD[0]).toLocaleString()}/hr`
                  }
                </span>
              </div>
              {useMonthlyMode ? (
                <>
                  <Slider
                    value={agentMonthlySalaryUSD}
                    onValueChange={setAgentMonthlySalaryUSD}
                    min={500}
                    max={8000}
                    step={100}
                    className="w-full touch-pan-y"
                    aria-label="Agent monthly salary slider"
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>{currencyRates[currency].symbol}{getConvertedValue(500).toLocaleString()}</span>
                    <span>{currencyRates[currency].symbol}{getConvertedValue(8000).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <Slider
                    value={agentHourlyCostUSD}
                    onValueChange={setAgentHourlyCostUSD}
                    min={5}
                    max={50}
                    step={1}
                    className="w-full touch-pan-y"
                    aria-label="Agent hourly cost slider"
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>{currencyRates[currency].symbol}{getConvertedValue(5).toLocaleString()}/hr</span>
                    <span>{currencyRates[currency].symbol}{getConvertedValue(50).toLocaleString()}/hr</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Current Costs Summary */}
        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-red-950/30 border border-red-500/20">
          <h4 className="text-xs sm:text-sm font-medium text-red-400 mb-3 sm:mb-4">Current Manual Costs</h4>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-foreground/70">Hours needed monthly</span>
              <span className="font-medium text-foreground">{calculations.totalHoursNeeded} hrs</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-foreground/70">Agents required (FT)</span>
              <span className="font-medium text-foreground">{calculations.agentsNeeded}</span>
            </div>
            <div className="flex justify-between border-t border-red-500/20 pt-2 sm:pt-3">
              <span className="text-foreground font-medium text-xs sm:text-base">Monthly Labor Cost</span>
              <span className="font-bold text-red-400 text-base sm:text-lg">
                {currencyRates[currency].symbol}{getConvertedValue(calculations.monthlyAgentCost).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4 sm:space-y-6">
        {/* AI Cost */}
        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-primary/20 border border-primary/30">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/30 flex items-center justify-center">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm sm:text-base">AI Agent Cost</h4>
              <p className="text-[10px] sm:text-xs text-foreground/70">Handles same volume, 24/7</p>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-primary">
            {formatPrice(calculations.avgAIMonthly)}/mo
          </div>
        </div>

        {/* Savings */}
        <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-green-950/30 via-emerald-950/30 to-teal-950/30 border border-green-500/20">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-green-500/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
            </div>
            <div>
              <h4 className="text-lg sm:text-xl font-bold text-foreground">Your Savings</h4>
              <p className="text-xs sm:text-sm text-foreground/70">By switching to AI</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-background/50">
              <span className="text-foreground/70 text-xs sm:text-base">Monthly Savings</span>
              <span className="text-lg sm:text-2xl font-bold text-green-400">
                {currencyRates[currency].symbol}{getConvertedValue(calculations.monthlySavings).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-green-950/30">
              <span className="text-foreground font-medium text-xs sm:text-base">Annual Savings</span>
              <span className="text-xl sm:text-3xl font-bold text-green-400">
                {currencyRates[currency].symbol}{getConvertedValue(calculations.annualSavings).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-background/50">
              <span className="text-foreground/70 text-xs sm:text-base">Cost Reduction</span>
              <span className="text-lg sm:text-2xl font-bold text-green-400">
                {calculations.savingsPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Additional Benefits */}
        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h4 className="font-semibold text-foreground text-sm sm:text-base">Additional Benefits</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 text-center">
              <div className="text-lg sm:text-2xl font-bold text-primary mb-0.5 sm:mb-1">24/7</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Availability</div>
            </div>
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 text-center">
              <div className="text-lg sm:text-2xl font-bold text-primary mb-0.5 sm:mb-1">&lt;5s</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Response Time</div>
            </div>
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 text-center">
              <div className="text-lg sm:text-2xl font-bold text-primary mb-0.5 sm:mb-1">{calculations.hoursReclaimed}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Hours Freed</div>
            </div>
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 text-center">
              <div className="text-lg sm:text-2xl font-bold text-primary mb-0.5 sm:mb-1">∞</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Scalability</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
