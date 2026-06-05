import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ShoppingBag,
  Search,
  Clock,
  ChefHat,
  Package,
  CheckCircle,
  Phone,
  Plus,
  LayoutGrid,
  List,
  Filter,
  XCircle,
  Loader2,
  User,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { OrderKanbanBoard } from '@/components/orders/OrderKanbanBoard';
import type { useOrdersData } from '@/hooks/useOrdersData';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreateOrder } from '@/hooks/useCreateOrder';
import { ConversationDateFilter, DateRange } from '@/components/conversations/ConversationDateFilter';
import { parseManualOrderItems, prepTaskStatusConfig } from '@/lib/orderPrep';
import type { PrepTask } from '@/hooks/useOrdersData';

interface OrdersTabContentProps {
  ordersData: ReturnType<typeof useOrdersData>;
}

type DateFilter = 'all' | 'today' | 'upcoming' | 'this_week' | 'this_month' | 'past' | 'custom';
type SortOption = 'created_at_desc' | 'created_at_asc' | 'pickup_time_asc' | 'customer_name';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-warning/20 text-warning border-warning/30', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-info/20 text-info border-info/30', icon: <CheckCircle className="w-3 h-3" /> },
  preparing: { label: 'Preparing', color: 'bg-primary/20 text-primary border-primary/30', icon: <ChefHat className="w-3 h-3" /> },
  ready: { label: 'Ready', color: 'bg-success/20 text-success border-success/30', icon: <Package className="w-3 h-3" /> },
  picked_up: { label: 'Picked Up', color: 'bg-muted text-muted-foreground border-muted', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/20 text-destructive border-destructive/30', icon: <Package className="w-3 h-3" /> },
};

