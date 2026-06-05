-- Add recurring expense support columns
ALTER TABLE public.operational_expenses
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_pattern character varying(20) CHECK (recurrence_pattern IN ('weekly', 'monthly', 'yearly')),
ADD COLUMN recurrence_day_of_week integer CHECK (recurrence_day_of_week >= 0 AND recurrence_day_of_week <= 6),
ADD COLUMN recurrence_day_of_month integer CHECK (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 31),
ADD COLUMN parent_expense_id uuid REFERENCES public.operational_expenses(id) ON DELETE SET NULL;

-- Add index for faster queries on recurring expenses
CREATE INDEX IF NOT EXISTS idx_operational_expenses_recurring ON public.operational_expenses(is_recurring) WHERE is_recurring = true;

-- Add comment for documentation
COMMENT ON COLUMN public.operational_expenses.is_recurring IS 'Whether this expense repeats on a schedule';
COMMENT ON COLUMN public.operational_expenses.recurrence_pattern IS 'How often the expense repeats: weekly, monthly, or yearly';
COMMENT ON COLUMN public.operational_expenses.parent_expense_id IS 'Link to the original expense if this was auto-generated from a recurring expense';