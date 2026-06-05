import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLeadTemperatureData } from '@/hooks/useReportingData';
import { Skeleton } from '@/components/ui/skeleton';
import { Thermometer } from 'lucide-react';

interface LeadTemperatureChartProps {
  title?: string;
  emptyText?: string;
  errorText?: string;
  itemLabel?: string;
}

// Use CSS custom property colors for theming
const TEMP_COLORS: Record<string, string> = {
  Hot: 'hsl(0 72% 51%)',      // destructive red
  Warm: 'hsl(38 92% 50%)',    // warning orange
  Cold: 'hsl(199 89% 48%)',   // info blue
};

export function LeadTemperatureChart({
  title = 'Pipeline Temperature',
  emptyText = 'No pipeline records yet.',
  errorText = 'Failed to load pipeline temperature data.',
  itemLabel = 'records',
}: LeadTemperatureChartProps) {
  const { data, isLoading, error } = useLeadTemperatureData();

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{errorText}</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  const totalLeads = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-8">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="temperature"
              >
                {data.map((entry) => (
                  <Cell 
                    key={`cell-${entry.temperature}`} 
                    fill={TEMP_COLORS[entry.temperature] || '#8884d8'} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {data.map((item) => (
              <div key={item.temperature} className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: TEMP_COLORS[item.temperature] || '#8884d8' }}
                />
                <div>
                  <p className="font-medium">{item.temperature}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.count} {itemLabel} ({item.percentage.toFixed(0)}%)
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-medium text-foreground">{totalLeads}</span> {itemLabel}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
