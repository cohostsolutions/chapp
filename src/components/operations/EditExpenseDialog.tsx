import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useCurrencySymbol } from '@/hooks/useMultiCurrency';
import { OperationalExpense } from '@/hooks/useOperationalExpenses';
import { CECE_DAILY_EXPENSE_TYPES, CECE_MONTHLY_EXPENSE_TYPES } from '@/lib/operationsExpenseTypes';

interface RoomUnit {
  id: string;
  name: string;
}

interface EditExpenseDialogProps {
  expense: OperationalExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: Partial<OperationalExpense>) => Promise<boolean>;
  roomUnits: RoomUnit[];
  saving: boolean;
  expenseTypeOptions?: {
    daily: readonly string[];
    monthly: readonly string[];
  };
}

export function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
  onSubmit,
  roomUnits,
  saving,
  expenseTypeOptions,
}: EditExpenseDialogProps) {
  const currencySymbol = useCurrencySymbol();
  const [expenseType, setExpenseType] = useState('');
  const [customType, setCustomType] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [roomUnitId, setRoomUnitId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [vendor, setVendor] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'monthly'>('monthly');
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(1);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1);

  const expenseTypes: readonly string[] = expense?.category === 'daily'
    ? (expenseTypeOptions?.daily ?? CECE_DAILY_EXPENSE_TYPES)
    : (expenseTypeOptions?.monthly ?? CECE_MONTHLY_EXPENSE_TYPES);
  const isStandardType = expenseTypes.includes(((expense?.expense_type as unknown as string) || ''));


  useEffect(() => {
    if (expense && open) {
      if (isStandardType) {
        setExpenseType(expense.expense_type);
        setCustomType('');
      } else {
        setExpenseType('Others');
        setCustomType(expense.expense_type);
      }
      setAmount(String(expense.amount));
      setExpenseDate(parseISO(expense.expense_date));
      setDueDate(expense.due_date ? parseISO(expense.due_date) : undefined);
      setRoomUnitId(expense.room_unit_id || '');
      setNotes(expense.notes || '');
      setVendor(expense.vendor || '');
      setIsPaid(expense.is_paid);
      setIsRecurring(expense.is_recurring || false);
      setRecurrencePattern((expense.recurrence_pattern as 'weekly' | 'monthly') || 'monthly');
      setRecurrenceDayOfWeek(expense.recurrence_day_of_week || 1);
      setRecurrenceDayOfMonth(expense.recurrence_day_of_month || 1);
    }
  }, [expense, open, isStandardType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;
    
    const finalType = expenseType === 'Others' 
      ? customType || 'Others' 
      : expenseType;

    const result = await onSubmit(expense.id, {
      expense_type: finalType,
      amount: parseFloat(amount),
      expense_date: format(expenseDate, 'yyyy-MM-dd'),
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      room_unit_id: roomUnitId || null,
      notes: notes || null,
      vendor: vendor || null,
      is_paid: isPaid,
      paid_at: isPaid && !expense.is_paid ? new Date().toISOString() : expense.paid_at,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      recurrence_day_of_week: isRecurring && recurrencePattern === 'weekly' ? recurrenceDayOfWeek : null,
      recurrence_day_of_month: isRecurring && recurrencePattern === 'monthly' ? recurrenceDayOfMonth : null,
    });

    if (result) {
      onOpenChange(false);
    }
  };

  const showCustomTypeInput = expenseType === 'Others';

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category display (read-only) */}
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-sm font-medium capitalize">{expense.category} Expense</p>
          </div>

          {/* Expense Type */}
          <div className="space-y-2">
            <Label>Expense Type *</Label>
            <Select value={expenseType} onValueChange={setExpenseType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {expenseTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom type input */}
          {showCustomTypeInput && (
            <div className="space-y-2">
              <Label>Specify Type</Label>
              <Input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter expense type"
              />
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount ({currencySymbol}) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-12"
                required
              />
            </div>
          </div>

          {/* Room Unit */}
          {roomUnits.length > 0 && (
            <div className="space-y-2">
              <Label>Room Unit (Optional)</Label>
              <Select value={roomUnitId} onValueChange={(val) => setRoomUnitId(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="No specific room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific room</SelectItem>
                  {roomUnits.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expense Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !expenseDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expenseDate ? format(expenseDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Optional'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {dueDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDueDate(undefined)}
                    className="shrink-0"
                    title="Clear due date"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <Label>Vendor / Payee</Label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g., Meralco, PLDT"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={2}
            />
          </div>

          {/* Payment Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm font-medium">Paid</p>
              <p className="text-xs text-muted-foreground">Mark if this expense is settled</p>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} />
          </div>

          {/* Recurring Expense */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm font-medium">Recurring Expense</p>
              <p className="text-xs text-muted-foreground">Auto-generate this expense on a schedule</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {/* Recurrence Options */}
          {isRecurring && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-2">
                <Label>Repeat</Label>
                <Select value={recurrencePattern} onValueChange={(val) => setRecurrencePattern(val as 'weekly' | 'monthly')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrencePattern === 'weekly' && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select value={recurrenceDayOfWeek.toString()} onValueChange={(val) => setRecurrenceDayOfWeek(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recurrencePattern === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Select value={recurrenceDayOfMonth.toString()} onValueChange={(val) => setRecurrenceDayOfMonth(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !expenseType || !amount}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
