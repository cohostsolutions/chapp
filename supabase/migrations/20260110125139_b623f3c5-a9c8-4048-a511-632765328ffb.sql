-- Create a trigger function to validate booking dates
CREATE OR REPLACE FUNCTION public.validate_booking_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure check_out is after check_in
  IF NEW.check_out <= NEW.check_in THEN
    RAISE EXCEPTION 'Check-out date must be after check-in date. Got check_in: %, check_out: %', NEW.check_in, NEW.check_out;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run validation before insert or update
DROP TRIGGER IF EXISTS validate_booking_dates_trigger ON public.bookings;
CREATE TRIGGER validate_booking_dates_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_dates();