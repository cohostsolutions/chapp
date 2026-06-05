-- Create dashboard_layouts table for storing user dashboard preferences
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_type TEXT NOT NULL,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, dashboard_type)
);

-- Enable Row Level Security
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Create policies for dashboard_layouts (idempotent)
DROP POLICY IF EXISTS "Users can view their own dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can insert their own dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can update their own dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can delete their own dashboard layouts" ON public.dashboard_layouts;

CREATE POLICY "Users can view their own dashboard layouts"
ON public.dashboard_layouts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard layouts"
ON public.dashboard_layouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard layouts"
ON public.dashboard_layouts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard layouts"
ON public.dashboard_layouts
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user ON public.dashboard_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_org ON public.dashboard_layouts(organization_id);

-- Add trigger for automatic timestamp updates (idempotent)
DROP TRIGGER IF EXISTS update_dashboard_layouts_updated_at ON public.dashboard_layouts;
CREATE TRIGGER update_dashboard_layouts_updated_at
BEFORE UPDATE ON public.dashboard_layouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();