import { Coins, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';

interface ExpenseSummaryCardsProps {
  summary: {
    totalExpenses: number;
    dailyTotal: number;
    monthlyTotal: number;
    unpaidCount: number;
    unpaidTotal: number;
    overdueCount: number;
  };
  copy?: {
    totalTitle?: string;
    pendingTitle?: string;
    overdueTitle?: string;
    dailyLabel?: string;
    monthlyLabel?: string;
    pendingNoun?: string;
    overdueAttentionLabel?: string;
    overdueClearLabel?: string;
  };
}

export function ExpenseSummaryCards({ summary, copy }: ExpenseSummaryCardsProps) {
  const formatCurrency = useFormatCurrency();

  const dailyLabel = copy?.dailyLabel ?? 'Daily';
  const monthlyLabel = copy?.monthlyLabel ?? 'Monthly';
  const pendingNoun = copy?.pendingNoun ?? 'expense';

  const cards = [
    {
      title: copy?.totalTitle ?? 'Total Expenses',
      value: formatCurrency(summary.totalExpenses),
      subValue: `${dailyLabel}: ${formatCurrency(summary.dailyTotal)} | ${monthlyLabel}: ${formatCurrency(summary.monthlyTotal)}`,
      icon: Coins,
      color: 'text-primary',
    },
    {
      title: copy?.pendingTitle ?? 'Pending Payment',
      value: formatCurrency(summary.unpaidTotal),
      subValue: `${summary.unpaidCount} unpaid ${pendingNoun}${summary.unpaidCount !== 1 ? 's' : ''}`,
      icon: TrendingUp,
      color: 'text-chart-2',
    },
    {
      title: copy?.overdueTitle ?? 'Overdue',
      value: summary.overdueCount.toString(),
      subValue: summary.overdueCount > 0
        ? (copy?.overdueAttentionLabel ?? 'Needs attention')
        : (copy?.overdueClearLabel ?? 'All caught up!'),
      icon: summary.overdueCount > 0 ? AlertTriangle : CheckCircle2,
      color: summary.overdueCount > 0 ? 'text-destructive' : 'text-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="glass hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.subValue}</p>
              </div>
              <div className={`p-2 rounded-lg bg-muted/50 ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}