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
import { AlertTriangle, Boxes, ClipboardList, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import type { OperationalExpense } from '@/hooks/useOperationalExpenses';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  category: string;
  last_updated: string;
}

interface MayOperationsAnalyticsProps {
  expenses: OperationalExpense[];
  inventory: InventoryItem[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function MayOperationsAnalytics({ expenses, inventory }: MayOperationsAnalyticsProps) {
  const formatCurrency = useFormatCurrency();

  const stockSummary = useMemo(() => {
    const lowStock = inventory.filter((item) => item.quantity <= item.low_stock_threshold).length;
    const healthy = inventory.length - lowStock;
    const categories = new Set(inventory.map((item) => item.category)).size;
    return { lowStock, healthy, categories };
  }, [inventory]);

  const inventoryByCategory = useMemo(() => {
    const grouped = inventory.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.category] = (accumulator[item.category] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  const stockStatusData = useMemo(() => [
    { name: 'Healthy', value: stockSummary.healthy, color: 'hsl(var(--chart-2))' },
    { name: 'Low Stock', value: stockSummary.lowStock, color: 'hsl(var(--chart-3))' },
  ].filter((item) => item.value > 0), [stockSummary]);

  const spendMix = useMemo(() => {
    const daily = expenses.filter((expense) => expense.category === 'daily').reduce((sum, expense) => sum + Number(expense.amount), 0);
    const monthly = expenses.filter((expense) => expense.category === 'monthly').reduce((sum, expense) => sum + Number(expense.amount), 0);

    return [
      { name: 'Purchasing', value: daily, color: 'hsl(var(--primary))' },
      { name: 'Overhead', value: monthly, color: 'hsl(var(--chart-4))' },
    ].filter((item) => item.value > 0);
  }, [expenses]);

  const expenseTypeData = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((accumulator, expense) => {
      accumulator[expense.expense_type] = (accumulator[expense.expense_type] || 0) + Number(expense.amount);
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Items</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{inventory.length}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
                <p className="mt-1 text-2xl font-bold text-destructive">{stockSummary.lowStock}</p>
              </div>
              <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Healthy Stock</p>
                <p className="mt-1 text-2xl font-bold text-chart-2">{stockSummary.healthy}</p>
              </div>
              <div className="rounded-xl bg-chart-2/10 p-2 text-chart-2">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Purchasing vs Overhead</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatCurrency(spendMix.find((item) => item.name === 'Purchasing')?.value ?? 0)} / {formatCurrency(spendMix.find((item) => item.name === 'Overhead')?.value ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-chart-4/10 p-2 text-chart-4">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inventory by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(value: number) => [`${value} items`, 'Count']} />
                  <Bar dataKey="value" name="Items" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stock Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stockStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {stockStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} items`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Purchasing vs Overhead</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {spendMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
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
            <CardTitle className="text-lg">Top Cost Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseTypeData} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Spend']} />
                  <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[0, 6, 6, 0]}>
                    {expenseTypeData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}