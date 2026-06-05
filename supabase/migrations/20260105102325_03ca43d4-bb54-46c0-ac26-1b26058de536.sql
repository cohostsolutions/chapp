-- Add notification setting for pending bookings to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS notify_pending_bookings BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.notify_pending_bookings IS 'For Cece orgs: whether to notify agent and admin when new pending bookings arrive';