-- Create maintenance_blocks table for room maintenance scheduling
CREATE TABLE IF NOT EXISTS public.maintenance_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  room_unit_id UUID NOT NULL REFERENCES public.room_units(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Maintenance',
  reason TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'weekly', 'monthly', 'yearly'
  recurrence_day_of_week INTEGER, -- 0-6 for weekly
  recurrence_day_of_month INTEGER, -- 1-31 for monthly
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.maintenance_blocks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view maintenance blocks in their org"
ON public.maintenance_blocks
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Client admins can create maintenance blocks"
ON public.maintenance_blocks
FOR INSERT
WITH CHECK (
  organization_id = get_user_org(auth.uid()) 
  AND (has_role(auth.uid(), 'client_admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Client admins can update maintenance blocks"
ON public.maintenance_blocks
FOR UPDATE
USING (
  organization_id = get_user_org(auth.uid()) 
  AND (has_role(auth.uid(), 'client_admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Client admins can delete maintenance blocks"
ON public.maintenance_blocks
FOR DELETE
USING (
  organization_id = get_user_org(auth.uid()) 
  AND (has_role(auth.uid(), 'client_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Create updated_at trigger
CREATE TRIGGER update_maintenance_blocks_updated_at
  BEFORE UPDATE ON public.maintenance_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_maintenance_blocks_org_dates 
ON public.maintenance_blocks(organization_id, start_date, end_date);

CREATE INDEX idx_maintenance_blocks_room 
ON public.maintenance_blocks(room_unit_id);

-- Enable realtime for maintenance_blocks
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_blocks;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;