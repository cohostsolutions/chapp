-- Create enums for lead temperature and qualification status
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

DO $$ BEGIN
  CREATE TYPE public.agent_assignment_method AS ENUM ('round_robin', 'priority');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add qualification fields to leads table
DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN lead_temperature public.lead_temperature DEFAULT 'cold';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN qualification_status public.qualification_status DEFAULT 'unqualified';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN is_ai_managed boolean DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN qualified_at timestamp with time zone;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN last_ai_response_at timestamp with time zone;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add agent assignment method to organizations table
DO $$ BEGIN
  ALTER TABLE public.organizations ADD COLUMN agent_assignment_method public.agent_assignment_method DEFAULT 'round_robin';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create agent_priorities table for priority-based assignment
CREATE TABLE IF NOT EXISTS public.agent_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, agent_id)
);

-- Enable RLS on agent_priorities
ALTER TABLE public.agent_priorities ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_priorities
DROP POLICY IF EXISTS "Super admins manage all agent_priorities" ON public.agent_priorities;
CREATE POLICY "Super admins manage all agent_priorities"
ON public.agent_priorities
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Client admins manage org agent_priorities" ON public.agent_priorities;
CREATE POLICY "Client admins manage org agent_priorities"
ON public.agent_priorities
FOR ALL
USING (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Org users view agent_priorities" ON public.agent_priorities;
CREATE POLICY "Org users view agent_priorities"
ON public.agent_priorities
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_leads_qualification_status ON public.leads(qualification_status);
CREATE INDEX IF NOT EXISTS idx_leads_is_ai_managed ON public.leads(is_ai_managed);
CREATE INDEX IF NOT EXISTS idx_agent_priorities_org ON public.agent_priorities(organization_id);

-- Trigger for updated_at on agent_priorities
DROP TRIGGER IF EXISTS update_agent_priorities_updated_at ON public.agent_priorities;
CREATE TRIGGER update_agent_priorities_updated_at
BEFORE UPDATE ON public.agent_priorities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();