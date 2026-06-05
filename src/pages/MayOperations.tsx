import { useState, useEffect, useMemo, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { 
  Plus, 
  RefreshCw, 
  Loader2,
  Calendar as CalendarIcon,
  Receipt,
  Filter,
  ChevronLeft,
  ChevronRight,
  Settings,
  UtensilsCrossed,
  PieChart,
  DollarSign,
  Download,
  Package,
  AlertTriangle
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  parseISO,
  isToday,
  startOfWeek,
  endOfWeek,
  isWithinInterval
} from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleCalendar, CalendarEvent, GoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useOperationalExpenses, OperationalExpense } from '@/hooks/useOperationalExpenses';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getOperationsExpenseTypes } from '@/lib/operationsExpenseTypes';
import { AddExpenseDialog } from '@/components/operations/AddExpenseDialog';
import { EditExpenseDialog } from '@/components/operations/EditExpenseDialog';
import { ExpenseList } from '@/components/operations/ExpenseList';
import { ExpenseSummaryCards } from '@/components/operations/ExpenseSummaryCards';
import { MayOperationsAnalytics } from '@/components/operations/MayOperationsAnalytics';
import { AllExpensesDialog } from '@/components/operations/AllExpensesDialog';
import { PeriodFilter, PeriodType, getDateRangeFromPeriod } from '@/components/operations/PeriodFilter';
import { AddOperationalEventDialog } from '@/components/operations/AddOperationalEventDialog';
import { DayEventsDialog } from '@/components/operations/DayEventsDialog';
import { EventDetailDialog } from '@/components/operations/EventDetailDialog';
import { OperationsExportImport } from '@/components/operations/OperationsExportImport';
import type { ImportedExpense } from '@/components/operations/ExpenseImportDialog';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/shared/ResponsiveDialog';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  category: string;
  last_updated: string;
}

