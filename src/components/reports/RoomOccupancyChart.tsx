import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { BedDouble, Home, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { resolveReportingDateRange, useReportingFilters } from '@/contexts/ReportingFiltersContext';

const COLORS = [
  'hsl(187 85% 38%)',  // primary
  'hsl(142 76% 36%)',  // success
  'hsl(38 92% 50%)',   // warning
  'hsl(199 89% 48%)',  // info
  'hsl(280 65% 60%)',  // purple
  'hsl(340 75% 55%)',  // pink
];

export function RoomOccupancyChart() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  const { data, isLoading } = useQuery({
    queryKey: ['room-occupancy', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return { rooms: [], bookings: [] };
      
      const [roomsRes, bookingsRes] = await Promise.all([
        supabase
          .from('room_units')
          .select('id, name, category, capacity')
          .eq('organization_id', profile.organization_id)
          .eq('is_active', true),
        (() => {
          let bookingsQuery = supabase
          .from('bookings')
          .select('id, room_unit_id, check_in, check_out, status, guest_count')
          .eq('organization_id', profile.organization_id)
          .in('status', ['confirmed', 'upcoming', 'checked_in', 'checked_out']);

          if (resolvedDateRange.start) {
            bookingsQuery = bookingsQuery.gte('created_at', resolvedDateRange.start.toISOString());
          }
          if (resolvedDateRange.end) {
            bookingsQuery = bookingsQuery.lte('created_at', resolvedDateRange.end.toISOString());
          }

          return bookingsQuery;
        })(),
      ]);

      return {
        rooms: roomsRes.data || [],
        bookings: bookingsRes.data || [],
      };
    },
    enabled: !!profile?.organization_id,
  });

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Room Occupancy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.rooms || data.rooms.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Room Occupancy
          </CardTitle>
          <CardDescription>Track room utilization</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No rooms configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate bookings per room
  const roomBookings: Record<string, { name: string; bookings: number; guests: number }> = {};
  
  data.rooms.forEach((room) => {
    roomBookings[room.id] = {
      name: room.name.length > 15 ? room.name.substring(0, 12) + '...' : room.name,
      bookings: 0,
      guests: 0,
    };
  });

  data.bookings?.forEach((booking) => {
    if (roomBookings[booking.room_unit_id]) {
      roomBookings[booking.room_unit_id].bookings++;
      roomBookings[booking.room_unit_id].guests += booking.guest_count || 1;
    }
  });

  const chartData = Object.entries(roomBookings)
    .map(([id, stats]) => ({
      name: stats.name,
      bookings: stats.bookings,
      guests: stats.guests,
    }))
    .sort((a, b) => b.bookings - a.bookings);

  const totalRooms = data.rooms.length;
  const totalBookings = data.bookings?.length || 0;
  const occupiedRooms = Object.values(roomBookings).filter(r => r.bookings > 0).length;
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="w-5 h-5 text-primary" />
          Room Occupancy
        </CardTitle>
        <CardDescription>Track room utilization</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="name" 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis className="text-xs fill-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => [value, name === 'bookings' ? 'Bookings' : 'Guests']}
            />
            <Bar dataKey="bookings" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{totalRooms}</p>
            <p className="text-xs text-muted-foreground">Total Rooms</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{totalBookings}</p>
            <p className="text-xs text-muted-foreground">Bookings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-info">{occupancyRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Utilization</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
