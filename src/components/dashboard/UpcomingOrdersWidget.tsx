import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  ChefHat,
  Package,
  ShoppingBag,
  ArrowRight,
  DollarSign,
  Phone,
  Calendar,
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_items: OrderItem[];
  total_amount: number | null;
  status: string;
  pickup_name: string | null;
  pickup_time: string | null;
  notes: string | null;
  created_at: string;
  lead?: {
    name: string;
    phone: string | null;
  };
}

interface UpcomingOrdersWidgetProps {
  orders: Order[];
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; color: string; borderColor: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-warning', borderColor: 'border-l-warning', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', color: 'text-info', borderColor: 'border-l-info', icon: <ShoppingBag className="w-3 h-3" /> },
  preparing: { label: 'Preparing', color: 'text-primary', borderColor: 'border-l-primary', icon: <ChefHat className="w-3 h-3" /> },
  ready: { label: 'Ready', color: 'text-success', borderColor: 'border-l-success', icon: <Package className="w-3 h-3" /> },
};

export function UpcomingOrdersWidget({ orders, isLoading }: UpcomingOrdersWidgetProps) {
  const navigate = useNavigate();
  const formatCurrency = useFormatCurrency();

  const categorizedOrders = useMemo(() => {
    const activeOrders = orders.filter(o => !['picked_up', 'cancelled'].includes(o.status));
    
    const pending = activeOrders.filter(o => o.status === 'pending');
    const preparing = activeOrders.filter(o => o.status === 'preparing');
    const ready = activeOrders.filter(o => o.status === 'ready');
    const confirmed = activeOrders.filter(o => o.status === 'confirmed');

    // Orders with pickup times
    const upcomingPickups = activeOrders
      .filter(o => o.pickup_time)
      .sort((a, b) => new Date(a.pickup_time!).getTime() - new Date(b.pickup_time!).getTime())
      .slice(0, 5);

    // Calculate today's revenue
    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return isToday(orderDate);
    });
    const todayRevenue = todayOrders.reduce((sum, o) => 
      sum + (o.total_amount || o.order_items.reduce((s, i) => s + i.price * i.quantity, 0)), 0);
    const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

    return {
      pending,
      preparing,
      ready,
      confirmed,
      upcomingPickups,
      todayRevenue,
      avgOrderValue,
      todayOrderCount: todayOrders.length,
    };
  }, [orders]);

  const getPickupTimeLabel = (pickupTime: string) => {
    const date = parseISO(pickupTime);
    if (isToday(date)) return `Today ${format(date, 'h:mm a')}`;
    if (isTomorrow(date)) return `Tomorrow ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const OrderItem = ({ order }: { order: Order }) => (
    <div
      className={cn(
        'flex items-center justify-between p-2 md:p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2',
        statusConfig[order.status]?.borderColor || 'border-l-muted'
      )}
      onClick={() => navigate('/menu-and-orders?tab=orders')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          order.status === 'pending' && 'bg-warning/20',
          order.status === 'preparing' && 'bg-primary/20',
          order.status === 'ready' && 'bg-success/20',
          order.status === 'confirmed' && 'bg-info/20'
        )}>
          {statusConfig[order.status]?.icon || <ShoppingBag className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-xs md:text-sm text-foreground truncate">
            {order.pickup_name || order.lead?.name || 'Guest'}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
            {order.order_items.length} item(s) • {formatCurrency(order.total_amount || 0)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {order.pickup_time && (
          <Badge variant="outline" className="text-[10px] h-5">
            <Calendar className="w-2.5 h-2.5 mr-1" />
            {format(parseISO(order.pickup_time), 'h:mm a')}
          </Badge>
        )}
      </div>
    </div>
  );

  const Section = ({
    title,
    icon: Icon,
    iconColor,
    orders: sectionOrders,
    emptyText,
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    orders: Order[];
    emptyText: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={cn('text-xs md:text-sm font-medium flex items-center gap-1.5', iconColor)}>
          <Icon className="w-3.5 h-3.5" />
          {title}
        </h3>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {sectionOrders.length}
        </Badge>
      </div>
      {sectionOrders.length > 0 ? (
        <div className="space-y-1.5">
          {sectionOrders.slice(0, 3).map(order => (
            <OrderItem key={order.id} order={order} />
          ))}
          {sectionOrders.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-[10px] text-muted-foreground"
              onClick={() => navigate('/menu-and-orders?tab=orders')}
            >
              +{sectionOrders.length - 3} more
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
            <ShoppingBag className="w-4 h-4 text-warning" />
            Today's Orders
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
          <ShoppingBag className="w-4 h-4 text-warning" />
          Today's Orders
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/menu-and-orders?tab=orders')}
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        {/* Revenue Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-secondary/30 rounded-lg">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{formatCurrency(categorizedOrders.todayRevenue)}</p>
            <p className="text-[10px] text-muted-foreground">Today's Revenue</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-lg font-bold text-foreground">{categorizedOrders.todayOrderCount}</p>
            <p className="text-[10px] text-muted-foreground">Orders</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{formatCurrency(categorizedOrders.avgOrderValue)}</p>
            <p className="text-[10px] text-muted-foreground">Avg Value</p>
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Pending Orders */}
            <Section
              title="Pending"
              icon={Clock}
              iconColor="text-warning"
              orders={categorizedOrders.pending}
              emptyText="No pending orders"
            />

            {/* Preparing */}
            <Section
              title="Preparing"
              icon={ChefHat}
              iconColor="text-primary"
              orders={categorizedOrders.preparing}
              emptyText="Nothing cooking"
            />

            {/* Ready for Pickup */}
            <Section
              title="Ready"
              icon={Package}
              iconColor="text-success"
              orders={categorizedOrders.ready}
              emptyText="No orders ready"
            />

            {/* Upcoming Pickups */}
            <div className="md:col-span-2 xl:col-span-3">
              <Section
                title="Scheduled Pickups"
                icon={Calendar}
                iconColor="text-info"
                orders={categorizedOrders.upcomingPickups}
                emptyText="No scheduled pickups"
              />
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
