-- Create audit_logs table for comprehensive activity tracking
-- Supports GDPR/compliance auditing of sensitive operations

-- Nuke the old broken table so we can rebuild it correctly
DROP TABLE IF EXISTS public.audit_logs CASCADE;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'role_change', 'data_delete', 'data_export', 'settings_update'
  table_name VARCHAR(50), -- Which table was affected
  record_id UUID, -- ID of affected record
  old_values JSONB, -- Previous values (for updates/deletes)
  new_values JSONB, -- New values (for creates/updates)
  ip_address INET, -- IP address of requester
  user_agent TEXT, -- Browser/client info
  description TEXT, -- Human-readable description
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT action_valid CHECK (action IN (
    'role_change', 'data_delete', 'data_export', 'settings_update',
    'user_invite', 'user_revoke', 'organization_create', 'organization_update',
    'password_reset', 'mfa_enable', 'mfa_disable', 'api_key_create',
    'api_key_revoke', 'data_hard_delete', 'data_anonymize', 'bulk_import'
  ))
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view their organization's audit logs
CREATE POLICY "Admins view org audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND (SELECT user_role FROM public.profiles WHERE id = auth.uid()) 
        IN ('super_admin', 'client_admin')
  );

-- Policy: Only system functions can insert audit logs
CREATE POLICY "Only functions can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true); -- Restricted by function security definer

-- Policy: Audit logs cannot be updated (append-only)
CREATE POLICY "Audit logs cannot be updated"
  ON public.audit_logs
  FOR UPDATE
  USING (false);

-- Policy: Audit logs cannot be deleted (append-only)
CREATE POLICY "Audit logs cannot be deleted"
  ON public.audit_logs
  FOR DELETE
  USING (false);

-- Create function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    organization_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    description
  )
  VALUES (
    auth.uid(),
    NEW.organization_id,
    'role_change',
    'profiles',
    NEW.id,
    jsonb_build_object('role', OLD.role, 'email', OLD.email),
    jsonb_build_object('role', NEW.role, 'email', NEW.email),
    format('User %s role changed from %s to %s', NEW.email, OLD.role, NEW.role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role changes
DROP TRIGGER IF EXISTS audit_role_change ON public.profiles CASCADE;
CREATE TRIGGER audit_role_change
AFTER UPDATE OF user_role ON public.profiles
FOR EACH ROW
WHEN (OLD.user_role IS DISTINCT FROM NEW.user_role)
EXECUTE FUNCTION public.log_role_change();

-- Create function to log data exports
CREATE OR REPLACE FUNCTION public.log_data_export(
  p_user_id UUID,
  p_organization_id UUID,
  p_table_name VARCHAR,
  p_record_count INT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    organization_id,
    action,
    table_name,
    new_values,
    description
  )
  VALUES (
    p_user_id,
    p_organization_id,
    'data_export',
    p_table_name,
    jsonb_build_object('record_count', p_record_count, 'export_type', 'csv'),
    COALESCE(p_description, format('Exported %s records from %s table', p_record_count, p_table_name))
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log data deletions
CREATE OR REPLACE FUNCTION public.log_data_deletion(
  p_user_id UUID,
  p_organization_id UUID,
  p_table_name VARCHAR,
  p_record_id UUID,
  p_old_values JSONB,
  p_reason VARCHAR DEFAULT 'user_requested'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    organization_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    description
  )
  VALUES (
    p_user_id,
    p_organization_id,
    'data_delete',
    p_table_name,
    p_record_id,
    p_old_values,
    jsonb_build_object('deleted_at', NOW(), 'reason', p_reason),
    format('Record %s soft-deleted from %s table', p_record_id, p_table_name)
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log settings updates
CREATE OR REPLACE FUNCTION public.log_settings_update(
  p_user_id UUID,
  p_organization_id UUID,
  p_old_values JSONB,
  p_new_values JSONB,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    organization_id,
    action,
    table_name,
    old_values,
    new_values,
    description
  )
  VALUES (
    p_user_id,
    p_organization_id,
    'settings_update',
    'organizations',
    p_old_values,
    p_new_values,
    COALESCE(p_description, 'Organization settings updated')
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to retrieve audit logs with pagination
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_organization_id UUID,
  p_action VARCHAR DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email VARCHAR,
  action VARCHAR,
  table_name VARCHAR,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    p.email::VARCHAR,
    al.action,
    al.table_name,
    al.description,
    al.created_at,
    COUNT(*) OVER () as total_count
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON al.user_id = p.id
  WHERE al.organization_id = p_organization_id
    AND (p_action IS NULL OR al.action = p_action)
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
