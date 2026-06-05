import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { AlertTriangle, BadgeDollarSign, CircleDollarSign, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import type { OperationalExpense } from '@/hooks/useOperationalExpenses';

interface JayOperationsAnalyticsProps {
  expenses: OperationalExpense[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function JayOperationsAnalytics({ expenses }: JayOperationsAnalyticsProps) {
  const formatCurrency = useFormatCurrency();

  const summary = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const pending = expenses.filter((expense) => !expense.is_paid).reduce((sum, expense) => sum + Number(expense.amount), 0);
    const overdueCount = expenses.filter((expense) => !expense.is_paid && expense.due_date && parseISO(expense.due_date) < new Date()).length;
    const fixed = expenses.filter((expense) => expense.category === 'monthly').reduce((sum, expense) => sum + Number(expense.amount), 0);
    const variable = expenses.filter((expense) => expense.category === 'daily').reduce((sum, expense) => sum + Number(expense.amount), 0);

    return { total, pending, overdueCount, fixed, variable };
  }, [expenses]);

  const spendByType = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((accumulator, expense) => {
      accumulator[expense.expense_type] = (accumulator[expense.expense_type] || 0) + Number(expense.amount);
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [expenses]);

  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: 4 }, (_, index) => {
      const month = startOfMonth(subMonths(new Date(), 3 - index));
      return {
        key: format(month, 'yyyy-MM'),
        label: format(month, 'MMM'),
        spend: 0,
        pending: 0,
      };
    });

    const monthMap = new Map(months.map((month) => [month.key, month]));

    expenses.forEach((expense) => {
      const monthKey = format(parseISO(expense.expense_date), 'yyyy-MM');
      const target = monthMap.get(monthKey);
      if (!target) return;
      target.spend += Number(expense.amount);
      if (!expense.is_paid) {
        target.pending += Number(expense.amount);
      }
    });

    return months;
  }, [expenses]);

  const paymentStatus = useMemo(() => {
    const paid = expenses.filter((expense) => expense.is_paid).reduce((sum, expense) => sum + Number(expense.amount), 0);
    const pending = expenses.filter((expense) => !expense.is_paid).reduce((sum, expense) => sum + Number(expense.amount), 0);

    return [
      { name: 'Paid', value: paid, color: 'hsl(var(--chart-2))' },
      { name: 'Pending', value: pending, color: 'hsl(var(--chart-3))' },
    ].filter((item) => item.value > 0);
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No spend data available for this period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(summary.total)}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payables</p>
                <p className="mt-1 text-2xl font-bold text-chart-3">{formatCurrency(summary.pending)}</p>
              </div>
              <div className="rounded-xl bg-chart-3/10 p-2 text-chart-3">
                <BadgeDollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Fixed vs Variable</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(summary.fixed)} / {formatCurrency(summary.variable)}
                </p>
              </div>
              <div className="rounded-xl bg-chart-2/10 p-2 text-chart-2">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Urgent Follow-ups</p>
                <p className="mt-1 text-2xl font-bold text-destructive">{summary.overdueCount}</p>
              </div>
              <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend Mix by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendByType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {spendByType.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Spend']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend and Payables Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  <Bar dataKey="spend" name="Spend" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payable Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {paymentStatus.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}