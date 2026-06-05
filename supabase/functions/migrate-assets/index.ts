import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

interface MigrationRequest {
  sourceOrgId: string;
  targetOrgId: string;
  assets: Record<string, AssetSelectionPayload>;
}

type AssetSelectionPayload =
  | { mode: 'all' }
  | { mode: 'ids'; ids: string[] };

const allowedCategories = new Set([
  'leads',
  'platforms',
  'bookings',
  'orders',
  'offerings',
  'room_units',
  'knowledge_entries',
  'knowledge_docs',
  'reports',
  'workflows',
  'calendar_events',
  'communications',
  'message_templates',
  'training_modules',
  'team_chats',
  'ai_conversations',
  'agent_priorities',
  'rubric_templates',
]);

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0);
};

const sanitizeAssets = (assets: unknown): Record<string, AssetSelectionPayload> => {
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
    throw new Error('Invalid asset selection payload');
  }

  const sanitized: Record<string, AssetSelectionPayload> = {};

  for (const [key, value] of Object.entries(assets as Record<string, unknown>)) {
    if (!allowedCategories.has(key)) {
      throw new Error(`Invalid asset category: ${key}`);
    }

    if (Array.isArray(value)) {
      if (!isStringArray(value) || value.length === 0) {
        throw new Error(`Invalid asset IDs for category: ${key}`);
      }

      sanitized[key] = { mode: 'ids', ids: value };
      continue;
    }

    if (!value || typeof value !== 'object') {
      throw new Error(`Invalid asset selection for category: ${key}`);
    }

    const mode = (value as { mode?: unknown }).mode;

    if (mode === 'all') {
      sanitized[key] = { mode: 'all' };
      continue;
    }

    if (mode === 'ids' && isStringArray((value as { ids?: unknown }).ids) && (value as { ids: string[] }).ids.length > 0) {
      sanitized[key] = { mode: 'ids', ids: (value as { ids: string[] }).ids };
      continue;
    }

    throw new Error(`Invalid asset selection for category: ${key}`);
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error('Select at least one asset category to migrate');
  }

  return sanitized;
};

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Only super admins can perform asset migrations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: MigrationRequest = await req.json();
    const { sourceOrgId, targetOrgId } = body;
    const assets = sanitizeAssets(body.assets);

    if (!sourceOrgId || !targetOrgId || sourceOrgId === targetOrgId) {
      return new Response(JSON.stringify({ error: 'Invalid source or target organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Call RPC function for atomic migration (all-or-nothing with automatic rollback)
    const { data: rpcResult, error: rpcError } = await serviceClient
      .rpc('migrate_assets_atomic', {
        p_source_org_id: sourceOrgId,
        p_target_org_id: targetOrgId,
        p_assets: assets,
        p_performed_by: user.id
      });

    if (rpcError) {
      console.error('Migration RPC failed:', rpcError);
      return new Response(JSON.stringify({ 
        error: `Migration failed: ${rpcError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the created migration log
    const { data: logData, error: logError } = await serviceClient
      .from('migration_logs')
      .select('*')
      .eq('id', rpcResult.migration_id)
      .single();

    if (logError) {
      console.error('Failed to fetch migration log:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results: rpcResult.counts,
      migrationLog: logData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Migration error:', err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});