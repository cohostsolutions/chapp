import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingBag, 
  TrendingUp, 
  Clock, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ChefHat,
  Package,
  CheckCircle,
  Phone,
  Calendar,
  Loader2,
  GraduationCap
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useOrderNotifications } from '@/components/OrderNotifications';
import { AgentManagedLeadsBanner } from '@/components/AgentManagedLeadsBanner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { useDashboardOrders } from '@/hooks/useDashboardOrders';
import { useDashboardTraining } from '@/hooks/useDashboardTraining';
import { UpcomingOrdersWidget } from './UpcomingOrdersWidget';
import { SimpleOrdersWidget } from './SimpleOrdersWidget';
import { DashboardHeader } from './DashboardHeader';
import { QuickActions } from './QuickActions';
import { WidgetCustomizer } from './WidgetCustomizer';
import { DashboardSkeleton } from './DashboardSkeleton';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-warning/20 text-warning border-warning/30', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-info/20 text-info border-info/30', icon: <CheckCircle className="w-3 h-3" /> },
  preparing: { label: 'Preparing', color: 'bg-primary/20 text-primary border-primary/30', icon: <ChefHat className="w-3 h-3" /> },
  ready: { label: 'Ready', color: 'bg-success/20 text-success border-success/30', icon: <Package className="w-3 h-3" /> },
  picked_up: { label: 'Picked Up', color: 'bg-muted text-muted-foreground border-muted', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/20 text-destructive border-destructive/30', icon: <Clock className="w-3 h-3" /> },
};

const WIDGET_CONFIG = [
  { id: 'stats', label: 'Statistics Cards', description: 'Key order metrics' },
  { id: 'orders', label: 'Orders Pipeline', description: 'Order status tracker' },
  { id: 'status', label: 'Order Status Alerts', description: 'Pending and ready alerts' },
  { id: 'training', label: 'AI Training', description: 'Training performance stats' },
  { id: 'recent', label: 'Recent Orders', description: 'Latest order activity' },
];

