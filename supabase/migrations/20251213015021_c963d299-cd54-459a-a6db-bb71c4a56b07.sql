-- Add geolocation columns to login_attempts table
ALTER TABLE public.login_attempts 
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS isp TEXT;

-- Create index for geolocation queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_country ON public.login_attempts(country);
CREATE INDEX IF NOT EXISTS idx_login_attempts_coords ON public.login_attempts(latitude, longitude) WHERE latitude IS NOT NULL;