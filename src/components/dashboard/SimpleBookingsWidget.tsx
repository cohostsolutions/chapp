import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  BedDouble,
  ArrowRight,
  CalendarDays,
  LogIn,
  LogOut,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  room_unit_id: string;
  check_in: string;
  check_out: string;
  guest_count: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  room?: {
    name: string;
  };
  lead?: {
    name: string;
    phone: string | null;
  };
}

interface SimpleBookingsWidgetProps {
  bookings: Booking[];
  isLoading: boolean;
}

export function SimpleBookingsWidget({ bookings, isLoading }: SimpleBookingsWidgetProps) {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');

    const activeBookings = bookings.filter(
      b => b.status !== 'cancelled' && b.status !== 'checked_out'
    );

    const arrivingToday = activeBookings.filter(b => b.check_in === todayStr);
    const departingToday = activeBookings.filter(
      b => b.check_out === todayStr && (b.status === 'checked_in' || b.status === 'upcoming')
    );
    const arrivingTomorrow = activeBookings.filter(b => b.check_in === tomorrowStr);
    const inHouse = activeBookings.filter(b => {
      const checkIn = parseISO(b.check_in);
      const checkOut = parseISO(b.check_out);
      return b.status === 'checked_in' || (checkIn <= today && checkOut > today && b.status === 'upcoming');
    });

    return {
      arrivingToday: arrivingToday.length,
      departingToday: departingToday.length,
      arrivingTomorrow: arrivingTomorrow.length,
      inHouse: inHouse.length,
      nextArrival: arrivingToday[0] || arrivingTomorrow[0],
    };
  }, [bookings]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2 p-3 md:p-4">
          <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Bookings Today
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted/50 rounded-lg" />
            <div className="h-8 bg-muted/50 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2 p-3 md:p-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Bookings Today
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/accommodation')}
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {/* Arriving Today */}
          <div 
            className="p-3 rounded-lg bg-success/10 border border-success/20 cursor-pointer hover:bg-success/20 transition-colors"
            onClick={() => navigate('/accommodation')}
          >
            <div className="flex items-center gap-2 mb-1">
              <LogIn className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Check-ins</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.arrivingToday}</p>
          </div>

          {/* Departing Today */}
          <div 
            className="p-3 rounded-lg bg-warning/10 border border-warning/20 cursor-pointer hover:bg-warning/20 transition-colors"
            onClick={() => navigate('/accommodation')}
          >
            <div className="flex items-center gap-2 mb-1">
              <LogOut className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">Check-outs</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.departingToday}</p>
          </div>

          {/* In-House */}
          <div 
            className="p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => navigate('/accommodation')}
          >
            <div className="flex items-center gap-2 mb-1">
              <BedDouble className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">In-House</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.inHouse}</p>
          </div>

          {/* Tomorrow Arrivals */}
          <div 
            className="p-3 rounded-lg bg-info/10 border border-info/20 cursor-pointer hover:bg-info/20 transition-colors"
            onClick={() => navigate('/accommodation')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-info" />
              <span className="text-xs text-muted-foreground">Tomorrow</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.arrivingTomorrow}</p>
          </div>
        </div>

        {/* Next Arrival Preview */}
        {summary.nextArrival && (
          <div 
            className="mt-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2 border-l-success"
            onClick={() => navigate('/accommodation')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                  <BedDouble className="w-4 h-4 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-xs text-foreground truncate">
                    Next: {summary.nextArrival.room?.name || 'Room'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {summary.nextArrival.lead?.name || 'Guest'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success border-success/30">
                {isToday(parseISO(summary.nextArrival.check_in)) ? 'Today' : 'Tomorrow'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
