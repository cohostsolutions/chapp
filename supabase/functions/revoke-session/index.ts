import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface RevokeSessionRequest {
  userId: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing environment variables');
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the calling user's identity from JWT
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId }: RevokeSessionRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for authorization checks
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // AUTHORIZATION CHECK: User can only revoke their own sessions OR must be super_admin
    const isSelf = callingUser.id === userId;
    
    if (!isSelf) {
      // Check if caller is a super_admin
      const { data: callerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callingUser.id);

      const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin');

      if (!isSuperAdmin) {
        console.log(`Unauthorized session revocation attempt by ${callingUser.id} for user ${userId}`);
        return new Response(
          JSON.stringify({ error: 'You can only revoke your own sessions or must be a super admin' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mark all sessions as inactive in user_sessions table
    await supabaseAdmin
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Perform the session revocation via Supabase Auth Admin API
    const fetchRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/logout`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!fetchRes.ok) {
      const errorData = await fetchRes.json();
      throw new Error(errorData.message || 'Failed to revoke user sessions.');
    }

    console.log(`Sessions revoked for user ${userId} by ${callingUser.id}`);

    return new Response(
      JSON.stringify({ message: 'All sessions for the user have been revoked.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in revoke-session:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});