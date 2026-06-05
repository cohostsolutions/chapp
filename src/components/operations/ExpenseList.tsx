import { useState } from 'react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { 
  Check, 
  X, 
  Trash2, 
  MoreVertical, 
  BedDouble,
  AlertCircle,
  Calendar as CalendarIcon,
  Pencil,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { OperationalExpense } from '@/hooks/useOperationalExpenses';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';

interface ExpenseListProps {
  title: string;
  expenses: OperationalExpense[];
  totalExpenses?: number;
  onMarkPaid: (id: string) => Promise<boolean>;
  onMarkUnpaid: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onEdit?: (expense: OperationalExpense) => void;
  onViewAll?: () => void;
  emptyMessage?: string;
}

export function ExpenseList({
  title,
  expenses,
  totalExpenses,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
  onEdit,
  onViewAll,
  emptyMessage = 'No expenses recorded',
}: ExpenseListProps) {
  const formatCurrency = useFormatCurrency();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isOverdue = (expense: OperationalExpense) => {
    if (expense.is_paid || !expense.due_date) return false;
    return isBefore(parseISO(expense.due_date), new Date());
  };

  const isDueSoon = (expense: OperationalExpense) => {
    if (expense.is_paid || !expense.due_date) return false;
    const dueDate = parseISO(expense.due_date);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return isAfter(dueDate, new Date()) && isBefore(dueDate, threeDaysFromNow);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const showViewAll = totalExpenses && totalExpenses > expenses.length;

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{title}</span>
            <Badge variant="secondary">{totalExpenses ?? expenses.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className={cn(
                  'p-4 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors',
                  expense.is_paid && 'opacity-60'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{expense.expense_type}</span>
                    {expense.room_unit && (
                      <Badge variant="outline" className="text-xs">
                        <BedDouble className="w-3 h-3 mr-1" />
                        {expense.room_unit.name}
                      </Badge>
                    )}
                    {isOverdue(expense) && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Overdue
                      </Badge>
                    )}
                    {isDueSoon(expense) && !isOverdue(expense) && (
                      <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-600">
                        Due Soon
                      </Badge>
                    )}
                    {expense.is_paid && (
                      <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                        <Check className="w-3 h-3 mr-1" />
                        Paid
                      </Badge>
                    )}
                    {expense.is_recurring && (
                      <Badge variant="secondary" className="text-xs">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Recurring
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{format(parseISO(expense.expense_date), 'MMM d, yyyy')}</span>
                    {expense.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        Due: {format(parseISO(expense.due_date), 'MMM d')}
                      </span>
                    )}
                    {expense.vendor && <span>• {expense.vendor}</span>}
                  </div>
                  {expense.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{expense.notes}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'font-semibold whitespace-nowrap',
                    expense.is_paid ? 'text-muted-foreground' : 'text-foreground'
                  )}>
                    {formatCurrency(Number(expense.amount))}
                  </span>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(expense)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {expense.is_paid ? (
                        <DropdownMenuItem onClick={() => onMarkUnpaid(expense.id)}>
                          <X className="w-4 h-4 mr-2" />
                          Mark as Unpaid
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onMarkPaid(expense.id)}>
                          <Check className="w-4 h-4 mr-2" />
                          Mark as Paid
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => setDeleteId(expense.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
          
          {showViewAll && onViewAll && (
            <div className="p-3 border-t">
              <Button 
                variant="ghost" 
                className="w-full justify-between text-primary hover:text-primary"
                onClick={onViewAll}
              >
                View all {totalExpenses} expenses
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}