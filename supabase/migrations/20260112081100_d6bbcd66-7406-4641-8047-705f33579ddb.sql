-- Update bookings table to support new Cece status workflow
-- New statuses: new, pending, upcoming (confirmed), checked_in, checked_out, cancelled

-- First, drop the existing CHECK constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add new column to track who confirmed the booking (pending -> upcoming)
DO $$ BEGIN
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id);
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Migrate existing data:
-- 1. Move 'confirmed' bookings to 'upcoming' (new name for confirmed)
UPDATE public.bookings SET status = 'upcoming' WHERE status = 'confirmed';

-- 2. Move any other bookings that aren't in a valid status to 'new'
UPDATE public.bookings 
SET status = 'new' 
WHERE status NOT IN ('new', 'pending', 'upcoming', 'checked_in', 'checked_out', 'cancelled');

-- Add the new CHECK constraint with updated statuses
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('new', 'pending', 'upcoming', 'checked_in', 'checked_out', 'cancelled'));

-- Create a function to send notifications when booking status changes to pending
CREATE OR REPLACE FUNCTION notify_pending_booking()
RETURNS TRIGGER AS $$
DECLARE
  org_name TEXT;
  lead_name TEXT;
  room_name TEXT;
  user_record RECORD;
BEGIN
  -- Only trigger when status changes to 'pending'
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    -- Get organization name
    SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
    
    -- Get lead name
    SELECT name INTO lead_name FROM public.leads WHERE id = NEW.lead_id;
    
    -- Get room name
    SELECT name INTO room_name FROM public.room_units WHERE id = NEW.room_unit_id;
    
    -- Get all users in this organization who should be notified
    FOR user_record IN 
      SELECT p.id as user_id
      FROM public.profiles p
      LEFT JOIN public.notification_preferences np ON np.user_id = p.id
      WHERE p.organization_id = NEW.organization_id
        AND p.is_active = true
        AND (np.notify_new_business IS NULL OR np.notify_new_business = true)
    LOOP
      -- Insert notification for each user
      INSERT INTO public.notification_history (
        user_id,
        organization_id,
        title,
        message,
        type,
        related_id
      ) VALUES (
        user_record.user_id,
        NEW.organization_id,
        'New Pending Booking',
        format('%s is ready to book %s. Please confirm the reservation.', 
          COALESCE(lead_name, 'A guest'), 
          COALESCE(room_name, 'a room')
        ),
        'booking',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for pending booking notifications
DROP TRIGGER IF EXISTS trigger_notify_pending_booking ON public.bookings;
CREATE TRIGGER trigger_notify_pending_booking
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_pending_booking();

-- Create a function to track who confirmed a booking
CREATE OR REPLACE FUNCTION track_booking_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'upcoming' from 'pending', record who and when
  IF NEW.status = 'upcoming' AND OLD.status = 'pending' THEN
    NEW.confirmed_by := auth.uid();
    NEW.confirmed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to track confirmations
DROP TRIGGER IF EXISTS trigger_track_booking_confirmation ON public.bookings;
CREATE TRIGGER trigger_track_booking_confirmation
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION track_booking_confirmation();

-- Add index for the new confirmed_by column
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed_by ON public.bookings(confirmed_by);