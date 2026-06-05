import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLeadSourceData } from '@/hooks/useReportingData';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart as PieChartIcon } from 'lucide-react';
import { ChartBreakdownDialog } from './ChartBreakdownDialog';

interface LeadSourceChartProps {
  title?: string;
  emptyText?: string;
  errorText?: string;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
];

export function LeadSourceChart({
  title = 'Pipeline Sources',
  emptyText = 'No pipeline records yet. Start adding activity to see source distribution.',
  errorText = 'Failed to load pipeline source data.',
}: LeadSourceChartProps) {
  const { data, isLoading, error } = useLeadSourceData();
  const [selectedSource, setSelectedSource] = useState<{
    source: string;
    count: number;
    colorIndex: number;
  } | null>(null);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
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
            <PieChartIcon className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        </CardContent>
      </Card>
    );
  }

  const handlePieClick = (item: typeof data[number], index: number) => {
    setSelectedSource({
      source: item.source,
      count: item.count,
      colorIndex: index,
    });
  };

  const handleLegendClick = (item: typeof data[0], index: number) => {
    setSelectedSource({
      source: item.source,
      count: item.count,
      colorIndex: index,
    });
  };

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="source"
                label={({ source, percentage }) => `${source} (${percentage.toFixed(0)}%)`}
                onClick={(slice: any, index: number) => handlePieClick(slice?.payload ?? slice, index)}
                cursor="pointer"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [value, 'Records']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
            {data.slice(0, 6).map((item, idx) => (
              <button
                key={item.source}
                onClick={() => handleLegendClick(item, idx)}
                className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors text-left"
              >
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-sm truncate">{item.source}</span>
                <span className="text-xs text-muted-foreground ml-auto">{item.count}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ChartBreakdownDialog
        open={!!selectedSource}
        onOpenChange={(open) => !open && setSelectedSource(null)}
        chartType="lead_source"
        filterValue={selectedSource?.source || ''}
        displayLabel={selectedSource?.source || ''}
        count={selectedSource?.count || 0}
        color={selectedSource ? COLORS[selectedSource.colorIndex % COLORS.length] : undefined}
      />
    </>
  );
}