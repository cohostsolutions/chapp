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
  BedDouble,
  PieChart,
  Wrench,
  DollarSign,
  Download,
  Clock,
  Check
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
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleCalendar, CalendarEvent, GoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useOperationalExpenses, OperationalExpense } from '@/hooks/useOperationalExpenses';
import { useMaintenanceBlocks, MaintenanceBlock } from '@/hooks/useMaintenanceBlocks';
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
import { ExpenseBreakdownChart } from '@/components/operations/ExpenseBreakdownChart';
import { AllExpensesDialog } from '@/components/operations/AllExpensesDialog';
import { PeriodFilter, PeriodType, getDateRangeFromPeriod } from '@/components/operations/PeriodFilter';
import { AddOperationalEventDialog } from '@/components/operations/AddOperationalEventDialog';
import { EditMaintenanceBlockDialog } from '@/components/operations/EditMaintenanceBlockDialog';
import { MaintenanceBlocksList } from '@/components/operations/MaintenanceBlocksList';
import { DayEventsDialog } from '@/components/operations/DayEventsDialog';
import { EventDetailDialog } from '@/components/operations/EventDetailDialog';
import { OperationsExportImport } from '@/components/operations/OperationsExportImport';
import type { ImportedExpense } from '@/components/operations/ExpenseImportDialog';

interface RoomUnit {
  id: string;
  name: string;
}

const _FALLBACK_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(199 89% 48%)',
];

