-- Safe version: Updates the function in place without dropping it
CREATE OR REPLACE FUNCTION public.update_inventory_items_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public;