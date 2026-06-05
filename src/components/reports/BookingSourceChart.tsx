import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useBookingSourceData } from '@/hooks/useReportingData';
import { Skeleton } from '@/components/ui/skeleton';
import { Hotel } from 'lucide-react';
import { ChartBreakdownDialog } from './ChartBreakdownDialog';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
];

// Friendly labels for booking sources - supports both keys and direct names
const SOURCE_LABELS: Record<string, string> = {
  // Original key mappings
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  agoda: 'Agoda',
  vrbo: 'VRBO',
  expedia: 'Expedia',
  direct: 'Direct Booking',
  facebook: 'Facebook Messenger',
  calendar: 'Calendar Import',
  google: 'Calendar Import',
  manual: 'Manual Entry',
  unknown: 'Unknown',
  // Direct name mappings (from room_units.calendar_sources)
  'Airbnb': 'Airbnb',
  'Booking.com': 'Booking.com',
  'Agoda': 'Agoda',
  'VRBO': 'VRBO',
  'Expedia': 'Expedia',
  'Direct Booking': 'Direct Booking',
  'Facebook Messenger': 'Facebook Messenger',
  'Manual Entry': 'Manual Entry',
};

export function BookingSourceChart() {
  const { data, isLoading, error } = useBookingSourceData();
  const [selectedSource, setSelectedSource] = useState<{
    source: string;
    displaySource: string;
    count: number;
    colorIndex: number;
  } | null>(null);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-primary" />
            Booking Sources
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
            <Hotel className="w-5 h-5 text-primary" />
            Booking Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Failed to load booking source data.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-primary" />
            Booking Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No bookings yet. Start adding bookings to see source distribution.</p>
        </CardContent>
      </Card>
    );
  }

  // Map source keys to friendly labels with index for color
  const chartData = data.map((item, index) => ({
    ...item,
    displaySource: SOURCE_LABELS[item.source] || item.source,
    colorIndex: index,
  }));

  const handlePieClick = (_data: unknown, index: number) => {
    const item = chartData[index];
    setSelectedSource({
      source: item.source,
      displaySource: item.displaySource,
      count: item.count,
      colorIndex: index,
    });
  };

  const handleLegendClick = (item: typeof chartData[0], index: number) => {
    setSelectedSource({
      source: item.source,
      displaySource: item.displaySource,
      count: item.count,
      colorIndex: index,
    });
  };

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-primary" />
            Booking Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="displaySource"
                label={({ displaySource, percentage }) => `${displaySource} (${percentage.toFixed(0)}%)`}
                onClick={handlePieClick}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [value, 'Bookings']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
            {chartData.slice(0, 6).map((item, idx) => (
              <button
                key={item.source}
                onClick={() => handleLegendClick(item, idx)}
                className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors text-left"
              >
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-sm truncate">{item.displaySource}</span>
                <span className="text-xs text-muted-foreground ml-auto">{item.count}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ChartBreakdownDialog
        open={!!selectedSource}
        onOpenChange={(open) => !open && setSelectedSource(null)}
        chartType="booking_source"
        filterValue={selectedSource?.source || ''}
        displayLabel={selectedSource?.displaySource || ''}
        count={selectedSource?.count || 0}
        color={selectedSource ? COLORS[selectedSource.colorIndex % COLORS.length] : undefined}
      />
    </>
  );
}