export default function OrdersTabContent({ ordersData }: OrdersTabContentProps) {
  const { orders, refetchAll, prepTasks } = ordersData;
  const { profile, effectiveIsClientAdmin } = useAuth();
  const formatCurrency = useFormatCurrency();
  const { phonePlaceholder } = useOrganizationPhone();
  const { toast } = useToast();
  const { createOrder, isLoading: creatingOrder } = useCreateOrder();
  
  // View & filter state
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming');
  const [sortOption, setSortOption] = useState<SortOption>('created_at_desc');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  // New order state
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    pickupTime: '',
    notes: '',
    items: '',
  });

  // Order details state
  const [selectedOrder, setSelectedOrder] = useState<typeof orders[0] | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingPrepTask, setEditingPrepTask] = useState<PrepTask | null>(null);
  const [prepTaskDialogOpen, setPrepTaskDialogOpen] = useState(false);
  const [prepTaskForm, setPrepTaskForm] = useState({
    scheduledStartTime: '',
    scheduledReadyTime: '',
    reminderTime: '',
    status: 'scheduled',
    overrideNotes: '',
  });

  const openOrderDetails = (order: typeof orders[0]) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const getOrderItems = (order: typeof orders[0]) => {
    return (order.order_items as unknown as Array<{ name: string; quantity: number; price: number; notes?: string }>) || [];
  };

  const getPrepTasksForOrder = useCallback((orderId: string) => {
    return prepTasks
      .filter((task) => task.order_id === orderId)
      .sort((left, right) => {
        const leftTime = left.scheduled_start_time ? new Date(left.scheduled_start_time).getTime() : 0;
        const rightTime = right.scheduled_start_time ? new Date(right.scheduled_start_time).getTime() : 0;
        return leftTime - rightTime;
      });
  }, [prepTasks]);

  const openPrepTaskOverride = useCallback((task: PrepTask) => {
    setEditingPrepTask(task);
    setPrepTaskForm({
      scheduledStartTime: task.scheduled_start_time ? new Date(task.scheduled_start_time).toISOString().slice(0, 16) : '',
      scheduledReadyTime: task.scheduled_ready_time ? new Date(task.scheduled_ready_time).toISOString().slice(0, 16) : '',
      reminderTime: task.reminder_time ? new Date(task.reminder_time).toISOString().slice(0, 16) : '',
      status: task.status,
      overrideNotes: task.override_notes || '',
    });
    setPrepTaskDialogOpen(true);
  }, []);

  const calculateTotal = (items: Array<{ name: string; quantity: number; price: number }>) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Apply filters
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(order =>
        order.pickup_name?.toLowerCase().includes(term) ||
        order.lead?.name?.toLowerCase().includes(term) ||
        order.lead?.phone?.includes(term) ||
        order.id.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    // Date filter
    switch (dateFilter) {
      case 'today':
        result = result.filter(order => {
          const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
          return orderDate === todayStr;
        });
        break;
      case 'upcoming':
        // Show active orders (not picked up or cancelled)
        result = result.filter(order => 
          !['picked_up', 'cancelled'].includes(order.status)
        );
        break;
      case 'past':
        result = result.filter(order => 
          ['picked_up', 'cancelled'].includes(order.status)
        );
        break;
      case 'this_week':
        const weekEnd = format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        result = result.filter(order => {
          const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
          return orderDate >= todayStr && orderDate <= weekEnd;
        });
        break;
      case 'this_month':
        const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
        result = result.filter(order => {
          const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
          return orderDate >= todayStr && orderDate <= monthEnd;
        });
        break;
      case 'custom':
        if (customDateRange.from || customDateRange.to) {
          const fromStr = customDateRange.from ? format(customDateRange.from, 'yyyy-MM-dd') : null;
          const toStr = customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : null;
          result = result.filter(order => {
            const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
            if (fromStr && toStr) return orderDate >= fromStr && orderDate <= toStr;
            if (fromStr) return orderDate >= fromStr;
            if (toStr) return orderDate <= toStr;
            return true;
          });
        }
        break;
    }

    // Sorting
    switch (sortOption) {
      case 'created_at_desc':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'created_at_asc':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'pickup_time_asc':
        result.sort((a, b) => {
          if (!a.pickup_time) return 1;
          if (!b.pickup_time) return -1;
          return new Date(a.pickup_time).getTime() - new Date(b.pickup_time).getTime();
        });
        break;
      case 'customer_name':
        result.sort((a, b) => 
          (a.lead?.name || a.pickup_name || '').localeCompare(b.lead?.name || b.pickup_name || '')
        );
        break;
    }

    return result;
  }, [orders, searchTerm, statusFilter, dateFilter, sortOption, customDateRange]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (error) throw error;
      
      toast({
        title: 'Status Updated',
        description: `Order status changed to ${statusConfig[newStatus]?.label || newStatus}`,
      });
      refetchAll();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('upcoming');
    setSortOption('created_at_desc');
    setCustomDateRange({ from: undefined, to: undefined });
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!newOrder.customerName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter a customer name.',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.organization_id) {
      toast({
        title: 'Error',
        description: 'Organization not found.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Parse items from text
      const orderItems = parseManualOrderItems(newOrder.items);
      if (orderItems.length === 0) {
        toast({
          title: 'Missing Information',
          description: 'Please enter at least one order item.',
          variant: 'destructive',
        });
        return;
      }

      const result = await createOrder({
        customerName: newOrder.customerName.trim(),
        customerPhone: newOrder.customerPhone.trim() || null,
        customerEmail: newOrder.customerEmail.trim() || null,
        pickupTime: newOrder.pickupTime || null,
        notes: newOrder.notes || null,
        items: orderItems,
        leadSource: 'manual',
      });

      if (!result) {
        return;
      }

      toast({
        title: 'Order Created',
        description: `New order for ${newOrder.customerName} has been created`,
      });

      setNewOrderOpen(false);
      setNewOrder({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        pickupTime: '',
        notes: '',
        items: '',
      });
      refetchAll();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create order',
        variant: 'destructive',
      });
    }
  }, [newOrder, profile?.organization_id, toast, refetchAll, createOrder]);

  const hasActiveFilters = statusFilter !== 'all' || 
    dateFilter !== 'upcoming' || 
    sortOption !== 'created_at_desc' ||
    customDateRange.from || 
    customDateRange.to;

  const handlePrepTaskOverrideSave = useCallback(async () => {
    if (!editingPrepTask || !profile?.id) return;

    try {
      const { error } = await supabase
        .from('order_prep_tasks' as any)
        .update({
          scheduled_start_time: prepTaskForm.scheduledStartTime || null,
          scheduled_ready_time: prepTaskForm.scheduledReadyTime || null,
          reminder_time: prepTaskForm.reminderTime || null,
          status: prepTaskForm.status,
          override_notes: prepTaskForm.overrideNotes || null,
          manual_override: true,
          overridden_by: profile.id,
        })
        .eq('id', editingPrepTask.id);

      if (error) throw error;

      toast({
        title: 'Prep Task Updated',
        description: `${editingPrepTask.prep_item_name} has been manually overridden.`,
      });

      setPrepTaskDialogOpen(false);
      setEditingPrepTask(null);
      await refetchAll();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update prep task.',
        variant: 'destructive',
      });
    }
  }, [editingPrepTask, prepTaskForm, profile?.id, refetchAll, toast]);

  return (
    <div className="space-y-4 p-4">
      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex gap-2 md:gap-3 items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders, customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 md:pl-10 h-8 md:h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 md:h-9 gap-1.5 shrink-0"
            onClick={() => setNewOrderOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">New Order</span>
          </Button>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9 shrink-0"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
          >
            <Filter className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </Button>
          <div className="flex items-center gap-0.5 p-0.5 md:p-1 bg-secondary/50 rounded-lg shrink-0">
            <Toggle
              pressed={viewMode === 'kanban'}
              onPressedChange={() => setViewMode('kanban')}
              size="sm"
              className="h-7 w-7 md:h-8 md:w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="h-7 w-7 md:h-8 md:w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Toggle>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-secondary/30 border border-border animate-fade-in">
            <Select value={dateFilter} onValueChange={(v) => {
              setDateFilter(v as DateFilter);
              if (v !== 'custom') setCustomDateRange({ from: undefined, to: undefined });
            }}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="upcoming">Active Orders</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="past">Completed</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
              <ConversationDateFilter
                dateRange={customDateRange}
                onChange={setCustomDateRange}
              />
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-1.5">
                      {config.icon}
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="created_at_desc">Newest First</SelectItem>
                <SelectItem value="created_at_asc">Oldest First</SelectItem>
                <SelectItem value="pickup_time_asc">Pickup Time</SelectItem>
                <SelectItem value="customer_name">Customer Name</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <XCircle className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}

            <div className="flex items-center ml-auto text-xs text-muted-foreground">
              {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {orders.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Orders from conversations or manually created will appear here.
            </p>
            <Button onClick={() => setNewOrderOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No matching orders</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              No orders match your current filters.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XCircle className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <OrderKanbanBoard
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          onOrderClick={openOrderDetails}
          isUpdating={false}
        />
      ) : (
        <div className="grid gap-3">
          {filteredOrders.map(order => (
            <Card key={order.id} className="glass hover:border-primary/50 transition-colors cursor-pointer" onClick={() => openOrderDetails(order)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {order.lead?.name || order.pickup_name || 'Guest Order'}
                    </h3>
                    <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                      {order.lead?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" />
                          {order.lead.phone}
                        </div>
                      )}
                      {order.pickup_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          Pickup: {new Date(order.pickup_time).toLocaleTimeString()}
                        </div>
                      )}
                      {getPrepTasksForOrder(order.id)[0]?.scheduled_start_time && (
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-3.5 h-3.5" />
                          Prep starts: {format(new Date(getPrepTasksForOrder(order.id)[0].scheduled_start_time as string), 'h:mm a')}
                        </div>
                      )}
                    </div>
                    {Array.isArray(order.order_items) && order.order_items.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {order.order_items.length} item(s) • {formatCurrency(order.total_amount || 0)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusConfig[order.status as keyof typeof statusConfig]?.color}>
                      <span className="mr-1">
                        {statusConfig[order.status as keyof typeof statusConfig]?.icon}
                      </span>
                      {statusConfig[order.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Order Dialog */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              New Order
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="customerName"
                  placeholder="Enter customer name"
                  value={newOrder.customerName}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, customerName: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="customerPhone"
                    placeholder={phonePlaceholder}
                    value={newOrder.customerPhone}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupTime">Pickup Time</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pickupTime"
                    type="datetime-local"
                    value={newOrder.pickupTime}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, pickupTime: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="items">Order Items (one per line)</Label>
              <Textarea
                id="items"
                placeholder="e.g.&#10;2x Burger&#10;1x Fries&#10;1x Drink"
                value={newOrder.items}
                onChange={(e) => setNewOrder(prev => ({ ...prev, items: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Special instructions or notes..."
                value={newOrder.notes}
                onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={creatingOrder}>
              {creatingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-warning" />
              Order Details
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-2">
              {/* Customer Info */}
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedOrder.pickup_name || selectedOrder.lead?.name || 'Unknown Customer'}
                    </p>
                    {selectedOrder.lead?.phone && (
                      <p className="text-sm text-muted-foreground">{selectedOrder.lead.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium text-foreground mb-2">Order Items</h4>
                <div className="space-y-2">
                  {getOrderItems(selectedOrder).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                        <p className="font-medium text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(selectedOrder.total_amount ?? calculateTotal(getOrderItems(selectedOrder)))}
                  </span>
                </div>
              </div>

              {/* Pickup Info */}
              {selectedOrder.pickup_time && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 text-warning">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Pickup Time</span>
                  </div>
                  <p className="text-sm text-foreground mt-1">
                    {format(new Date(selectedOrder.pickup_time), 'EEEE, MMMM d • h:mm a')}
                  </p>
                </div>
              )}

              {getPrepTasksForOrder(selectedOrder.id).length > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="font-medium text-foreground">Prep Tasks</h4>
                    <p className="text-xs text-muted-foreground">
                      Generated from menu prep timing and customer pickup time.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {getPrepTasksForOrder(selectedOrder.id).map((task) => (
                      <div key={task.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-sm text-foreground">
                              {task.quantity}x {task.prep_item_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Prep window: {task.scheduled_start_time ? format(new Date(task.scheduled_start_time), 'MMM d, h:mm a') : 'Not set'} to {task.scheduled_ready_time ? format(new Date(task.scheduled_ready_time), 'h:mm a') : 'Not set'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Reminder: {task.reminder_time ? format(new Date(task.reminder_time), 'MMM d, h:mm a') : 'Not set'}
                            </p>
                            {task.override_notes && (
                              <p className="text-xs text-muted-foreground">Notes: {task.override_notes}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className={prepTaskStatusConfig[task.status]?.tone || prepTaskStatusConfig.scheduled.tone}>
                              {prepTaskStatusConfig[task.status]?.label || task.status}
                            </Badge>
                            {task.manual_override && (
                              <Badge variant="secondary" className="text-[10px]">
                                Manual override
                              </Badge>
                            )}
                            {effectiveIsClientAdmin && (
                              <Button variant="outline" size="sm" onClick={() => openPrepTaskOverride(task)}>
                                Override
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Notes:</span> {selectedOrder.notes}
                </div>
              )}

              {/* Status Update */}
              <div className="pt-2">
                <Label className="text-sm mb-2 block">Update Status</Label>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => {
                    handleStatusChange(selectedOrder.id, value);
                    setSelectedOrder(prev => prev ? { ...prev, status: value } : null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {Object.entries(statusConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prepTaskDialogOpen} onOpenChange={setPrepTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-primary" />
              Override Prep Task
            </DialogTitle>
          </DialogHeader>

          {editingPrepTask && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                Client admin override for {editingPrepTask.quantity}x {editingPrepTask.prep_item_name}
              </div>
              <div className="space-y-2">
                <Label>Prep Start</Label>
                <Input
                  type="datetime-local"
                  value={prepTaskForm.scheduledStartTime}
                  onChange={(e) => setPrepTaskForm((prev) => ({ ...prev, scheduledStartTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ready By</Label>
                <Input
                  type="datetime-local"
                  value={prepTaskForm.scheduledReadyTime}
                  onChange={(e) => setPrepTaskForm((prev) => ({ ...prev, scheduledReadyTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reminder Time</Label>
                <Input
                  type="datetime-local"
                  value={prepTaskForm.reminderTime}
                  onChange={(e) => setPrepTaskForm((prev) => ({ ...prev, reminderTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={prepTaskForm.status} onValueChange={(value) => setPrepTaskForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {Object.entries(prepTaskStatusConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Override Notes</Label>
                <Textarea
                  value={prepTaskForm.overrideNotes}
                  onChange={(e) => setPrepTaskForm((prev) => ({ ...prev, overrideNotes: e.target.value }))}
                  placeholder="Reason for changing the automatic prep schedule"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrepTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrepTaskOverrideSave}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
