import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  ChefHat,
  Package,
  ShoppingBag,
  ArrowRight,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
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
  created_at: string;
  lead?: {
    name: string;
    phone: string | null;
  };
}

interface SimpleOrdersWidgetProps {
  orders: Order[];
  isLoading: boolean;
}

export function SimpleOrdersWidget({ orders, isLoading }: SimpleOrdersWidgetProps) {
  const navigate = useNavigate();
  const formatCurrency = useFormatCurrency();

  const summary = useMemo(() => {
    const activeOrders = orders.filter(o => !['picked_up', 'cancelled'].includes(o.status));
    
    const pending = activeOrders.filter(o => o.status === 'pending').length;
    const preparing = activeOrders.filter(o => o.status === 'preparing').length;
    const ready = activeOrders.filter(o => o.status === 'ready').length;
    
    const todayOrders = orders.filter(o => isToday(new Date(o.created_at)));
    const todayRevenue = todayOrders.reduce((sum, o) => 
      sum + (o.total_amount || o.order_items.reduce((s, i) => s + i.price * i.quantity, 0)), 0);

    // Next order to pickup
    const nextPickup = activeOrders
      .filter(o => o.pickup_time)
      .sort((a, b) => new Date(a.pickup_time!).getTime() - new Date(b.pickup_time!).getTime())[0];

    return {
      pending,
      preparing,
      ready,
      todayRevenue,
      todayCount: todayOrders.length,
      nextPickup,
    };
  }, [orders]);

  if (isLoading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2 p-3 md:p-4">
          <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-warning" />
            Orders Today
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
          <ShoppingBag className="w-4 h-4 text-warning" />
          Orders Today
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/menu-and-orders?tab=orders')}
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {/* Pending */}
          <div 
            className="p-3 rounded-lg bg-warning/10 border border-warning/20 cursor-pointer hover:bg-warning/20 transition-colors"
            onClick={() => navigate('/menu-and-orders?tab=orders')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.pending}</p>
          </div>

          {/* Preparing */}
          <div 
            className="p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => navigate('/menu-and-orders?tab=orders')}
          >
            <div className="flex items-center gap-2 mb-1">
              <ChefHat className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Preparing</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.preparing}</p>
          </div>

          {/* Ready */}
          <div 
            className="p-3 rounded-lg bg-success/10 border border-success/20 cursor-pointer hover:bg-success/20 transition-colors"
            onClick={() => navigate('/menu-and-orders?tab=orders')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Ready</span>
            </div>
            <p className="text-xl font-bold text-foreground">{summary.ready}</p>
          </div>

          {/* Today's Revenue */}
          <div 
            className="p-3 rounded-lg bg-info/10 border border-info/20 cursor-pointer hover:bg-info/20 transition-colors"
            onClick={() => navigate('/menu-and-orders?tab=orders')}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-info" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(summary.todayRevenue)}</p>
          </div>
        </div>

        {/* Next Pickup Preview */}
        {summary.nextPickup && (
          <div 
            className="mt-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer border-l-2 border-l-info"
            onClick={() => navigate('/menu-and-orders?tab=orders')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-info/20 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-xs text-foreground truncate">
                    Next: {summary.nextPickup.pickup_name || summary.nextPickup.lead?.name || 'Guest'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {summary.nextPickup.order_items.length} items
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] h-5 bg-info/10 text-info border-info/30">
                {format(parseISO(summary.nextPickup.pickup_time!), 'h:mm a')}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
