import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { BedDouble, Calendar, CheckCircle2, Clock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { resolveReportingDateRange, useReportingFilters } from '@/contexts/ReportingFiltersContext';

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(38 92% 50%)',      // warning
  upcoming: 'hsl(199 89% 48%)',    // info
  confirmed: 'hsl(199 89% 48%)',   // info  
  checked_in: 'hsl(142 76% 36%)',  // success
  checked_out: 'hsl(215 16% 47%)', // muted
  cancelled: 'hsl(0 72% 51%)',     // destructive
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  upcoming: 'Upcoming',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
};

export function BookingStatusChart() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['booking-status-chart', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let query = supabase
        .from('bookings')
        .select('id, status, check_in, check_out, guest_count, created_at')
        .eq('organization_id', profile.organization_id);

      if (resolvedDateRange.start) {
        query = query.gte('created_at', resolvedDateRange.start.toISOString());
      }
      if (resolvedDateRange.end) {
        query = query.lte('created_at', resolvedDateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-primary" />
            Booking Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-primary" />
            Booking Status
          </CardTitle>
          <CardDescription>Track reservation status</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No bookings yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate status distribution
  const statusCounts: Record<string, number> = {};
  bookings.forEach((booking) => {
    const status = booking.status || 'pending';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    status: STATUS_LABELS[status] || status,
    count,
    percentage: (count / bookings.length) * 100,
    color: STATUS_COLORS[status] || 'hsl(var(--muted))',
  }));

  // Calculate metrics
  const today = new Date();
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((booking) => (
    booking.status === 'confirmed'
    || booking.status === 'upcoming'
    || booking.status === 'checked_in'
  )).length;
  const upcomingBookings = bookings.filter(b => {
    const checkIn = parseISO(b.check_in);
    return isAfter(checkIn, today) && (b.status === 'upcoming' || b.status === 'pending');
  }).length;
  const totalGuests = bookings.reduce((sum, b) => sum + (b.guest_count || 1), 0);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-primary" />
          Booking Status
        </CardTitle>
        <CardDescription>Track reservation status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="status"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
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
          
          <div className="space-y-3 flex-1">
            {chartData.map((item) => (
              <div key={item.status} className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1">
                  <p className="font-medium">{item.status}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.count} bookings ({item.percentage.toFixed(0)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-success mb-1">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{confirmedBookings}</p>
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-info mb-1">
              <Calendar className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{upcomingBookings}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-warning mb-1">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold">{totalGuests}</p>
            <p className="text-xs text-muted-foreground">Total Guests</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
