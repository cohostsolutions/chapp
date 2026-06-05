import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req, "x-scheduler-secret");

  const preflightResponse = handleCorsPreflightRequest(req, "x-scheduler-secret");
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const schedulerSecret = req.headers.get("x-scheduler-secret");

    if (!schedulerSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isValidSecret, error: secretValidationError } = await supabase.rpc(
      "is_valid_internal_job_secret",
      {
        p_job_name: "cleanup-training-retention",
        p_secret: schedulerSecret,
      },
    );

    if (secretValidationError) {
      console.error("Training retention secret validation error:", secretValidationError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("cleanup_training_sessions_by_retention");

    if (error) {
      console.error("Training retention cleanup error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = Array.isArray(data) ? data : [];
    const deletedSessions = result.reduce((sum, row) => sum + Number(row.deleted_sessions || 0), 0);

    console.log("Training retention cleanup completed", {
      organizationsProcessed: result.length,
      deletedSessions,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      organizationsProcessed: result.length,
      deletedSessions,
      details: result,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Training retention cleanup function error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});