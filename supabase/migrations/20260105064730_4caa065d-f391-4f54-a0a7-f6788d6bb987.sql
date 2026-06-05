-- Create operational expenses table for Cece AI organizations
CREATE TABLE IF NOT EXISTS public.operational_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  room_unit_id UUID REFERENCES public.room_units(id) ON DELETE SET NULL,
  
  -- Expense categorization
  category VARCHAR(20) NOT NULL CHECK (category IN ('daily', 'monthly')),
  expense_type VARCHAR(50) NOT NULL,
  
  -- Amount and dates
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Payment tracking
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Optional details
  notes TEXT,
  vendor VARCHAR(255),
  
  -- Calendar sync
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_operational_expenses_org ON public.operational_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_room ON public.operational_expenses(room_unit_id);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_category ON public.operational_expenses(category);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_date ON public.operational_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_due_date ON public.operational_expenses(due_date);
CREATE INDEX IF NOT EXISTS idx_operational_expenses_unpaid ON public.operational_expenses(organization_id, is_paid) WHERE is_paid = false;

-- Enable RLS
ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view expenses for their organization"
  ON public.operational_expenses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create expenses for their organization"
  ON public.operational_expenses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update expenses for their organization"
  ON public.operational_expenses FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete expenses for their organization"
  ON public.operational_expenses FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_operational_expenses_updated_at
  BEFORE UPDATE ON public.operational_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.operational_expenses IS 'Tracks daily and monthly operational expenses for Cece AI organizations (hotels/airbnb)';