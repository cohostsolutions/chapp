import { useState } from 'react';
import { format, parseISO, isBefore } from 'date-fns';
import { 
  Check, 
  X, 
  Trash2, 
  Pencil,
  BedDouble,
  AlertCircle,
  Calendar as CalendarIcon,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { OperationalExpense } from '@/hooks/useOperationalExpenses';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';

interface AllExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  expenses: OperationalExpense[];
  onMarkPaid: (id: string) => Promise<boolean>;
  onMarkUnpaid: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onEdit: (expense: OperationalExpense) => void;
}

export function AllExpensesDialog({
  open,
  onOpenChange,
  title,
  expenses,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
  onEdit,
}: AllExpensesDialogProps) {
  const formatCurrency = useFormatCurrency();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExpenses = expenses.filter(expense => {
    const query = searchQuery.toLowerCase();
    return (
      expense.expense_type.toLowerCase().includes(query) ||
      expense.vendor?.toLowerCase().includes(query) ||
      expense.notes?.toLowerCase().includes(query) ||
      expense.room_unit?.name.toLowerCase().includes(query)
    );
  });

  const isOverdue = (expense: OperationalExpense) => {
    if (expense.is_paid || !expense.due_date) return false;
    return isBefore(parseISO(expense.due_date), new Date());
  };

  const handleDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses..."
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[500px] pr-4">
            {filteredExpenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {searchQuery ? 'No expenses match your search' : 'No expenses recorded'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className={cn(
                      'p-4 rounded-lg border bg-card flex items-center justify-between gap-4',
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
                        {expense.is_paid && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                            <Check className="w-3 h-3 mr-1" />
                            Paid
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
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(expense)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
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
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