function MayOperationsContent() {
  const { profile } = useAuth();
  const { checkConnection, listCalendars, listEvents, createEvent, isLoading: _calendarLoading } = useGoogleCalendar();
  const { syncCalendars, isSyncing } = useCalendarSync();
  const { toast } = useToast();
  
  const {
    expenses,
    loading: expensesLoading,
    saving,
    unsyncedCount,
    fetchExpenses,
    createExpense,
    updateExpense,
    markAsPaid,
    markAsUnpaid,
    deleteExpense,
    syncExpensesToCalendar,
  } = useOperationalExpenses();

  const formatCurrency = useFormatCurrency();

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [addInventoryOpen, setAddInventoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventoryFormData, setInventoryFormData] = useState({
    name: '',
    quantity: '0',
    unit: 'kg',
    low_stock_threshold: '10',
    category: 'ingredients',
  });

  // Calendar state
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [_googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  const googleEventIdSet = useMemo(() => new Set(events.map(e => e.id)), [events]);
  
  // UI state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<OperationalExpense | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState('inventory');
  
  // Period filter state
  const [period, setPeriod] = useState<PeriodType>('this-month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  
  // View all dialogs
  const [viewAllDailyOpen, setViewAllDailyOpen] = useState(false);
  const [viewAllMonthlyOpen, setViewAllMonthlyOpen] = useState(false);
  
  // Create event state
  const [addEventOpen, setAddEventOpen] = useState(false);
  
  // Day events dialog state
  const [dayEventsDialogOpen, setDayEventsDialogOpen] = useState(false);
  const [addEventDefaultDate, setAddEventDefaultDate] = useState<Date | undefined>();
  
  // Event detail dialog state
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const expenseTypeOptions = getOperationsExpenseTypes('may');

  // Fetch inventory
  const fetchInventory = async () => {
    if (!profile?.organization_id) return;
    
    setInventoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items' as any)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;
      setInventory((data as any) || []);
    } catch (error) {
      devError('Error fetching inventory:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load inventory', 
        variant: 'destructive' 
      });
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [profile?.organization_id]);

  // Initialize calendar
  useEffect(() => {
    const init = async () => {
      try {
        const result = await checkConnection();
        setIsConnected(result.connected);
        
        if (result.connected) {
          const cals = await listCalendars();
          setGoogleCalendars(cals);
          await loadEvents();
        }
      } catch (error) {
        devError('Calendar initialization error:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    init();
  }, [checkConnection, listCalendars]);

  const loadEvents = async () => {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(addMonths(currentMonth, 2));
      
      const calendarEvents = await listEvents();
      
      setEvents(calendarEvents);
    } catch (error) {
      devError('Error loading events:', error);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadEvents();
    }
  }, [currentMonth, isConnected]);

  const handleCustomDateChange = (start: Date | undefined, end: Date | undefined) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const { start: filterStart, end: filterEnd } = useMemo(
    () => getDateRangeFromPeriod(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDate = parseISO(expense.expense_date);
      const inDateRange = (!filterStart || expenseDate >= filterStart) && 
                         (!filterEnd || expenseDate <= filterEnd);
      
      return inDateRange;
    });
  }, [expenses, filterStart, filterEnd]);

  const dailyExpenses = useMemo(() => 
    filteredExpenses.filter(e => e.category === 'daily'),
    [filteredExpenses]
  );

  const monthlyExpenses = useMemo(() => 
    filteredExpenses.filter(e => e.category === 'monthly'),
    [filteredExpenses]
  );

  const summary = useMemo(() => ({
    totalExpenses: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    paidTotal: filteredExpenses.filter(e => e.is_paid).reduce((sum, e) => sum + Number(e.amount), 0),
    unpaidTotal: filteredExpenses.filter(e => !e.is_paid).reduce((sum, e) => sum + Number(e.amount), 0),
    overdueCount: filteredExpenses.filter(e => !e.is_paid && e.due_date && new Date(e.due_date) < new Date()).length,
  }), [filteredExpenses]);

  const lowStockItems = useMemo(() => 
    inventory.filter(item => item.quantity <= item.low_stock_threshold),
    [inventory]
  );

  // Calendar days
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getExpensesForDay = useCallback((day: Date) => {
    return expenses.filter(expense => {
      const expenseDate = parseISO(expense.expense_date);
      return isSameDay(expenseDate, day);
    });
  }, [expenses]);

  const getDueDatesForDay = useCallback((day: Date) => {
    return expenses.filter(expense => {
      if (!expense.due_date || expense.is_paid) return false;
      const dueDate = parseISO(expense.due_date);
      return isSameDay(dueDate, day);
    });
  }, [expenses]);

  interface CalendarDayItem {
    type: 'event' | 'expense' | 'due';
    id: string;
    title: string;
    color: string;
    originalEvent?: CalendarEvent;
    originalExpense?: OperationalExpense;
  }

  const getCalendarItemsForDay = useCallback((day: Date): CalendarDayItem[] => {
    const items: CalendarDayItem[] = [];

    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.startTime);
      return isSameDay(eventStart, day);
    });
    
    dayEvents.forEach(event => {
      items.push({
        type: 'event',
        id: event.id,
        title: event.title || 'Untitled',
        color: 'hsl(var(--primary))',
        originalEvent: event,
      });
    });

    const dayExpenses = getExpensesForDay(day);
    dayExpenses.forEach((expense) => {
      items.push({
        type: 'expense',
        id: `expense-${expense.id}`,
        title: `💰 ${expense.expense_type}`,
        color: 'hsl(var(--success))',
        originalExpense: expense,
      });
    });

    const dayDues = getDueDatesForDay(day);
    dayDues.forEach((expense) => {
      items.push({
        type: 'due',
        id: `due-${expense.id}`,
        title: `⚠️ ${expense.expense_type} due`,
        color: 'hsl(var(--destructive))',
        originalExpense: expense,
      });
    });

    return items;
  }, [events, getExpensesForDay, getDueDatesForDay]);

  const openAddExpense = (category: 'daily' | 'monthly') => {
    setDefaultCategory(category);
    setAddExpenseOpen(true);
  };

  const openEditExpense = (expense: OperationalExpense) => {
    setSelectedExpense(expense);
    setEditExpenseOpen(true);
  };

  const handleSyncCalendars = async () => {
    await syncCalendars(true);
    if (isConnected) {
      await loadEvents();
    }
    await fetchExpenses();
    toast({ title: 'Synced', description: 'Calendars and expenses synced successfully' });
  };

  const handleCreateCalendarEvent = async (data: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
  }) => {
    try {
      await createEvent(data);
      
      toast({ title: 'Success', description: 'Event created successfully' });
      await loadEvents();
      setAddEventOpen(false);
    } catch (error) {
      devError('Error creating event:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to create event', 
        variant: 'destructive' 
      });
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDayEventsDialogOpen(true);
  };

  const handleImportExpenses = async (importedExpenses: ImportedExpense[]) => {
    // Import each expense
    const promises = importedExpenses.map(expense => createExpense(expense));
    await Promise.all(promises);
    
    // Refresh the expenses list
    await fetchExpenses();
  };

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    try {
      const itemData = {
        organization_id: profile.organization_id,
        name: inventoryFormData.name,
        quantity: parseFloat(inventoryFormData.quantity),
        unit: inventoryFormData.unit,
        low_stock_threshold: parseFloat(inventoryFormData.low_stock_threshold),
        category: inventoryFormData.category,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventory_items' as any)
          .update(itemData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: 'Updated', description: 'Inventory item updated' });
      } else {
        const { error } = await supabase
          .from('inventory_items' as any)
          .insert(itemData);
        
        if (error) throw error;
        toast({ title: 'Added', description: 'Inventory item added' });
      }

      setAddInventoryOpen(false);
      setEditingItem(null);
      setInventoryFormData({
        name: '',
        quantity: '0',
        unit: 'kg',
        low_stock_threshold: '10',
        category: 'ingredients',
      });
      fetchInventory();
    } catch (error) {
      devError('Error saving inventory:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save inventory item', 
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteInventory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inventory_items' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Inventory item removed' });
      fetchInventory();
    } catch (error) {
      devError('Error deleting inventory:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete inventory item', 
        variant: 'destructive' 
      });
    }
  };

  const openEditInventory = (item: InventoryItem) => {
    setEditingItem(item);
    setInventoryFormData({
      name: item.name,
      quantity: item.quantity.toString(),
      unit: item.unit,
      low_stock_threshold: item.low_stock_threshold.toString(),
      category: item.category,
    });
    setAddInventoryOpen(true);
  };

  const selectedDateEvents = useMemo(() => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      return isSameDay(eventStart, selectedDate);
    });
  }, [events, selectedDate]);

  const selectedDateExpenses = useMemo(() => 
    getExpensesForDay(selectedDate),
    [selectedDate, getExpensesForDay]
  );

  const selectedDateDues = useMemo(() => 
    getDueDatesForDay(selectedDate),
    [selectedDate, getDueDatesForDay]
  );

  const summaryCopy = {
    totalTitle: 'Food Operations Spend',
    pendingTitle: 'Outstanding Payables',
    overdueTitle: 'Critical Due',
    dailyLabel: 'Purchasing',
    monthlyLabel: 'Overhead',
    pendingNoun: 'bill',
    overdueAttentionLabel: 'Supplier payment needs attention',
    overdueClearLabel: 'Kitchen payables on track',
  } as const;

  return (
    <div className="space-y-4 lg:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-warning" />
            Restaurant Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage kitchen inventory, purchasing, overhead, and daily service schedules
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <OperationsExportImport
            allExpenses={expenses}
            filteredExpenses={filteredExpenses}
            onImportComplete={handleImportExpenses}
            filenamePrefix="may-operations"
            pageTitle="Restaurant Operations"
            size="sm"
          />
          
          {unsyncedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncExpensesToCalendar()}
              disabled={saving || !isConnected}
            >
              <Settings className="h-4 w-4 mr-2" />
              Sync {unsyncedCount} to Calendar
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncCalendars}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
            Sync
          </Button>

          <Button
            variant="glow"
            size="sm"
            onClick={() => openAddExpense('daily')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Log Purchase
          </Button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="glass border-warning/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">{lowStockItems.length} item(s) low on stock</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <ExpenseSummaryCards
        summary={{
          totalExpenses: summary.totalExpenses,
          dailyTotal: dailyExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
          monthlyTotal: monthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
          unpaidCount: filteredExpenses.filter(e => !e.is_paid).length,
          unpaidTotal: summary.unpaidTotal,
          overdueCount: summary.overdueCount,
        }}
        copy={summaryCopy}
      />

      {/* Tabs */}
      <Card className="glass">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="inventory" className="gap-2" onClick={() => setActiveTab('inventory')}>
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Inventory</span>
              </TabsTrigger>
              <TabsTrigger value="expenses" className="gap-2" onClick={() => setActiveTab('expenses')}>
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Purchasing</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2" onClick={() => setActiveTab('analytics')}>
                <PieChart className="h-4 w-4" />
                <span className="hidden sm:inline">Cost Mix</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2" onClick={() => setActiveTab('calendar')}>
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Schedules</span>
              </TabsTrigger>
            </TabsList>
            
            {(activeTab === 'expenses' || activeTab === 'analytics') && (
              <PeriodFilter
                period={period}
                onPeriodChange={setPeriod}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onCustomDateChange={handleCustomDateChange}
              />
            )}
          </div>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Inventory and Stock Levels</h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setInventoryFormData({
                    name: '',
                    quantity: '0',
                    unit: 'kg',
                    low_stock_threshold: '10',
                    category: 'ingredients',
                  });
                  setAddInventoryOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {inventoryLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : inventory.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No kitchen inventory items yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inventory.map(item => (
                  <Card 
                    key={item.id} 
                    className={cn(
                      "glass",
                      item.quantity <= item.low_stock_threshold && "border-warning/50"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className={cn(
                            "font-semibold",
                            item.quantity <= item.low_stock_threshold && "text-warning"
                          )}>
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Low Stock:</span>
                          <span className="text-xs">{item.low_stock_threshold} {item.unit}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditInventory(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteInventory(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="p-4 space-y-6">
            {expensesLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Daily Expenses */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Purchasing and Consumables</h2>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openAddExpense('daily')}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <ExpenseList
                    title="Recent Purchasing"
                    expenses={dailyExpenses.slice(0, 10)}
                    totalExpenses={dailyExpenses.length}
                    onMarkPaid={markAsPaid}
                    onMarkUnpaid={markAsUnpaid}
                    onDelete={deleteExpense}
                    onEdit={openEditExpense}
                    onViewAll={() => setViewAllDailyOpen(true)}
                    emptyMessage="No ingredient or supply purchases logged yet"
                  />
                </div>

                {/* Monthly Expenses */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recurring Overhead</h2>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openAddExpense('monthly')}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <ExpenseList
                    title="Recent Overhead"
                    expenses={monthlyExpenses.slice(0, 10)}
                    totalExpenses={monthlyExpenses.length}
                    onMarkPaid={markAsPaid}
                    onMarkUnpaid={markAsUnpaid}
                    onDelete={deleteExpense}
                    onEdit={openEditExpense}
                    onViewAll={() => setViewAllMonthlyOpen(true)}
                    emptyMessage="No recurring kitchen overhead logged yet"
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="p-4 space-y-6">
            <MayOperationsAnalytics expenses={filteredExpenses} inventory={inventory} />
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="p-4">
            {isInitialLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !isConnected ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Connect to Google</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your Google account to coordinate prep, delivery, purchasing, and service schedules
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Calendar Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold min-w-[200px] text-center">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddEventDefaultDate(new Date());
                      setAddEventOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                  
                  {days.map(day => {
                    const items = getCalendarItemsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isCurrentDay = isToday(day);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "min-h-[80px] p-2 border rounded-lg text-left transition-colors hover:bg-accent",
                          !isCurrentMonth && "opacity-30",
                          isCurrentDay && "border-primary bg-primary/5"
                        )}
                      >
                        <div className={cn(
                          "text-sm font-medium mb-1",
                          isCurrentDay && "text-primary"
                        )}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {items.slice(0, 2).map(item => (
                            <div
                              key={item.id}
                              className="text-xs p-1 rounded truncate"
                              style={{ backgroundColor: `${item.color}20`, color: item.color }}
                            >
                              {item.title}
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{items.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Inventory Dialog */}
      <ResponsiveDialog open={addInventoryOpen} onOpenChange={setAddInventoryOpen}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editingItem ? 'Edit' : 'Add'} Inventory Item
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <form onSubmit={handleInventorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={inventoryFormData.name}
                onChange={(e) => setInventoryFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={inventoryFormData.quantity}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select value={inventoryFormData.unit} onValueChange={(value) => setInventoryFormData(prev => ({ ...prev, unit: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="L">Liters (L)</SelectItem>
                    <SelectItem value="ml">Milliliters (ml)</SelectItem>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Threshold *</Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={inventoryFormData.low_stock_threshold}
                onChange={(e) => setInventoryFormData(prev => ({ ...prev, low_stock_threshold: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={inventoryFormData.category} onValueChange={(value) => setInventoryFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingredients">Ingredients</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                  <SelectItem value="supplies">Supplies</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddInventoryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow">
                {editingItem ? 'Update' : 'Add'} Item
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogBody>
      </ResponsiveDialog>

      {/* Dialogs */}
      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onSubmit={createExpense}
        roomUnits={[]} // May doesn't have rooms
        saving={saving}
        defaultCategory={defaultCategory}
        expenseTypeOptions={expenseTypeOptions}
      />

      <EditExpenseDialog
        expense={selectedExpense}
        open={editExpenseOpen}
        onOpenChange={setEditExpenseOpen}
        onSubmit={updateExpense}
        roomUnits={[]}
        saving={saving}
        expenseTypeOptions={expenseTypeOptions}
      />

      <AllExpensesDialog
        open={viewAllDailyOpen}
        onOpenChange={setViewAllDailyOpen}
        title="All Daily Expenses"
        expenses={dailyExpenses}
        onMarkPaid={markAsPaid}
        onMarkUnpaid={markAsUnpaid}
        onDelete={deleteExpense}
        onEdit={(expense) => {
          setViewAllDailyOpen(false);
          openEditExpense(expense);
        }}
      />

      <AllExpensesDialog
        open={viewAllMonthlyOpen}
        onOpenChange={setViewAllMonthlyOpen}
        title="All Monthly Expenses"
        expenses={monthlyExpenses}
        onMarkPaid={markAsPaid}
        onMarkUnpaid={markAsUnpaid}
        onDelete={deleteExpense}
        onEdit={(expense) => {
          setViewAllMonthlyOpen(false);
          openEditExpense(expense);
        }}
      />

      <AddOperationalEventDialog
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        onSubmitGeneralEvent={handleCreateCalendarEvent}
        roomUnits={[]}
        saving={false}
        defaultDate={addEventDefaultDate}
        isCalendarConnected={isConnected}
        supportedEventTypes={['general']}
      />

      <DayEventsDialog
        open={dayEventsDialogOpen}
        onOpenChange={setDayEventsDialogOpen}
        selectedDate={selectedDate}
        events={selectedDateEvents}
        expenses={selectedDateExpenses}
        dueExpenses={selectedDateDues}
        maintenanceBlocks={[]}
        formatCurrency={formatCurrency}
        onEditExpense={openEditExpense}
        onEditMaintenance={() => {}}
      />

      <EventDetailDialog
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        event={selectedEvent}
      />
    </div>
  );
}

export default function MayOperations() {
  return (
    <ErrorBoundary fullPage>
      <MayOperationsContent />
    </ErrorBoundary>
  );
}
