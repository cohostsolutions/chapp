import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Plan {
  name: string;
  role: string;
  basePrice: number;
  features: string[];
  breakdown: {
    messages: string;
    support: string;
    users: string;
    storage: string;
    languages: string;
    sla: string;
  };
}

interface PlanComparisonToolProps {
  plans: Plan[];
  formatPrice: (price: number) => string;
  billingAnnual: boolean;
  getAnnualPrice: (price: number) => number;
  getStandardPlanTotal: (price: number) => number;
}

export function PlanComparisonTool({ 
  plans, 
  formatPrice, 
  billingAnnual,
  getAnnualPrice,
  getStandardPlanTotal 
}: PlanComparisonToolProps) {
  const [selectedPlans, setSelectedPlans] = useState<string[]>(['Jay', 'Cece']);

  const togglePlan = (planName: string) => {
    setSelectedPlans(prev => 
      prev.includes(planName)
        ? prev.filter(p => p !== planName)
        : [...prev, planName]
    );
  };

  const filteredPlans = plans.filter(p => selectedPlans.includes(p.name));

  // All unique features across selected plans
  const allFeatures = [...new Set(filteredPlans.flatMap(p => p.features))];

  return (
    <div className="space-y-8">
      {/* Plan Selection */}
      <div className="flex flex-wrap justify-center gap-6">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
              selectedPlans.includes(plan.name)
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-primary/30"
            )}
            onClick={() => togglePlan(plan.name)}
          >
            <Checkbox 
              checked={selectedPlans.includes(plan.name)}
              onCheckedChange={() => togglePlan(plan.name)}
            />
            <Label className="cursor-pointer font-medium">
              {plan.name} <span className="text-muted-foreground font-normal">({plan.role})</span>
            </Label>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      {filteredPlans.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-foreground font-semibold">Feature</th>
                {filteredPlans.map((plan) => {
                  const totalMonthly = getStandardPlanTotal(plan.basePrice);
                  const displayPrice = billingAnnual ? getAnnualPrice(totalMonthly) : totalMonthly;
                  return (
                    <th key={plan.name} className="text-center py-4 px-4 text-foreground font-semibold min-w-[160px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">{plan.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">{plan.role}</span>
                        <span className="text-primary font-bold">{formatPrice(displayPrice)}/mo</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="text-sm">
              {/* Breakdown items */}
              <tr className="bg-muted/20">
                <td className="py-3 px-4 text-foreground font-medium" colSpan={filteredPlans.length + 1}>
                  Plan Limits
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-foreground">Conversations/month</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.name} className="py-3 px-4 text-center text-muted-foreground">
                    {plan.breakdown.messages}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/10">
                <td className="py-3 px-4 text-foreground">Agent Seats</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.name} className="py-3 px-4 text-center text-muted-foreground">
                    {plan.breakdown.users}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-4 text-foreground">Knowledge Base Storage</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.name} className="py-3 px-4 text-center text-muted-foreground">
                    {plan.breakdown.storage}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/10">
                <td className="py-3 px-4 text-foreground">Languages Included</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.name} className="py-3 px-4 text-center text-muted-foreground">
                    {plan.breakdown.languages}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-4 text-foreground">Support Level</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.name} className="py-3 px-4 text-center text-muted-foreground">
                    {plan.breakdown.support}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/10">
                <td className="py-3 px-4 text-foreground">Uptime SLA</td>
                {filteredPlans.map((plan) => (
                  <td key={plan.name} className="py-3 px-4 text-center text-muted-foreground">
                    {plan.breakdown.sla}
                  </td>
                ))}
              </tr>
              
              {/* Features */}
              <tr className="bg-muted/20">
                <td className="py-3 px-4 text-foreground font-medium" colSpan={filteredPlans.length + 1}>
                  Features
                </td>
              </tr>
              {allFeatures.map((feature, i) => (
                <tr key={feature} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                  <td className="py-3 px-4 text-foreground">{feature}</td>
                  {filteredPlans.map((plan) => (
                    <td key={plan.name} className="py-3 px-4 text-center">
                      {plan.features.includes(feature) ? (
                        <Check className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Select at least one plan to compare
        </div>
      )}
    </div>
  );
}
