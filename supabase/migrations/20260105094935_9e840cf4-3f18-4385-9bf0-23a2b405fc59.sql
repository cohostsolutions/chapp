-- Add pricing tiers to room_units (tier-based pricing by guest count)
-- Format: [{"guests": 2, "price": 1500}, {"guests": 3, "price": 1800}, {"guests": 4, "price": 2100}]
ALTER TABLE public.room_units 
ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb;

-- Add length-of-stay discounts to room_units (percentage discounts)
-- Format: [{"min_nights": 7, "discount_percent": 10}, {"min_nights": 30, "discount_percent": 25}]
ALTER TABLE public.room_units 
ADD COLUMN IF NOT EXISTS stay_discounts JSONB DEFAULT '[]'::jsonb;

-- Add actual booking price to bookings table for accurate revenue reporting
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS total_price NUMERIC;

-- Add a comment to document the pricing_tiers structure
COMMENT ON COLUMN public.room_units.pricing_tiers IS 'Array of guest count tiers: [{"guests": 2, "price": 1500}, {"guests": 3, "price": 1800}]';

-- Add a comment to document the stay_discounts structure  
COMMENT ON COLUMN public.room_units.stay_discounts IS 'Array of length-of-stay discounts: [{"min_nights": 7, "discount_percent": 10}]';

-- Add a comment to document the total_price field
COMMENT ON COLUMN public.bookings.total_price IS 'Actual booking revenue including pricing tiers and discounts applied';