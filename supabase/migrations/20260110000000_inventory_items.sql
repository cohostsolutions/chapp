-- Create inventory_items table for May organizations
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  low_stock_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_organization ON public.inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON public.inventory_items(organization_id, quantity, low_stock_threshold);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view inventory items in their organization" ON public.inventory_items;

CREATE POLICY "Users can view inventory items in their organization"
  ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create inventory items in their organization" ON public.inventory_items;

CREATE POLICY "Users can create inventory items in their organization"
  ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update inventory items in their organization" ON public.inventory_items;

CREATE POLICY "Users can update inventory items in their organization"
  ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete inventory items in their organization" ON public.inventory_items;

CREATE POLICY "Users can delete inventory items in their organization"
  ON public.inventory_items
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Add trigger to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_inventory_items_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_items_last_updated ON public.inventory_items;

CREATE TRIGGER trigger_update_inventory_items_last_updated
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_last_updated();
