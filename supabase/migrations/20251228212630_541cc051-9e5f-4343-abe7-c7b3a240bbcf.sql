-- Create migration_logs table for audit trail and undo functionality
CREATE TABLE IF NOT EXISTS public.migration_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    performed_by uuid NOT NULL,
    source_organization_id uuid NOT NULL REFERENCES organizations(id),
    target_organization_id uuid NOT NULL REFERENCES organizations(id),
    migrated_leads jsonb NOT NULL DEFAULT '[]',
    migrated_platforms jsonb NOT NULL DEFAULT '[]',
    performed_at timestamptz NOT NULL DEFAULT now(),
    can_undo_until timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
    is_undone boolean NOT NULL DEFAULT false,
    undone_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins (not impersonating) can manage migration logs
CREATE POLICY "Super admins manage migration_logs" 
ON migration_logs 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_migration_logs_performed_by ON migration_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_migration_logs_can_undo ON migration_logs(can_undo_until) WHERE is_undone = false;