import { Card, CardContent } from '@/components/ui/card';
import { useReportingSummary } from '@/hooks/useReportingData';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Coins, Calendar, ArrowUpRight, ArrowDownRight, BedDouble } from 'lucide-react';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ReportingSummaryCards() {
  const { data, isLoading } = useReportingSummary();
  const formatCurrency = useFormatCurrency();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="glass">
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  // Cece cards - booking focused
  const cards = [
    {
      title: 'Total Bookings',
      value: data.totalBookings,
      subValue: `+${data.bookingsThisMonth} this month`,
      icon: BedDouble,
      trend: data.bookingsThisMonth > 0 ? 'up' : 'neutral',
      color: 'text-primary',
    },
    {
      title: 'Confirmation Rate',
      value: `${data.bookingConfirmationRate.toFixed(1)}%`,
      subValue: `${data.confirmedBookings} confirmed`,
      icon: Calendar,
      trend: data.bookingConfirmationRate > 50 ? 'up' : 'neutral',
      color: 'text-chart-2',
    },
    {
      title: 'Booking Revenue',
      value: formatCurrency(data.totalRevenue),
      subValue: `+${formatCurrency(data.revenueThisMonth)} this month`,
      icon: Coins,
      trend: data.revenueThisMonth > 0 ? 'up' : 'neutral',
      color: 'text-chart-3',
    },
    {
      title: 'New Inquiries',
      value: data.newLeadsThisMonth,
      subValue: `${data.totalLeads} total inquiries`,
      icon: Users,
      trend: data.newLeadsThisMonth > 0 ? 'up' : 'neutral',
      color: 'text-chart-4',
    },
  ];
            subValue: `+${formatCurrency(data.revenueThisMonth)} this month`,
            icon: Coins,
            trend: data.revenueThisMonth > 0 ? 'up' : 'neutral',
            color: 'text-chart-3',
          },
          {
            title: 'AI Booked Appointments',
            value: data.totalAIBookedAppointments,
            subValue: `+${data.aiBookedAppointmentsThisMonth} this month`,
            icon: Calendar,
            trend: data.aiBookedAppointmentsThisMonth > 0 ? 'up' : 'neutral',
            color: 'text-chart-4',
          },
        ];

  return (
    <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="glass overflow-hidden border-border/60 hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{card.title}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 rounded-full px-1.5 text-[10px]',
                      card.trend === 'up' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-border/60 bg-background/70 text-muted-foreground',
                    )}
                  >
                    {card.trend === 'up' ? 'Improving' : 'Baseline'}
                  </Badge>
                </div>
                <p className={`text-lg md:text-2xl font-bold mt-0.5 md:mt-1 ${card.color} truncate`}>{card.value}</p>
                <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                  {card.trend === 'up' && <ArrowUpRight className="w-3 h-3 text-green-500 shrink-0" />}
                  {card.trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-500 shrink-0" />}
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">{card.subValue}</p>
                </div>
              </div>
              <div className={`p-2 md:p-2.5 rounded-xl bg-muted/50 ${card.color} shrink-0`}>
                <card.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
