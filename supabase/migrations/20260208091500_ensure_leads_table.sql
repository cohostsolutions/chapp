-- Ensure critical leads schema exists for deploy verification
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_temperature AS ENUM ('cold', 'warm', 'hot');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.qualification_status AS ENUM ('unqualified', 'qualifying', 'qualified', 'assigned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  status public.lead_status DEFAULT 'new' NOT NULL,
  source text,
  notes text,
  assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_temperature public.lead_temperature DEFAULT 'cold';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS qualification_status public.qualification_status DEFAULT 'unqualified';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_ai_managed boolean DEFAULT true;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS qualified_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_ai_response_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS platform_user_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_nights_stayed integer DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_bookings_count integer DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_stay_date date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_stay_date date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent_id ON public.leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_platform_user_id ON public.leads(organization_id, platform_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_platform_user_id_unique
  ON public.leads(organization_id, platform_user_id)
  WHERE platform_user_id IS NOT NULL;

ALTER TABLE public.leads REPLICA IDENTITY FULL;
