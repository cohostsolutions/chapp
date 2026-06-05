ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Manila';