import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  BedDouble,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addDays, isWithinInterval } from 'date-fns';
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

interface UpcomingBookingsWidgetProps {
  bookings: Booking[];
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; color: string; borderColor: string }> = {
  pending: { label: 'Pending', color: 'text-warning', borderColor: 'border-l-warning' },
  confirmed: { label: 'Confirmed', color: 'text-success', borderColor: 'border-l-success' },
  upcoming: { label: 'Upcoming', color: 'text-success', borderColor: 'border-l-success' },
  checked_in: { label: 'Checked In', color: 'text-primary', borderColor: 'border-l-primary' },
  external: { label: 'External', color: 'text-orange-500', borderColor: 'border-l-orange-500' },
};

export function UpcomingBookingsWidget({ bookings, isLoading }: UpcomingBookingsWidgetProps) {
  const navigate = useNavigate();

  const categorizedBookings = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
    const next7Days = addDays(today, 7);

    const activeBookings = bookings.filter(
      b => b.status !== 'cancelled' && b.status !== 'checked_out'
    );

    // Today's arrivals
    const arrivingToday = activeBookings.filter(b => b.check_in === todayStr);

    // Today's departures (upcoming or checked_in with checkout today)
    const departingToday = activeBookings.filter(
      b => b.check_out === todayStr && (b.status === 'checked_in' || b.status === 'upcoming')
    );

    // Tomorrow's arrivals
    const arrivingTomorrow = activeBookings.filter(b => b.check_in === tomorrowStr);

    // Next 7 days (excluding today and tomorrow)
    const upcomingWeek = activeBookings.filter(b => {
      const checkIn = parseISO(b.check_in);
      return isWithinInterval(checkIn, { start: addDays(today, 2), end: next7Days });
    });

    // Currently in-house
    const inHouse = activeBookings.filter(b => {
      const checkIn = parseISO(b.check_in);
      const checkOut = parseISO(b.check_out);
      return b.status === 'checked_in' || (checkIn <= today && checkOut > today && b.status === 'upcoming');
    });

    return {
      arrivingToday,
      departingToday,
      arrivingTomorrow,
      upcomingWeek,
      inHouse,
    };
  }, [bookings]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const BookingItem = ({ booking }: { booking: Booking }) => (
    <div
      className={cn(
        'flex items-center justify-between p-2 md:p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2',
        statusConfig[booking.status]?.borderColor || 'border-l-muted'
      )}
      onClick={() => navigate('/accommodation')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <BedDouble className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-xs md:text-sm text-foreground truncate">
            {booking.room?.name || 'Unknown Room'}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
            {booking.lead?.name || 'Guest'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="text-right">
          <p className="text-[10px] md:text-xs text-muted-foreground">
            {getDateLabel(booking.check_in)} → {getDateLabel(booking.check_out)}
          </p>
          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <Users className="w-2.5 h-2.5" />
            {booking.guest_count || 1}
          </div>
        </div>
      </div>
    </div>
  );

  const Section = ({
    title,
    icon: Icon,
    iconColor,
    bookings: sectionBookings,
    emptyText,
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    bookings: Booking[];
    emptyText: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-xs md:text-sm font-medium flex items-center gap-1.5', iconColor)}>
          <Icon className="w-3.5 h-3.5" />
          {title}
        </h3>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {sectionBookings.length}
        </Badge>
      </div>
      {sectionBookings.length > 0 ? (
        <div className="space-y-1.5">
          {sectionBookings.slice(0, 3).map(booking => (
            <BookingItem key={booking.id} booking={booking} />
          ))}
          {sectionBookings.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-[10px] text-muted-foreground"
              onClick={() => navigate('/accommodation')}
            >
              +{sectionBookings.length - 3} more
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[10px] md:text-xs text-muted-foreground py-2">{emptyText}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2 p-3 md:p-4">
          <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Upcoming Bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg" />
            ))}
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
          Upcoming Bookings
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/accommodation')}
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <ScrollArea className="max-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Arriving Today */}
            <Section
              title="Arriving Today"
              icon={Calendar}
              iconColor="text-success"
              bookings={categorizedBookings.arrivingToday}
              emptyText="No arrivals today"
            />

            {/* Departing Today */}
            <Section
              title="Departing Today"
              icon={Clock}
              iconColor="text-warning"
              bookings={categorizedBookings.departingToday}
              emptyText="No departures today"
            />

            {/* In-House Guests */}
            <Section
              title="Currently In-House"
              icon={CheckCircle}
              iconColor="text-primary"
              bookings={categorizedBookings.inHouse}
              emptyText="No guests in-house"
            />

            {/* Tomorrow's Arrivals */}
            <Section
              title="Arriving Tomorrow"
              icon={Calendar}
              iconColor="text-info"
              bookings={categorizedBookings.arrivingTomorrow}
              emptyText="No arrivals tomorrow"
            />

            {/* This Week */}
            <div className="md:col-span-2">
              <Section
                title="Next 7 Days"
                icon={CalendarDays}
                iconColor="text-muted-foreground"
                bookings={categorizedBookings.upcomingWeek}
                emptyText="No upcoming bookings this week"
              />
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
