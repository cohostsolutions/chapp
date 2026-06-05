-- Add workflows_enabled column to organizations for per-org access control
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS workflows_enabled boolean NOT NULL DEFAULT false;

-- Add communications_enabled column for communications hub access
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS communications_enabled boolean NOT NULL DEFAULT false;