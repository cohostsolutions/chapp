-- Phase 3 Accommodation Features: Filter Presets, Booking Templates, and Note History

-- Filter Presets Table
CREATE TABLE IF NOT EXISTS filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_filter_presets_user_org ON filter_presets(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_is_default ON filter_presets(user_id, organization_id, is_default) WHERE is_default = true;

-- RLS Policies for filter_presets
ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own filter presets"
  ON filter_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own filter presets"
  ON filter_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own filter presets"
  ON filter_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own filter presets"
  ON filter_presets FOR DELETE
  USING (auth.uid() = user_id);

-- Booking Templates Table
CREATE TABLE IF NOT EXISTS booking_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_id UUID REFERENCES room_units(id) ON DELETE SET NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_templates_user_org ON booking_templates(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_booking_templates_room ON booking_templates(room_id);

-- RLS Policies for booking_templates
ALTER TABLE booking_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's booking templates"
  ON booking_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert booking templates in their org"
  ON booking_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update booking templates in their org"
  ON booking_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete booking templates in their org"
  ON booking_templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Booking Note History Table
CREATE TABLE IF NOT EXISTS booking_note_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  note_text TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_note_history_booking ON booking_note_history(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_note_history_user ON booking_note_history(user_id);

-- RLS Policies for booking_note_history
ALTER TABLE booking_note_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view note history for bookings in their org"
  ON booking_note_history FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE organization_id IN (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert note history for bookings in their org"
  ON booking_note_history FOR INSERT
  WITH CHECK (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE organization_id IN (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_filter_presets_updated_at
  BEFORE UPDATE ON filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_templates_updated_at
  BEFORE UPDATE ON booking_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
