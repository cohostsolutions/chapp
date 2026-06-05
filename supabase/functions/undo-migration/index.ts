import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const tableMap: Record<string, string> = {
  leads: 'leads',
  platforms: 'social_platforms',
  bookings: 'bookings',
  orders: 'orders',
  offerings: 'offerings',
  room_units: 'room_units',
  knowledge_entries: 'knowledge_base_entries',
  knowledge_docs: 'knowledge_base_documents',
  reports: 'reports',
  workflows: 'workflows',
  calendar_events: 'calendar_events',
  communications: 'communications',
  message_templates: 'message_templates',
  training_modules: 'training_modules',
  team_chats: 'team_chats',
  ai_conversations: 'ai_conversations',
  agent_priorities: 'agent_priorities',
  rubric_templates: 'rubric_templates',
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
      return new Response(JSON.stringify({ error: 'Only super admins can undo migrations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { migrationId } = await req.json();

    if (!migrationId) {
      return new Response(JSON.stringify({ error: 'Migration ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: migration, error: fetchError } = await serviceClient
      .from('migration_logs')
      .select('*')
      .eq('id', migrationId)
      .single();

    if (fetchError || !migration) {
      return new Response(JSON.stringify({ error: 'Migration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const canUndoUntil = new Date(migration.can_undo_until).getTime();
    if (Date.now() > canUndoUntil) {
      return new Response(JSON.stringify({ error: 'Undo window has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (migration.is_undone) {
      return new Response(JSON.stringify({ error: 'Migration already undone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const categoryKeys = Object.keys(tableMap);

    for (const key of categoryKeys) {
      const ids = migration[`migrated_${key}`] as string[];
      if (!ids || ids.length === 0) continue;

      const tableName = tableMap[key];
      if (!tableName) continue;

      const { error } = await serviceClient
        .from(tableName)
        .update({ organization_id: migration.source_organization_id })
        .eq('organization_id', migration.target_organization_id)
        .in('id', ids);

      if (error) {
        console.error(`Failed to revert ${key}:`, error);
        return new Response(JSON.stringify({ error: `Failed to revert ${key}: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { error: updateLogError } = await serviceClient
      .from('migration_logs')
      .update({ is_undone: true, undone_at: new Date().toISOString() })
      .eq('id', migrationId);

    if (updateLogError) {
      return new Response(JSON.stringify({ error: `Failed to update migration log: ${updateLogError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Undo error:', err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});