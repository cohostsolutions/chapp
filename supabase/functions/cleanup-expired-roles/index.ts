import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  success: boolean;
  expired_count: number;
  timestamp: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // ============================================
    // STEP 1: AUTHENTICATE REQUEST (OPTIONAL)
    // ============================================
    // If you want to restrict this endpoint to super admins only, uncomment:
    /*
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify super admin role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    */

    console.log('[CLEANUP] Starting expired roles cleanup...');

    // ============================================
    // STEP 2: CALL CLEANUP FUNCTION
    // ============================================
    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_roles');

    if (error) {
      console.error('[CLEANUP] Error:', error);
      throw error;
    }

    const expiredCount = data || 0;
    console.log(`[CLEANUP] Removed ${expiredCount} expired role(s)`);

    // ============================================
    // STEP 3: LOG CLEANUP EVENT
    // ============================================
    if (expiredCount > 0) {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'cleanup_expired_roles',
        table_name: 'user_roles',
        metadata: {
          expired_count: expiredCount,
          timestamp: new Date().toISOString()
        }
      });
    }

    const result: CleanupResult = {
      success: true,
      expired_count: expiredCount,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[CLEANUP] Fatal error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const result: CleanupResult = {
      success: false,
      expired_count: 0,
      timestamp: new Date().toISOString(),
      error: errorMessage
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
