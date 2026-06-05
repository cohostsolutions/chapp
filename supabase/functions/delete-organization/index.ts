import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // ============================================
    // STEP 1: AUTHENTICATE USER
    // ============================================
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('[AUTH] Unauthorized request');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 2: VERIFY SUPER ADMIN ROLE (CRITICAL)
    // ============================================
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');

    if (rolesError || !isSuperAdmin) {
      // Log unauthorized attempt for security monitoring
      console.error('[SECURITY] Unauthorized org deletion attempt', {
        user_id: user.id,
        user_email: user.email,
        timestamp: new Date().toISOString(),
      });

      // Insert security audit log (fire and forget)
      supabaseClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'DELETE_ORGANIZATION_DENIED',
        resource_type: 'organizations',
        details: {
          reason: 'Insufficient privileges',
          attempted_at: new Date().toISOString(),
        }
      }).catch(err => console.error('Failed to log security event:', err));

      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 3: VALIDATE REQUEST PAYLOAD
    // ============================================
    const { organizationId } = await req.json();
    
    if (!organizationId || typeof organizationId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: organizationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 4: LOG DELETION ATTEMPT (AUDIT TRAIL)
    // ============================================
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'DELETE_ORGANIZATION_INITIATED',
      resource_type: 'organizations',
      resource_id: organizationId,
      details: {
        initiated_by: user.email,
        initiated_at: new Date().toISOString(),
      }
    });

    // ============================================
    // STEP 5: CREATE SERVICE ROLE CLIENT (ELEVATED PRIVILEGES)
    // ============================================
    // Use service role to bypass RLS for cascading deletes
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ============================================
    // STEP 6: FETCH ORGANIZATION DATA (FOR AUDIT LOG)
    // ============================================
    const { data: orgData, error: orgFetchError } = await serviceClient
      .from('organizations')
      .select('id, name, slug, created_at')
      .eq('id', organizationId)
      .single();

    if (orgFetchError || !orgData) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 7: COUNT ASSOCIATED DATA (FOR AUDIT LOG)
    // ============================================
    const [leadsCount, bookingsCount, ordersCount, usersCount] = await Promise.all([
      serviceClient.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      serviceClient.from('bookings').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      serviceClient.from('orders').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      serviceClient.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    ]);

    const deletionSummary = {
      organization: orgData.name,
      leads_deleted: leadsCount.count || 0,
      bookings_deleted: bookingsCount.count || 0,
      orders_deleted: ordersCount.count || 0,
      users_affected: usersCount.count || 0,
    };

    console.log('[INFO] Deleting organization with data:', deletionSummary);

    const { data: conversations, error: conversationsError } = await serviceClient
      .from('ai_conversations')
      .select('id')
      .eq('organization_id', organizationId);

    if (conversationsError) {
      throw new Error(`Failed to load AI conversations: ${conversationsError.message}`);
    }

    const conversationIds = (conversations || []).map((conversation) => conversation.id);

    // ============================================
    // STEP 8: CASCADE DELETE ASSOCIATED DATA
    // ============================================
    try {
      // Delete in order of dependencies (child tables first)
      const deletePromises = [
        // Communications & AI data
        serviceClient.from('communications').delete().eq('organization_id', organizationId),
        serviceClient.from('ai_conversations').delete().eq('organization_id', organizationId),
        
        // Business data
        serviceClient.from('bookings').delete().eq('organization_id', organizationId),
        serviceClient.from('orders').delete().eq('organization_id', organizationId),
        serviceClient.from('leads').delete().eq('organization_id', organizationId),
        
        // Configuration data
        serviceClient.from('room_units').delete().eq('organization_id', organizationId),
        serviceClient.from('offerings').delete().eq('organization_id', organizationId),
        serviceClient.from('knowledge_base_entries').delete().eq('organization_id', organizationId),
        serviceClient.from('knowledge_base_documents').delete().eq('organization_id', organizationId),
        serviceClient.from('social_platforms').delete().eq('organization_id', organizationId),
        serviceClient.from('agent_priorities').delete().eq('organization_id', organizationId),
        serviceClient.from('calendar_sync_events').delete().eq('organization_id', organizationId),
        
        // Training data
        serviceClient.from('training_sessions').delete().eq('organization_id', organizationId),
        serviceClient.from('training_modules').delete().eq('organization_id', organizationId),
      ];

      if (conversationIds.length > 0) {
        deletePromises.unshift(
          serviceClient.from('ai_messages').delete().in('conversation_id', conversationIds)
        );
      }

      await Promise.all(deletePromises);

      // ============================================
      // STEP 9: UPDATE USER PROFILES (REMOVE ORG REFERENCE)
      // ============================================
      await serviceClient
        .from('profiles')
        .update({ organization_id: null })
        .eq('organization_id', organizationId);

      // ============================================
      // STEP 10: DELETE THE ORGANIZATION
      // ============================================
      const { error: deleteError } = await serviceClient
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      if (deleteError) {
        throw new Error(`Failed to delete organization: ${deleteError.message}`);
      }

      // ============================================
      // STEP 11: LOG SUCCESS (AUDIT TRAIL)
      // ============================================
      await serviceClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'DELETE_ORGANIZATION_SUCCESS',
        resource_type: 'organizations',
        resource_id: organizationId,
        details: {
          ...deletionSummary,
          deleted_by: user.email,
          deleted_at: new Date().toISOString(),
        }
      });

      console.log('[SUCCESS] Organization deleted:', organizationId);

      return new Response(
        JSON.stringify({
          success: true,
          summary: deletionSummary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (deleteError: any) {
      // ============================================
      // STEP 12: LOG FAILURE (AUDIT TRAIL)
      // ============================================
      console.error('[ERROR] Organization deletion failed:', deleteError);

      await serviceClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'DELETE_ORGANIZATION_FAILED',
        resource_type: 'organizations',
        resource_id: organizationId,
        details: {
          error_message: deleteError.message,
          failed_at: new Date().toISOString(),
        }
      });

      return new Response(
        JSON.stringify({ error: 'Failed to delete organization. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[CRITICAL] Unexpected error in delete-organization:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
