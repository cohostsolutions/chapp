-- Migration: Add batch RLS status function for improved performance
-- Purpose: Combine table RLS status and policies into a single RPC call

CREATE OR REPLACE FUNCTION public.get_tables_rls_status_batch()
RETURNS TABLE (
  table_name TEXT,
  rls_enabled BOOLEAN,
  policies JSONB
) AS $$
  SELECT
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'policy_id', p.oid,
          'policy_name', p.polname,
          'table_name', c.relname,
          'command', p.polcmd::text,
          'definition', pg_get_expr(p.polqual, p.polrelid),
          'qual', pg_get_expr(p.polqual, p.polrelid)
        ) ORDER BY p.oid
      ) FILTER (WHERE p.oid IS NOT NULL),
      '[]'::jsonb
    ) as policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE n.nspname = 'public' -- Filter for public schema only
  AND c.relkind = 'r'        -- Filter for ordinary tables only
  GROUP BY c.oid, c.relname, c.relrowsecurity;  -- <--- THIS WAS MISSING
$$ LANGUAGE sql SECURITY DEFINER;