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
  Briefcase,
  PieChart,
  DollarSign,
  Download,
  Clock,
  Check,
  TrendingUp
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
  isWithinInterval,
  addDays
} from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGoogleCalendar, CalendarEvent, GoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useOperationalExpenses, OperationalExpense } from '@/hooks/useOperationalExpenses';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { JayOperationsAnalytics } from '@/components/operations/JayOperationsAnalytics';
import { AllExpensesDialog } from '@/components/operations/AllExpensesDialog';
import { PeriodFilter, PeriodType, getDateRangeFromPeriod } from '@/components/operations/PeriodFilter';
import { AddOperationalEventDialog } from '@/components/operations/AddOperationalEventDialog';
import { DayEventsDialog } from '@/components/operations/DayEventsDialog';
import { EventDetailDialog } from '@/components/operations/EventDetailDialog';
import { OperationsExportImport } from '@/components/operations/OperationsExportImport';
import type { ImportedExpense } from '@/components/operations/ExpenseImportDialog';

function JayOperationsContent() {
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

  // Calendar state
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [_googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);

  // Fast lookup for deduping generated calendar events
  const googleEventIdSet = useMemo(() => new Set(events.map(e => e.id)), [events]);
  
  // UI state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<OperationalExpense | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState('overview');
  
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
  const expenseTypeOptions = getOperationsExpenseTypes('jay');

  // Initialize calendar connection check
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

  // Calendar days
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get expenses for a specific day
  const getExpensesForDay = useCallback((day: Date) => {
    return expenses.filter(expense => {
      const expenseDate = parseISO(expense.expense_date);
      return isSameDay(expenseDate, day);
    });
  }, [expenses]);

  // Get due date expenses for a specific day
  const getDueDatesForDay = useCallback((day: Date) => {
    return expenses.filter(expense => {
      if (!expense.due_date || expense.is_paid) return false;
      const dueDate = parseISO(expense.due_date);
      return isSameDay(dueDate, day);
    });
  }, [expenses]);

  // Combined calendar items for a day
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

    // Google Calendar Events
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

    // Expenses on this day
    const dayExpenses = getExpensesForDay(day);
    dayExpenses.forEach((expense, idx) => {
      items.push({
        type: 'expense',
        id: `expense-${expense.id}`,
        title: `💰 ${expense.expense_type}`,
        color: 'hsl(var(--success))',
        originalExpense: expense,
      });
    });

    // Due dates on this day
    const dayDues = getDueDatesForDay(day);
    dayDues.forEach((expense, idx) => {
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
    totalTitle: 'Operating Spend',
    pendingTitle: 'Open Payables',
    overdueTitle: 'Urgent Follow-ups',
    dailyLabel: 'Variable',
    monthlyLabel: 'Fixed',
    pendingNoun: 'cost item',
    overdueAttentionLabel: 'Payment follow-up needed',
    overdueClearLabel: 'Nothing urgent',
  } as const;

  return (
    <div className="space-y-4 lg:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Sales Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track sales support spend, fixed operating costs, and client-facing schedules
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <OperationsExportImport
            allExpenses={expenses}
            filteredExpenses={filteredExpenses}
            onImportComplete={handleImportExpenses}
            filenamePrefix="jay-operations"
            pageTitle="Jay Operations"
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
            Log Spend
          </Button>
        </div>
      </div>

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
              <TabsTrigger value="overview" className="gap-2">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Spending</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <PieChart className="h-4 w-4" />
                <span className="hidden sm:inline">Run Rate</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Appointments</span>
              </TabsTrigger>
            </TabsList>
            
            {(activeTab === 'overview' || activeTab === 'analytics') && (
              <PeriodFilter
                period={period}
                onPeriodChange={setPeriod}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onCustomDateChange={handleCustomDateChange}
              />
            )}
          </div>
          {/* Expenses Tab */}
          <TabsContent value="overview" className="p-4 space-y-6">
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
                    <h2 className="text-lg font-semibold">Variable Spend</h2>
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
                    title="Recent Variable Spend"
                    expenses={dailyExpenses.slice(0, 10)}
                    totalExpenses={dailyExpenses.length}
                    onMarkPaid={markAsPaid}
                    onMarkUnpaid={markAsUnpaid}
                    onDelete={deleteExpense}
                    onEdit={openEditExpense}
                    onViewAll={() => setViewAllDailyOpen(true)}
                    emptyMessage="No sales-support spend logged yet"
                  />
                </div>

                {/* Monthly Expenses */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Fixed Operating Costs</h2>
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
                    title="Recent Fixed Costs"
                    expenses={monthlyExpenses.slice(0, 10)}
                    totalExpenses={monthlyExpenses.length}
                    onMarkPaid={markAsPaid}
                    onMarkUnpaid={markAsUnpaid}
                    onDelete={deleteExpense}
                    onEdit={openEditExpense}
                    onViewAll={() => setViewAllMonthlyOpen(true)}
                    emptyMessage="No recurring operating costs logged yet"
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="p-4 space-y-6">
            <JayOperationsAnalytics expenses={filteredExpenses} />
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
                    Connect your Google account to manage consultations, demos, site visits, and follow-up appointments
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
                    Add Appointment
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

      {/* Dialogs */}
      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onSubmit={createExpense}
        roomUnits={[]} // Jay doesn't have rooms
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

export default function JayOperations() {
  return (
    <ErrorBoundary fullPage>
      <JayOperationsContent />
    </ErrorBoundary>
  );
}