function OperationsContent() {
  const { profile, aiAgentType } = useAuth();
  const { checkConnection, listCalendars, listEvents, createEvent, isLoading: _calendarLoading } = useGoogleCalendar();
  const { syncCalendars, isSyncing } = useCalendarSync();
  const { toast } = useToast();
  
  const {
    expenses,
    loading: expensesLoading,
    saving,
    summary: _summary,
    unsyncedCount,
    fetchExpenses,
    createExpense,
    updateExpense,
    markAsPaid,
    markAsUnpaid,
    deleteExpense,
    syncExpensesToCalendar,
  } = useOperationalExpenses();

  const {
    blocks: maintenanceBlocks,
    loading: maintenanceLoading,
    saving: maintenanceSaving,
    createBlock,
    updateBlock,
    deleteBlock,
  } = useMaintenanceBlocks();

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
  
  // Room units for expense tracking
  const [roomUnits, setRoomUnits] = useState<RoomUnit[]>([]);
  
  // UI state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [editMaintenanceOpen, setEditMaintenanceOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<OperationalExpense | null>(null);
  const [selectedMaintenanceBlock, setSelectedMaintenanceBlock] = useState<MaintenanceBlock | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<'daily' | 'monthly'>('daily');
  const [roomFilter, setRoomFilter] = useState<string>('all');
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
  
  // Individual event detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);

  // Touch/swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;
  const expenseTypeOptions = getOperationsExpenseTypes('cece');

  // Fetch room units
  useEffect(() => {
    const fetchRoomUnits = async () => {
      if (!profile?.organization_id) return;
      
      const { data } = await supabase
        .from('room_units')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name');
      
      if (data) setRoomUnits(data);
    };
    
    fetchRoomUnits();
  }, [profile?.organization_id]);

  // Check calendar connection
  useEffect(() => {
    const checkCalendar = async () => {
      const connection = await checkConnection();
      setIsConnected(connection?.connected ?? false);
      setIsInitialLoading(false);
      
      if (connection?.connected) {
        loadCalendarData();
      }
    };
    checkCalendar();
  }, []);

  const loadCalendarData = async () => {
    try {
      const calendarsData = await listCalendars();
      setGoogleCalendars(calendarsData);
      
      const eventsData = await listEvents();
      setEvents(eventsData);
    } catch (error) {
      devError('Error loading calendar data:', error);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadCalendarData();
    }
  }, [currentMonth, isConnected]);

  // Get date range for filtering
  const dateRange = useMemo(() => 
    getDateRangeFromPeriod(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  // Filter expenses by room and period
  const filteredExpenses = useMemo(() => {
    let filtered = expenses;
    
    // Room filter
    if (roomFilter !== 'all') {
      if (roomFilter === 'org-wide') {
        filtered = filtered.filter(e => !e.room_unit_id);
      } else {
        filtered = filtered.filter(e => e.room_unit_id === roomFilter);
      }
    }
    
    // Period filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(e => {
        const expenseDate = parseISO(e.expense_date);
        return isWithinInterval(expenseDate, { start: dateRange.start!, end: dateRange.end! });
      });
    }
    
    return filtered;
  }, [expenses, roomFilter, dateRange]);

  const dailyExpenses = filteredExpenses.filter(e => e.category === 'daily');
  const monthlyExpenses = filteredExpenses.filter(e => e.category === 'monthly');

  // Filtered summary for cards
  const filteredSummary = useMemo(() => ({
    totalExpenses: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    dailyTotal: dailyExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    monthlyTotal: monthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    unpaidCount: filteredExpenses.filter(e => !e.is_paid).length,
    unpaidTotal: filteredExpenses.filter(e => !e.is_paid).reduce((sum, e) => sum + Number(e.amount), 0),
    overdueCount: filteredExpenses.filter(e => !e.is_paid && e.due_date && new Date(e.due_date) < new Date()).length,
  }), [filteredExpenses, dailyExpenses, monthlyExpenses]);

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

  // Get maintenance blocks for a specific day
  const getMaintenanceForDay = useCallback((day: Date) => {
    return maintenanceBlocks.filter(block => {
      const startDate = parseISO(block.start_date);
      const endDate = parseISO(block.end_date);
      return isWithinInterval(day, { start: startDate, end: endDate });
    });
  }, [maintenanceBlocks]);

  // Combined calendar items for a day
  interface CalendarDayItem {
    type: 'event' | 'expense' | 'due' | 'maintenance';
    id: string;
    title: string;
    color: string;
    originalEvent?: CalendarEvent;
    originalExpense?: OperationalExpense;
    originalMaintenance?: MaintenanceBlock;
  }

  const getCalendarItemsForDay = useCallback((day: Date): CalendarDayItem[] => {
    const items: CalendarDayItem[] = [];

    // Google Calendar events
    events.filter(event => {
      const eventStart = parseISO(event.startTime);
      return isSameDay(eventStart, day);
    }).forEach(event => {
      items.push({
        type: 'event',
        id: event.id,
        title: event.title,
        color: 'hsl(var(--primary))',
        originalEvent: event,
      });
    });

    // Expense dates (only show as a separate item if the generated Google event isn't present)
    getExpensesForDay(day).forEach(expense => {
      const hasGeneratedGoogleEvent = !!expense.expense_calendar_event_id && googleEventIdSet.has(expense.expense_calendar_event_id);
      if (hasGeneratedGoogleEvent) return;

      items.push({
        type: 'expense',
        id: `exp-${expense.id}`,
        title: `${formatCurrency(Number(expense.amount))} - ${expense.expense_type}`,
        color: 'hsl(38 92% 50%)', // warning color
        originalExpense: expense,
      });
    });

    // Due dates (unpaid) (only show as a separate item if the generated Google event isn't present)
    getDueDatesForDay(day).forEach(expense => {
      const hasGeneratedGoogleEvent = !!expense.calendar_event_id && googleEventIdSet.has(expense.calendar_event_id);
      if (hasGeneratedGoogleEvent) return;

      items.push({
        type: 'due',
        id: `due-${expense.id}`,
        title: `Due: ${expense.expense_type}`,
        color: 'hsl(0 72% 51%)', // destructive color
        originalExpense: expense,
      });
    });

    // Maintenance blocks
    getMaintenanceForDay(day).forEach(block => {
      items.push({
        type: 'maintenance',
        id: `maint-${block.id}`,
        title: `🔧 ${block.title}`,
        color: 'hsl(280 65% 60%)', // purple
        originalMaintenance: block,
      });
    });

    return items;
  }, [events, googleEventIdSet, getExpensesForDay, getDueDatesForDay, getMaintenanceForDay]);

  // Events for selected date (includes expenses and maintenance)
  const selectedDateExpenses = useMemo(() => getExpensesForDay(selectedDate), [getExpensesForDay, selectedDate]);
  const selectedDateDues = useMemo(() => getDueDatesForDay(selectedDate), [getDueDatesForDay, selectedDate]);
  const selectedDateMaintenance = useMemo(() => getMaintenanceForDay(selectedDate), [getMaintenanceForDay, selectedDate]);
  const selectedDateEvents = useMemo(() => {
    return events.filter(event => {
      const eventStart = parseISO(event.startTime);
      return isSameDay(eventStart, selectedDate);
    });
  }, [events, selectedDate]);

  // Remove generated expense/due events from the Calendar Events list to avoid showing duplicates
  const selectedDateGeneratedEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of selectedDateExpenses) {
      if (e.expense_calendar_event_id) ids.add(e.expense_calendar_event_id);
    }
    for (const e of selectedDateDues) {
      if (e.calendar_event_id) ids.add(e.calendar_event_id);
    }
    return ids;
  }, [selectedDateExpenses, selectedDateDues]);

  const selectedDateEventsDeduped = useMemo(
    () => selectedDateEvents.filter(e => !selectedDateGeneratedEventIds.has(e.id)),
    [selectedDateEvents, selectedDateGeneratedEventIds]
  );

  // Upcoming items (next 7 days)
  const upcomingItems = useMemo(() => {
    const now = new Date();
    const nextWeek = addDays(now, 7);
    const items: Array<{
      type: 'event' | 'expense' | 'due' | 'maintenance';
      id: string;
      title: string;
      date: Date;
      color: string;
    }> = [];

    // Upcoming events
    events
      .filter(event => {
        const eventDate = parseISO(event.startTime);
        return eventDate >= now && eventDate <= nextWeek;
      })
      .forEach(event => {
        items.push({
          type: 'event',
          id: event.id,
          title: event.title,
          date: parseISO(event.startTime),
          color: 'hsl(var(--primary))',
        });
      });

    // Upcoming due dates
    expenses
      .filter(e => e.due_date && !e.is_paid)
      .filter(e => {
        const dueDate = parseISO(e.due_date!);
        return dueDate >= now && dueDate <= nextWeek;
      })
      .forEach(expense => {
        items.push({
          type: 'due',
          id: `due-${expense.id}`,
          title: `Due: ${expense.expense_type}`,
          date: parseISO(expense.due_date!),
          color: 'hsl(0 72% 51%)',
        });
      });

    // Upcoming maintenance
    maintenanceBlocks
      .filter(block => {
        const startDate = parseISO(block.start_date);
        return startDate >= now && startDate <= nextWeek;
      })
      .forEach(block => {
        items.push({
          type: 'maintenance',
          id: `maint-${block.id}`,
          title: block.title,
          date: parseISO(block.start_date),
          color: 'hsl(280 65% 60%)',
        });
      });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [events, expenses, maintenanceBlocks]);

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) < minSwipeDistance) return;
    
    if (distance > 0) {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const getEventsForDay = useCallback((day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.startTime);
      return isSameDay(eventStart, day);
    });
  }, [events]);

  const openAddExpense = (category: 'daily' | 'monthly') => {
    setDefaultCategory(category);
    setAddExpenseOpen(true);
  };

  const openAddEventDialog = (date?: Date) => {
    setAddEventDefaultDate(date || selectedDate);
    setAddEventOpen(true);
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
      toast({
        title: 'Event created',
        description: 'The event has been added to your calendar',
      });
      loadCalendarData();
    } catch (error) {
      devError('Error creating event:', error);
      toast({
        title: 'Failed to create event',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const openEditExpense = (expense: OperationalExpense) => {
    setSelectedExpense(expense);
    setEditExpenseOpen(true);
  };

  const openEditMaintenanceBlock = (block: MaintenanceBlock) => {
    setSelectedMaintenanceBlock(block);
    setEditMaintenanceOpen(true);
  };

  const handleImportExpenses = async (importedExpenses: ImportedExpense[]) => {
    const results = await Promise.all(importedExpenses.map((expense) => createExpense(expense)));
    const successfulImports = results.filter(Boolean).length;
    const failedImports = importedExpenses.length - successfulImports;

    if (failedImports > 0) {
      throw new Error(
        `Imported ${successfulImports} expense${successfulImports === 1 ? '' : 's'}, but ${failedImports} failed. Please review and retry the failed rows.`
      );
    }

    await fetchExpenses();
  };

  const handleCustomDateChange = (start: Date | undefined, end: Date | undefined) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  // If not a Cece organization, redirect or show message
  if (aiAgentType !== 'cece') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Operations</h1>
        <p className="text-muted-foreground">
          This page is only available for Cece AI organizations (hotels/vacation rentals).
        </p>
        <Link to="/dashboard">
          <Button className="mt-4">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Operations</h1>
          <p className="text-muted-foreground">
            Manage expenses, bills, and calendar for your property
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              fetchExpenses();
              if (isConnected) loadCalendarData();
            }}
            disabled={expensesLoading || isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (expensesLoading || isSyncing) && "animate-spin")} />
            Refresh
          </Button>
          <OperationsExportImport
            allExpenses={expenses}
            filteredExpenses={filteredExpenses}
            onImportComplete={handleImportExpenses}
            availableRooms={roomUnits}
            filenamePrefix="operations"
            pageTitle="Operations"
            size="sm"
          />
          <Button onClick={() => openAddExpense('daily')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <ExpenseSummaryCards summary={filteredSummary} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
          </TabsList>
          
          {(activeTab === 'overview' || activeTab === 'analytics') && (
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                period={period}
                onPeriodChange={setPeriod}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onCustomDateChange={handleCustomDateChange}
              />
              
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Expenses</SelectItem>
                  <SelectItem value="org-wide">Organization-wide</SelectItem>
                  {roomUnits.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      <span className="flex items-center gap-2">
                        <BedDouble className="h-3 w-3" />
                        {room.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Expenses Tab */}
        <TabsContent value="overview" className="space-y-6">
          {expensesLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-48" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-48" />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Daily Expenses */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Daily Expenses</h2>
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
                  title="Recent Daily Expenses"
                  expenses={dailyExpenses.slice(0, 10)}
                  totalExpenses={dailyExpenses.length}
                  onMarkPaid={markAsPaid}
                  onMarkUnpaid={markAsUnpaid}
                  onDelete={deleteExpense}
                  onEdit={openEditExpense}
                  onViewAll={() => setViewAllDailyOpen(true)}
                  emptyMessage="No daily expenses recorded"
                />
              </div>

              {/* Monthly Expenses */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Monthly Expenses</h2>
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
                  title="Monthly Bills & Expenses"
                  expenses={monthlyExpenses.slice(0, 10)}
                  totalExpenses={monthlyExpenses.length}
                  onMarkPaid={markAsPaid}
                  onMarkUnpaid={markAsUnpaid}
                  onDelete={deleteExpense}
                  onEdit={openEditExpense}
                  onViewAll={() => setViewAllMonthlyOpen(true)}
                  emptyMessage="No monthly expenses recorded"
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ExpenseBreakdownChart 
              expenses={dailyExpenses} 
              title="Daily Expenses by Type" 
            />
            <ExpenseBreakdownChart 
              expenses={monthlyExpenses} 
              title="Monthly Expenses by Type" 
            />
          </div>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          {/* Maintenance blocks section */}
          <MaintenanceBlocksList
            blocks={maintenanceBlocks}
            onDelete={deleteBlock}
            onEdit={openEditMaintenanceBlock}
            loading={maintenanceLoading}
          />

          {isInitialLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : !isConnected ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connect to Google</h3>
                <p className="text-muted-foreground mb-4">
                  Connect your Google account to view bookings alongside expenses and maintenance
                </p>
                <Link to="/calendar">
                  <Button>
                    <Settings className="h-4 w-4 mr-2" />
                    Go to Calendar Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Calendar Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {unsyncedCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncExpensesToCalendar}
                      disabled={saving}
                      className="border-warning text-warning hover:bg-warning/10"
                    >
                      <DollarSign className={cn("h-4 w-4 mr-2", saving && "animate-pulse")} />
                      Sync {unsyncedCount} Expense{unsyncedCount !== 1 ? 's' : ''}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncCalendars(true)}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                    Sync
                  </Button>
                  <Button size="sm" onClick={() => openAddEventDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Calendar Grid */}
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">{format(currentMonth, 'MMMM yyyy')}</span>
                        <span className="sm:hidden">{format(currentMonth, 'MMM yyyy')}</span>
                      </CardTitle>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                          onClick={() => {
                            setCurrentMonth(new Date());
                            setSelectedDate(new Date());
                          }}
                        >
                          Today
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div 
                    className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    {/* Day headers - short on mobile */}
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div
                        key={`${day}-${idx}`}
                        className="bg-muted p-1.5 sm:p-2 text-center text-xs font-medium text-muted-foreground"
                      >
                        <span className="sm:hidden">{day}</span>
                        <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}</span>
                      </div>
                    ))}
                    
                    {/* Calendar days */}
                    {days.map((day) => {
                      const calendarItems = getCalendarItemsForDay(day);
                      const isSelected = isSameDay(day, selectedDate);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const hasEvents = calendarItems.length > 0;
                      
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => {
                            setSelectedDate(day);
                            if (hasEvents) {
                              setDayEventsDialogOpen(true);
                            }
                          }}
                          className={cn(
                            'bg-background p-1 sm:p-2 min-h-[48px] sm:min-h-[70px] md:min-h-[80px] text-left transition-colors hover:bg-muted/50 flex flex-col',
                            !isCurrentMonth && 'text-muted-foreground bg-muted/30',
                            isSelected && 'ring-2 ring-primary ring-inset',
                            isToday(day) && 'bg-primary/10'
                          )}
                        >
                          <span className={cn(
                            'text-xs sm:text-sm font-medium',
                            isToday(day) && 'text-primary'
                          )}>
                            {format(day, 'd')}
                          </span>
                          {calendarItems.length > 0 && (
                            <div className="mt-0.5 sm:mt-1 space-y-0.5 flex-1 min-w-0 overflow-hidden">
                              {/* On mobile, show dots; on larger screens, show event titles */}
                              <div className="hidden sm:block space-y-0.5">
                                {calendarItems.slice(0, 2).map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (item.type === 'event' && item.originalEvent) {
                                        setSelectedEvent(item.originalEvent);
                                        setEventDetailOpen(true);
                                      } else if ((item.type === 'expense' || item.type === 'due') && item.originalExpense) {
                                        openEditExpense(item.originalExpense);
                                      } else if (item.type === 'maintenance' && item.originalMaintenance) {
                                        openEditMaintenanceBlock(item.originalMaintenance);
                                      }
                                    }}
                                    className="text-[10px] sm:text-xs truncate px-1 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ 
                                      backgroundColor: `${item.color}20`,
                                      color: item.color
                                    }}
                                  >
                                    {item.title}
                                  </div>
                                ))}
                                {calendarItems.length > 2 && (
                                  <div className="text-[10px] sm:text-xs text-muted-foreground px-1">
                                    +{calendarItems.length - 2} more
                                  </div>
                                )}
                              </div>
                              {/* Mobile: colored dots */}
                              <div className="flex flex-wrap gap-0.5 sm:hidden">
                                {calendarItems.slice(0, 3).map((item) => (
                                  <div
                                    key={item.id}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                  />
                                ))}
                                {calendarItems.length > 3 && (
                                  <span className="text-[8px] text-muted-foreground">+{calendarItems.length - 3}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Events Section */}
              {upcomingItems.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Upcoming (Next 7 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {upcomingItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg border"
                          style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(item.date, 'EEE, MMM d')}
                              {isToday(item.date) && (
                                <Badge variant="secondary" className="ml-2 text-xs">Today</Badge>
                              )}
                            </p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="ml-2 capitalize text-xs"
                            style={{ borderColor: item.color, color: item.color }}
                          >
                            {item.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onSubmit={createExpense}
        roomUnits={roomUnits}
        saving={saving}
        defaultCategory={defaultCategory}
        expenseTypeOptions={expenseTypeOptions}
      />

      {/* Edit Expense Dialog */}
      <EditExpenseDialog
        expense={selectedExpense}
        open={editExpenseOpen}
        onOpenChange={setEditExpenseOpen}
        onSubmit={updateExpense}
        roomUnits={roomUnits}
        saving={saving}
        expenseTypeOptions={expenseTypeOptions}
      />

      {/* View All Daily Expenses Dialog */}
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

      {/* View All Monthly Expenses Dialog */}
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

      {/* Add Operational Event Dialog (merged maintenance + calendar) */}
      <AddOperationalEventDialog
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        onSubmitMaintenance={createBlock}
        onSubmitGeneralEvent={handleCreateCalendarEvent}
        roomUnits={roomUnits}
        saving={maintenanceSaving}
        defaultDate={addEventDefaultDate}
        isCalendarConnected={isConnected}
      />

      {/* Edit Maintenance Block Dialog */}
      <EditMaintenanceBlockDialog
        block={selectedMaintenanceBlock}
        open={editMaintenanceOpen}
        onOpenChange={setEditMaintenanceOpen}
        onSubmit={updateBlock}
        roomUnits={roomUnits}
        saving={maintenanceSaving}
      />

      {/* Day Events Dialog */}
      <DayEventsDialog
        open={dayEventsDialogOpen}
        onOpenChange={setDayEventsDialogOpen}
        selectedDate={selectedDate}
        events={selectedDateEventsDeduped}
        expenses={selectedDateExpenses}
        dueExpenses={selectedDateDues}
        maintenanceBlocks={selectedDateMaintenance}
        formatCurrency={formatCurrency}
        onEditExpense={openEditExpense}
        onEditMaintenance={openEditMaintenanceBlock}
      />

      {/* Event Detail Dialog */}
      <EventDetailDialog
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        event={selectedEvent}
      />
    </div>
  );
}

export default function Operations() {
  return (
    <ErrorBoundary fullPage>
      <OperationsContent />
    </ErrorBoundary>
  );
}
