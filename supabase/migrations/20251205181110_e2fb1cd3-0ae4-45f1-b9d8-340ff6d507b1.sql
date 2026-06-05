-- Create enum for AI agent types
DO $$ BEGIN
  CREATE TYPE ai_agent_type AS ENUM ('jay', 'may', 'cece');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add AI agent type to organizations table
DO $$ BEGIN
  ALTER TABLE public.organizations ADD COLUMN ai_agent_type ai_agent_type NOT NULL DEFAULT 'jay';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create orders table for May (food order management)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  order_items JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'cancelled')),
  pickup_name TEXT,
  pickup_time TIMESTAMP WITH TIME ZONE,
  calendar_event_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create room_units table for Cece (hotel/airbnb inventory)
CREATE TABLE IF NOT EXISTS public.room_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 2,
  amenities JSONB DEFAULT '[]',
  calendar_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table for Cece
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  room_unit_id UUID NOT NULL REFERENCES public.room_units(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guest_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  calendar_event_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders
DROP POLICY IF EXISTS "Users can view orders in their organization" ON public.orders;
CREATE POLICY "Users can view orders in their organization" ON public.orders
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can create orders in their organization" ON public.orders;
CREATE POLICY "Users can create orders in their organization" ON public.orders
  FOR INSERT WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can update orders in their organization" ON public.orders;
CREATE POLICY "Users can update orders in their organization" ON public.orders
  FOR UPDATE USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can delete orders in their organization" ON public.orders;
CREATE POLICY "Users can delete orders in their organization" ON public.orders
  FOR DELETE USING (organization_id = get_user_org(auth.uid()));

-- RLS policies for room_units
DROP POLICY IF EXISTS "Users can view room_units in their organization" ON public.room_units;
CREATE POLICY "Users can view room_units in their organization" ON public.room_units
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can create room_units in their organization" ON public.room_units;
CREATE POLICY "Users can create room_units in their organization" ON public.room_units
  FOR INSERT WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can update room_units in their organization" ON public.room_units;
CREATE POLICY "Users can update room_units in their organization" ON public.room_units
  FOR UPDATE USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can delete room_units in their organization" ON public.room_units;
CREATE POLICY "Users can delete room_units in their organization" ON public.room_units
  FOR DELETE USING (organization_id = get_user_org(auth.uid()));

-- RLS policies for bookings
DROP POLICY IF EXISTS "Users can view bookings in their organization" ON public.bookings;
CREATE POLICY "Users can view bookings in their organization" ON public.bookings
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can create bookings in their organization" ON public.bookings;
CREATE POLICY "Users can create bookings in their organization" ON public.bookings
  FOR INSERT WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can update bookings in their organization" ON public.bookings;
CREATE POLICY "Users can update bookings in their organization" ON public.bookings
  FOR UPDATE USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can delete bookings in their organization" ON public.bookings;
CREATE POLICY "Users can delete bookings in their organization" ON public.bookings
  FOR DELETE USING (organization_id = get_user_org(auth.uid()));

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_room_units_updated_at ON public.room_units;
CREATE TRIGGER update_room_units_updated_at
  BEFORE UPDATE ON public.room_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON public.orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_room_units_organization_id ON public.room_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_organization_id ON public.bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_unit_id ON public.bookings(room_unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(check_in, check_out);