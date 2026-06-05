-- Add payment_status column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'upcoming';

-- Add a check constraint for valid payment statuses
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_payment_status_check 
CHECK (payment_status IN ('upcoming', 'fully_paid', 'downpayment', 'pending_ota'));