import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  UtensilsCrossed, 
  ShoppingBag,
  Calendar,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useOrdersData } from '@/hooks/useOrdersData';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Lazy load tab content components
import MenuItemsTabContent from '@/components/restaurant/MenuItemsTabContent';
import OrdersTabContent from '@/components/restaurant/OrdersTabContent';
import RestaurantCalendarTabContent from '@/components/restaurant/RestaurantCalendarTabContent';

export default function MenuAndOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'orders';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { aiAgentType: _aiAgentType } = useAuth();

  // Shared restaurant data
  const ordersData = useOrdersData();
  const { syncCalendars, isSyncing: isCalendarSyncing } = useCalendarSync();

  const { stats, isLoading, refetchAll } = ordersData;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const handleRefresh = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-3 animate-fade-in h-[calc(100vh-6rem)]">
        {/* Compact Header with inline Stats */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-warning" />
              Menu & Orders
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage menu items, orders, and deliveries
            </p>
          </div>

          {/* Inline Stats - Desktop only */}
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center">
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-warning/50 transition-colors"
              onClick={() => handleTabChange('orders')}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs text-muted-foreground">Pending Orders</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.pendingOrders}</span>
            </div>
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleTabChange('orders')}
            >
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Ready to Ship</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.readyOrders}</span>
            </div>
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-success/50 transition-colors"
              onClick={() => handleTabChange('menu')}
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-success" />
              <span className="text-xs text-muted-foreground">Menu Items</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.totalMenuItems}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncCalendars(true).then(() => refetchAll())}
              disabled={isCalendarSyncing}
              className="h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCalendarSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Calendars</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          </div>
        </div>

        {/* Mobile Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:hidden">
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('orders')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/10">
                <ShoppingBag className="w-3.5 h-3.5 text-warning" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Pending</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.pendingOrders}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('orders')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Ready</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.readyOrders}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('menu')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success/10">
                <UtensilsCrossed className="w-3.5 h-3.5 text-success" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Menu</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.totalMenuItems}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="glass flex-1 flex flex-col">
          <Tabs 
            value={activeTab} 
            onValueChange={handleTabChange} 
            className="flex-1 flex flex-col"
          >
            <div className="p-4 border-b">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="orders" className="text-xs sm:text-sm flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Orders</span>
                  <span className="sm:hidden">Orders</span>
                </TabsTrigger>
                <TabsTrigger value="menu" className="text-xs sm:text-sm flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Menu</span>
                  <span className="sm:hidden">Menu</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="text-xs sm:text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Calendar</span>
                  <span className="sm:hidden">Calendar</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="orders" className="mt-0 h-full">
                <SectionErrorBoundary name="Orders">
                  {isLoading ? (
                    <CardListSkeleton count={5} />
                  ) : (
                    <OrdersTabContent ordersData={ordersData} />
                  )}
                </SectionErrorBoundary>
              </TabsContent>

              <TabsContent value="menu" className="mt-0 h-full">
                <SectionErrorBoundary name="Menu Items">
                  {isLoading ? (
                    <CardListSkeleton count={5} />
                  ) : (
                    <MenuItemsTabContent ordersData={ordersData} />
                  )}
                </SectionErrorBoundary>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0 h-full">
                <SectionErrorBoundary name="Calendar">
                  {isLoading ? (
                    <CardListSkeleton count={5} />
                  ) : (
                    <RestaurantCalendarTabContent ordersData={ordersData} />
                  )}
                </SectionErrorBoundary>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </PullToRefresh>
  );
}