export default function MayDashboard() {
  const { profile, isClientAdmin } = useAuth();
  const navigate = useNavigate();
  const formatCurrency = useFormatCurrency();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { orders, isLoading: loading, refetch: refetchOrders, lastUpdatedAt } = useDashboardOrders(profile?.organization_id, 10);
  const { data: trainingData } = useDashboardTraining(profile?.organization_id, isClientAdmin);
  const trainingEnabled = trainingData?.trainingEnabled ?? false;
  const trainingStats = trainingData?.trainingStats ?? null;

  // Dashboard customization
  const {
    selectedWidgets,
    availableWidgets,
    isEditMode,
    setIsEditMode,
    isSaving,
    isLoading: isLayoutLoading,
    saveLayout,
    resetLayout,
    toggleWidget,
  } = useDashboardLayout(
    'may',
    ['stats', 'orders', 'status', 'recent'],
    ['stats', 'orders', 'status', 'recent', 'training'],
    { training_enabled: trainingEnabled }
  );

  // Enable order notifications
  useOrderNotifications();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchOrders();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchOrders]);

  const calculateTotal = (items: { price: number; quantity: number }[]) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Calculate stats
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || calculateTotal(o.order_items)), 0);

  const stats = [
    { 
      label: "Today's Orders", 
      value: todayOrders.length.toString(), 
      change: 12, 
      trend: 'up' as const,
      icon: ShoppingBag,
      color: 'text-warning',
      path: '/menu-and-orders?tab=orders'
    },
    { 
      label: 'Pending', 
      value: pendingOrders.length.toString(), 
      change: 0, 
      trend: 'up' as const,
      icon: Clock,
      color: 'text-warning',
      path: '/menu-and-orders?tab=orders'
    },
    { 
      label: 'Preparing', 
      value: preparingOrders.length.toString(), 
      change: 0, 
      trend: 'up' as const,
      icon: ChefHat,
      color: 'text-primary',
      path: '/menu-and-orders?tab=orders'
    },
    { 
      label: "Today's Revenue", 
      value: formatCurrency(todayRevenue), 
      change: 8, 
      trend: 'up' as const,
      icon: DollarSign,
      color: 'text-success',
      path: '/menu-and-orders?tab=orders'
    },
  ];

  // Show skeleton while initial data loads
  if (isLayoutLoading || (loading && orders.length === 0)) {
    return <DashboardSkeleton />;
  }

  const widgetsForCustomizer = WIDGET_CONFIG.filter(w => availableWidgets.includes(w.id));

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-6 animate-fade-in" data-tour="dashboard-content">
      {/* Agent Control Banner */}
      <AgentManagedLeadsBanner onLeadHandback={() => refetchOrders()} />
      
      {/* Header */}
      <DashboardHeader
        userName={profile?.full_name}
        subtitle="Your orders overview for today"
        onCustomize={() => setIsEditMode(!isEditMode)}
        onRefresh={handleRefresh}
        isEditMode={isEditMode}
        isRefreshing={isRefreshing}
        lastRefreshed={lastUpdatedAt}
      />

      {/* Quick Actions */}
      <QuickActions agentType="may" isClientAdmin={isClientAdmin} />

      {/* Edit Mode Panel */}
      {isEditMode && (
        <WidgetCustomizer
          widgets={widgetsForCustomizer}
          selectedWidgets={selectedWidgets}
          onToggle={toggleWidget}
          onSave={saveLayout}
          onReset={resetLayout}
          isSaving={isSaving}
        />
      )}

      {/* Stats Grid */}
      {selectedWidgets.includes('stats') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
          {stats.map((stat, index) => (
            <StatsCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              change={stat.change}
              icon={stat.icon}
              iconColor={stat.color}
              path={stat.path}
              animationDelay={index * 100}
            />
          ))}
        </div>
        )}

        {/* Orders Widget - Detailed for client admin, Simple for agent */}
        {selectedWidgets.includes('orders') && (
          isClientAdmin ? (
            <UpcomingOrdersWidget orders={orders} isLoading={loading} />
          ) : (
            <SimpleOrdersWidget orders={orders} isLoading={loading} />
          )
        )}

        {/* Training Widget */}
      {selectedWidgets.includes('training') && trainingEnabled && isClientAdmin && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-semibold text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              AI Training Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {!trainingStats ? (
              <p className="text-muted-foreground">No training data yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Sessions:</span>
                  <span>{trainingStats.totalSessions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Avg Score:</span>
                  <span>{trainingStats.avgScore === null ? '—' : trainingStats.avgScore.toFixed(1)}</span>
                </div>
                <div>
                  <span className="font-medium">Top Modules</span>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    {trainingStats.topModules.map(m => (
                      <li key={m.id}>{m.title} — {m.count} sessions {m.avgScore ? `(avg ${m.avgScore.toFixed(1)})` : ''}</li>
                    ))}
                    {trainingStats.topModules.length === 0 && <li className="text-muted-foreground">No sessions yet</li>}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order Status Summary */}
      {selectedWidgets.includes('status') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 lg:gap-4">
        {/* Pending Orders Alert */}
        {pendingOrders.length > 0 && (
          <Card className="glass border-warning/50">
            <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-4">
              <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2 text-warning">
                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-xl md:text-2xl font-bold text-foreground">{pendingOrders.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">pending confirmation</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 md:mt-3 border-warning text-warning hover:bg-warning/10 h-7 md:h-8 text-xs md:text-sm"
                onClick={() => navigate('/menu-and-orders?tab=orders')}
              >
                View Orders
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Ready for Pickup */}
        {readyOrders.length > 0 && (
          <Card className="glass border-success/50">
            <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-4">
              <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2 text-success">
                <Package className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Ready for Pickup
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-xl md:text-2xl font-bold text-foreground">{readyOrders.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">orders ready</p>
            </CardContent>
          </Card>
        )}

        {/* Currently Preparing */}
        {preparingOrders.length > 0 && (
          <Card className="glass border-primary/50 sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-4">
              <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2 text-primary">
                <ChefHat className="w-3.5 h-3.5 md:w-4 md:h-4" />
                In Kitchen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <p className="text-xl md:text-2xl font-bold text-foreground">{preparingOrders.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">being prepared</p>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Recent Orders */}
      {selectedWidgets.includes('recent') && (
        <Card className="glass">
        <CardHeader className="pb-2 lg:pb-4 flex flex-row items-center justify-between gap-2 p-3 md:p-4 lg:p-6">
          <CardTitle className="text-sm md:text-base lg:text-lg font-semibold text-foreground">Recent Orders</CardTitle>
          <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs md:text-sm" onClick={() => navigate('/menu-and-orders?tab=orders')}>
            View All
          </Button>
        </CardHeader>
        <CardContent className="p-2.5 md:p-3 lg:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order, index) => (
                <div 
                  key={order.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => navigate('/menu-and-orders?tab=orders')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {order.pickup_name || order.lead?.name || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{order.order_items.length} item(s)</span>
                        <span>•</span>
                        <span>{formatCurrency(order.total_amount || calculateTotal(order.order_items))}</span>
                        {order.pickup_time && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-warning">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(order.pickup_time), 'h:mm a')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusConfig[order.status]?.color}>
                    {statusConfig[order.status]?.icon}
                    <span className="ml-1">{statusConfig[order.status]?.label}</span>
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
