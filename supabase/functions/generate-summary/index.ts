import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, enforceOrganizationAccess, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { logAIError } from "../_shared/ai-errors.ts";
import { sanitizeConversationHistory } from "../_shared/sanitization.ts";
import { MAX_SUMMARY_MESSAGES, MAX_SUMMARY_MESSAGE_LENGTH, normalizeLeadName } from "../_shared/ai-request-validation.ts";
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";

interface SummaryRequest {
  leadName: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  organizationId?: string;
}

serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Validate authentication
    const authHeader = req.headers.get('authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify authentication
    const authContext = await verifyAuth(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
    if (!authContext) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { leadName, messages, organizationId } = await req.json() as SummaryRequest;

    const safeLeadName = normalizeLeadName(leadName);
    if (!safeLeadName) {
      return new Response(
        JSON.stringify({ error: 'leadName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce organization access - summaries are org-scoped
    let authorizedOrgId: string;
    try {
      authorizedOrgId = enforceOrganizationAccess(authContext, organizationId, {
        requireOrganization: true,
        allowSuperAdminOverride: true,
      });
    } catch (error) {
      return createAuthErrorResponse(error as Error, corsHeaders);
    }

    console.log(`[generate-summary] User ${authContext.user.id} generating summary for org ${authorizedOrgId}`);

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');

    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ summary: 'No conversation history available.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedMessages = sanitizeConversationHistory(messages, MAX_SUMMARY_MESSAGES).map((msg) => ({
      ...msg,
      content: msg.content.slice(0, MAX_SUMMARY_MESSAGE_LENGTH),
    }));

    if (sanitizedMessages.length === 0) {
      return new Response(
        JSON.stringify({ summary: 'No usable conversation history available.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format conversation for summary
    const conversationText = sanitizedMessages
      .map(m => `${m.role === 'user' ? 'Lead' : 'AI'}: ${m.content}`)
      .join('\n');

    console.log(`Generating summary for lead: ${safeLeadName}`);

    // Use direct Google Gemini API
    const systemPrompt = `You are a sales assistant summarizer. Create a brief, actionable summary of the conversation with a lead. 
Focus on:
- Key interests or needs expressed
- Products/services discussed
- Current status and next steps
- Important details or concerns
Keep the summary to 2-3 sentences maximum. Be concise and business-focused.`;

    const geminiMessages = convertToGeminiFormat([
      {
        role: 'user',
        content: `Summarize this conversation with lead "${safeLeadName}":\n\n${conversationText}`
      }
    ], systemPrompt);

    try {
      const callOptions: GeminiCallOptions = {
        maxRetries: 3,
        retryDelayMs: 1000,
        timeout: 30000,
        trackMetrics: true,
        fallbackResponse: 'Unable to generate summary at this moment. Please try again later.',
      };

      const summary = await callGeminiAPI(GOOGLE_API_KEY, {
        ...geminiMessages,
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.3,
        },
      }, 'gemini-2.5-flash', callOptions);

      console.log('Summary generated successfully');

      return new Response(
        JSON.stringify({ summary }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[generate-summary] Gemini API error:', errorMsg);
      logAIError('generate-summary', error as Error, {
        organizationId: authorizedOrgId,
        userId: authContext.user.id,
      });

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[generate-summary] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});