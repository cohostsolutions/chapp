-- Feature flag for social media content, ads, and analytics management.
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS social_feed_enabled boolean NOT NULL DEFAULT false;