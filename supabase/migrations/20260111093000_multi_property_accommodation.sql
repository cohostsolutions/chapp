-- Multi-Property support for Accommodation
-- Adds properties table and attaches property_id to accommodation-related tables

-- 1) Properties table
-- 1) Properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- REMOVED THE UNIQUE LINE FROM HERE
);

-- ADD THIS NEW INDEX INSTEAD:
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_org_name_unique 
ON public.properties (organization_id, lower(name));

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view org properties"
  ON public.properties
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users create org properties"
  ON public.properties
  FOR INSERT WITH CHECK (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users update org properties"
  ON public.properties
  FOR UPDATE USING (organization_id = get_user_org(auth.uid()))
  WITH CHECK (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users delete org properties"
  ON public.properties
  FOR DELETE USING (organization_id = get_user_org(auth.uid()));

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper function to ensure property belongs to organization
CREATE OR REPLACE FUNCTION public.property_belongs_to_org(p_property_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.organization_id = p_org_id
  );
$$;

-- 2) Add property_id columns
DO $$ BEGIN
  ALTER TABLE public.room_units ADD COLUMN IF NOT EXISTS property_id UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS property_id UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE public.booking_templates ADD COLUMN IF NOT EXISTS property_id UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE public.filter_presets ADD COLUMN IF NOT EXISTS property_id UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE public.booking_note_history ADD COLUMN IF NOT EXISTS property_id UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE public.calendar_sync_events ADD COLUMN IF NOT EXISTS property_id UUID;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 3) Backfill default property per organization
INSERT INTO public.properties (organization_id, name)
SELECT id, 'Default Property' FROM public.organizations
ON CONFLICT (organization_id, lower(name)) DO NOTHING;

-- 4) Assign default property to existing records
UPDATE public.room_units ru
SET property_id = p.id
FROM public.properties p
WHERE p.organization_id = ru.organization_id
  AND p.name = 'Default Property'
  AND (ru.property_id IS NULL OR ru.property_id = p.id);

UPDATE public.bookings b
SET property_id = p.id
FROM public.properties p
WHERE p.organization_id = b.organization_id
  AND p.name = 'Default Property'
  AND (b.property_id IS NULL OR b.property_id = p.id);

UPDATE public.booking_templates bt
SET property_id = p.id
FROM public.properties p
WHERE p.organization_id = bt.organization_id
  AND p.name = 'Default Property'
  AND (bt.property_id IS NULL OR bt.property_id = p.id);

UPDATE public.filter_presets fp
SET property_id = p.id
FROM public.properties p
WHERE p.organization_id = fp.organization_id
  AND p.name = 'Default Property'
  AND (fp.property_id IS NULL OR fp.property_id = p.id);

UPDATE public.booking_note_history bnh
SET property_id = p.id
FROM public.bookings b, public.properties p
WHERE bnh.booking_id = b.id
  AND b.organization_id = p.organization_id;

UPDATE public.calendar_sync_events cse
SET property_id = p.id
FROM public.properties p
WHERE p.organization_id = cse.organization_id
  AND p.name = 'Default Property'
  AND (cse.property_id IS NULL OR cse.property_id = p.id);

-- 5) Enforce NOT NULL + FK + org alignment
ALTER TABLE public.room_units
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT room_units_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD CONSTRAINT room_units_property_org_match CHECK (property_belongs_to_org(property_id, organization_id));

ALTER TABLE public.bookings
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT bookings_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD CONSTRAINT bookings_property_org_match CHECK (property_belongs_to_org(property_id, organization_id));

ALTER TABLE public.booking_templates
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT booking_templates_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD CONSTRAINT booking_templates_property_org_match CHECK (property_belongs_to_org(property_id, organization_id));

ALTER TABLE public.filter_presets
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT filter_presets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD CONSTRAINT filter_presets_property_org_match CHECK (property_belongs_to_org(property_id, organization_id));

ALTER TABLE public.booking_note_history
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT booking_note_history_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_sync_events
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT calendar_sync_events_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD CONSTRAINT calendar_sync_events_property_org_match CHECK (property_belongs_to_org(property_id, organization_id));

-- 6) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_org ON public.properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_room_units_org_property ON public.room_units(organization_id, property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_org_property ON public.bookings(organization_id, property_id);
CREATE INDEX IF NOT EXISTS idx_booking_templates_org_property ON public.booking_templates(organization_id, property_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_org_property ON public.filter_presets(organization_id, property_id);
CREATE INDEX IF NOT EXISTS idx_booking_note_history_property ON public.booking_note_history(property_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_events_org_property ON public.calendar_sync_events(organization_id, property_id);

-- 7) Comments
COMMENT ON TABLE public.properties IS 'Properties owned by organizations for accommodation management';
COMMENT ON COLUMN public.room_units.property_id IS 'Property this room/unit belongs to';
COMMENT ON COLUMN public.bookings.property_id IS 'Property for the booking';
COMMENT ON COLUMN public.booking_templates.property_id IS 'Property scope for template';
COMMENT ON COLUMN public.filter_presets.property_id IS 'Property scope for filter preset';
COMMENT ON COLUMN public.booking_note_history.property_id IS 'Property context for note history';
COMMENT ON COLUMN public.calendar_sync_events.property_id IS 'Property context for calendar sync events';
