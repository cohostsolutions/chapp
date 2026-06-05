-- Add avatar_url column to leads table for storing profile photos from social media
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.avatar_url IS 'Profile photo URL from social media platforms (Facebook, Instagram). WhatsApp does not provide profile photos.';
