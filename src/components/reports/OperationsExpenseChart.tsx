import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrencySymbol, useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Wallet, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { resolveReportingDateRange, useReportingFilters } from '@/contexts/ReportingFiltersContext';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type ExpenseRow = {
  expense_type: string;
  amount: number;
  category: 'daily' | 'monthly';
  expense_date: string;
  is_paid: boolean;
};

interface OperationsExpenseChartProps {
  title?: string;
  description?: string;
  emptyText?: string;
}

export function OperationsExpenseChart({
  title = 'Expenses by Type',
  description = 'Distribution of operational costs',
  emptyText = 'No operational expenses recorded yet',
}: OperationsExpenseChartProps) {
  const { profile } = useAuth();
  const formatCurrency = useFormatCurrency();
  const currencySymbol = useCurrencySymbol();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  const { data: expenses, isLoading } = useQuery<ExpenseRow[]>({
    queryKey: ['reporting-expenses', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const threeMonthsAgo = resolvedDateRange.start?.toISOString() || startOfMonth(subMonths(new Date(), 2)).toISOString();
      
      let query = supabase
        .from('operational_expenses')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .gte('expense_date', threeMonthsAgo);

      if (resolvedDateRange.end) {
        query = query.lte('expense_date', resolvedDateRange.end.toISOString());
      }

      const { data, error } = await query.order('expense_date', { ascending: false });

      if (error) throw error;
      return (data || []) as ExpenseRow[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!expenses?.length) return { byType: [], byMonth: [], summary: null };

    // Group by expense type
    const typeGroups: Record<string, number> = {};
    expenses.forEach((exp) => {
      const type = exp.expense_type;
      typeGroups[type] = (typeGroups[type] || 0) + Number(exp.amount);
    });

    const byType = Object.entries(typeGroups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Group by month
    const monthGroups: Record<string, { daily: number; monthly: number }> = {};
    expenses.forEach((exp) => {
      const month = format(new Date(exp.expense_date), 'MMM yyyy');
      if (!monthGroups[month]) {
        monthGroups[month] = { daily: 0, monthly: 0 };
      }
      monthGroups[month][exp.category as 'daily' | 'monthly'] += Number(exp.amount);
    });

    const byMonth = Object.entries(monthGroups)
      .map(([month, data]) => ({
        month,
        daily: data.daily,
        monthly: data.monthly,
        total: data.daily + data.monthly,
      }))
      .reverse();

    // Summary
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidExpenses = expenses.filter((e) => e.is_paid).reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingExpenses = totalExpenses - paidExpenses;
    const dailyTotal = expenses.filter((e) => e.category === 'daily').reduce((sum, e) => sum + Number(e.amount), 0);
    const monthlyTotal = expenses.filter((e) => e.category === 'monthly').reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      byType,
      byMonth,
      summary: {
        totalExpenses,
        paidExpenses,
        pendingExpenses,
        dailyTotal,
        monthlyTotal,
        expenseCount: expenses.length,
      },
    };
  }, [expenses]);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px]" />
        <Skeleton className="h-[350px]" />
      </div>
    );
  }

  if (!expenses?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Summary Cards */}
      {chartData.summary && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
                <Wallet className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-[10px] md:text-xs font-medium">Total Expenses</span>
              </div>
              <p className="text-lg md:text-2xl font-bold">{formatCurrency(chartData.summary.totalExpenses)}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{chartData.summary.expenseCount} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-2 text-success mb-1">
                <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-[10px] md:text-xs font-medium">Paid</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-success">{formatCurrency(chartData.summary.paidExpenses)}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">settled</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-2 text-warning mb-1">
                <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-[10px] md:text-xs font-medium">Pending</span>
              </div>
              <p className="text-lg md:text-2xl font-bold text-warning">{formatCurrency(chartData.summary.pendingExpenses)}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">to be paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-2 text-info mb-1">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-[10px] md:text-xs font-medium">Daily / Monthly</span>
              </div>
              <p className="text-sm md:text-lg font-bold leading-tight">
                <span className="block md:inline">{formatCurrency(chartData.summary.dailyTotal)}</span>
                <span className="hidden md:inline"> / </span>
                <span className="block md:inline text-muted-foreground md:text-foreground">{formatCurrency(chartData.summary.monthlyTotal)}</span>
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">daily / monthly split</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Expense by Type */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">{title}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{description}</CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="h-[240px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.byType}
                    cx="50%"
                    cy="50%"
                    outerRadius={typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.length > 10 ? name.slice(0, 10) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {chartData.byType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Monthly Expense Trend</CardTitle>
            <CardDescription className="text-xs md:text-sm">Daily vs monthly expenses over time</CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <div className="h-[240px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.byMonth} margin={{ left: -15, right: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${currencySymbol}${v / 1000}k`} width={45} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="daily" name="Daily" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="monthly" name="Monthly" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
