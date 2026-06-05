import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, DollarSign, Receipt, Wrench, X, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/hooks/useGoogleCalendar';
import { OperationalExpense } from '@/hooks/useOperationalExpenses';
import { MaintenanceBlock } from '@/hooks/useMaintenanceBlocks';

interface DayEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  events: CalendarEvent[];
  expenses: OperationalExpense[];
  dueExpenses: OperationalExpense[];
  maintenanceBlocks: MaintenanceBlock[];
  formatCurrency: (amount: number) => string;
  onEditExpense: (expense: OperationalExpense) => void;
  onEditMaintenance: (block: MaintenanceBlock) => void;
}

type DetailView = 
  | { type: 'event'; data: CalendarEvent }
  | { type: 'expense'; data: OperationalExpense }
  | { type: 'due'; data: OperationalExpense }
  | { type: 'maintenance'; data: MaintenanceBlock }
  | null;

export function DayEventsDialog({
  open,
  onOpenChange,
  selectedDate,
  events,
  expenses,
  dueExpenses,
  maintenanceBlocks,
  formatCurrency,
  onEditExpense,
  onEditMaintenance,
}: DayEventsDialogProps) {
  const [detailView, setDetailView] = useState<DetailView>(null);

  const handleClose = () => {
    setDetailView(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setDetailView(null);
  };

  const hasNoItems = events.length === 0 && expenses.length === 0 && dueExpenses.length === 0 && maintenanceBlocks.length === 0;

  // Detail View Content
  if (detailView) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[85vh]">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
              <DialogTitle className="text-base">
                {detailView.type === 'event' && 'Event Details'}
                {detailView.type === 'expense' && 'Expense Details'}
                {detailView.type === 'due' && 'Due Payment'}
                {detailView.type === 'maintenance' && 'Maintenance Details'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {detailView.type === 'event' && (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border" style={{ borderLeftColor: 'hsl(var(--primary))', borderLeftWidth: 4 }}>
                  <h3 className="font-semibold text-lg">{detailView.data.title}</h3>
                  {!detailView.data.allDay && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(parseISO(detailView.data.startTime), 'h:mm a')} - {format(parseISO(detailView.data.endTime), 'h:mm a')}
                    </p>
                  )}
                  {detailView.data.allDay && (
                    <Badge variant="secondary" className="mt-1">All Day</Badge>
                  )}
                  {detailView.data.description && (
                    <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">
                      {detailView.data.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {(detailView.type === 'expense' || detailView.type === 'due') && (
              <div className="space-y-3">
                <div 
                  className="p-4 rounded-lg border" 
                  style={{ 
                    borderLeftColor: detailView.type === 'due' ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)', 
                    borderLeftWidth: 4 
                  }}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg">{detailView.data.expense_type}</h3>
                    <span className="text-lg font-bold">
                      {formatCurrency(Number(detailView.data.amount))}
                    </span>
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={detailView.data.is_paid ? 'secondary' : 'outline'}>
                        {detailView.data.is_paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {detailView.data.category}
                      </Badge>
                    </div>
                    
                    {detailView.data.room_unit && (
                      <p className="text-sm text-muted-foreground">
                        Room: {detailView.data.room_unit.name}
                      </p>
                    )}
                    
                    {detailView.data.vendor && (
                      <p className="text-sm text-muted-foreground">
                        Vendor: {detailView.data.vendor}
                      </p>
                    )}
                    
                    {detailView.data.due_date && (
                      <p className="text-sm text-muted-foreground">
                        Due: {format(parseISO(detailView.data.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    
                    {detailView.data.notes && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                        {detailView.data.notes}
                      </p>
                    )}
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    handleClose();
                    onEditExpense(detailView.data);
                  }}
                >
                  Edit Expense
                </Button>
              </div>
            )}

            {detailView.type === 'maintenance' && (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border" style={{ borderLeftColor: 'hsl(280 65% 60%)', borderLeftWidth: 4 }}>
                  <h3 className="font-semibold text-lg">{detailView.data.title}</h3>
                  
                  <div className="mt-3 space-y-2">
                    {detailView.data.room_unit && (
                      <p className="text-sm text-muted-foreground">
                        Room: {detailView.data.room_unit.name}
                      </p>
                    )}
                    
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(detailView.data.start_date), 'MMM d, yyyy')}
                      {detailView.data.start_date !== detailView.data.end_date && (
                        <> - {format(parseISO(detailView.data.end_date), 'MMM d, yyyy')}</>
                      )}
                    </p>
                    
                    {detailView.data.reason && (
                      <p className="text-sm text-muted-foreground">
                        Reason: {detailView.data.reason}
                      </p>
                    )}
                    
                    {detailView.data.is_recurring && (
                      <Badge variant="secondary">Recurring</Badge>
                    )}
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    handleClose();
                    onEditMaintenance(detailView.data);
                  }}
                >
                  Edit Maintenance
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // List View Content
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {hasNoItems ? (
            <div className="py-8 text-center text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No events for this date</p>
            </div>
          ) : (
            <div className="space-y-4 pr-2">
              {/* Calendar Events */}
              {events.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Calendar Events
                  </h4>
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setDetailView({ type: 'event', data: event })}
                      className="w-full p-3 rounded-lg border bg-card text-left hover:bg-muted/50 transition-colors"
                      style={{ borderLeftColor: 'hsl(var(--primary))', borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{event.title}</p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {!event.allDay && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(event.startTime), 'h:mm a')} - {format(parseISO(event.endTime), 'h:mm a')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Expenses */}
              {expenses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Expenses
                  </h4>
                  {expenses.map((expense) => (
                    <button
                      key={expense.id}
                      onClick={() => setDetailView({ type: 'expense', data: expense })}
                      className="w-full p-3 rounded-lg border bg-card text-left hover:bg-muted/50 transition-colors"
                      style={{ borderLeftColor: 'hsl(38 92% 50%)', borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{expense.expense_type}</p>
                          {expense.room_unit && (
                            <p className="text-xs text-muted-foreground">{expense.room_unit.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{formatCurrency(Number(expense.amount))}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <Badge variant={expense.is_paid ? 'secondary' : 'outline'} className="mt-1 text-xs">
                        {expense.is_paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* Due Today */}
              {dueExpenses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-destructive uppercase tracking-wide flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    Due Today
                  </h4>
                  {dueExpenses.map((expense) => (
                    <button
                      key={`due-${expense.id}`}
                      onClick={() => setDetailView({ type: 'due', data: expense })}
                      className="w-full p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-left hover:bg-destructive/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{expense.expense_type}</p>
                          {expense.vendor && (
                            <p className="text-xs text-muted-foreground">Pay to: {expense.vendor}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-destructive">
                            {formatCurrency(Number(expense.amount))}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Maintenance */}
              {maintenanceBlocks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    Maintenance
                  </h4>
                  {maintenanceBlocks.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => setDetailView({ type: 'maintenance', data: block })}
                      className="w-full p-3 rounded-lg border bg-card text-left hover:bg-muted/50 transition-colors"
                      style={{ borderLeftColor: 'hsl(280 65% 60%)', borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{block.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {block.room_unit?.name || 'Unknown Room'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {block.start_date !== block.end_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(block.start_date), 'MMM d')} - {format(parseISO(block.end_date), 'MMM d')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
