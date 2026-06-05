-- Ensure the trigger is attached to bookings table for auto-handback on checkout
DROP TRIGGER IF EXISTS trigger_checkout_auto_handback ON public.bookings;

CREATE TRIGGER trigger_checkout_auto_handback
AFTER UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_checkout_auto_handback();