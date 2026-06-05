import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  getDateContext,
  agentConfigs,
  getLanguageName,
  getAgentTemperature,
  type AgentType,
} from "../_shared/ai-utils.ts";
import { sanitizeConversationHistory } from "../_shared/sanitization.ts";
import {
  MAX_DEMO_MESSAGE_LENGTH,
  normalizeKnowledgeBase,
  normalizeMessage,
} from "../_shared/ai-request-validation.ts";
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const fallbackRateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
}

function checkFallbackRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = fallbackRateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    fallbackRateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count) };
}

// Demo-specific agent configurations (extend shared configs with demo context)
const demoAgentConfigs = {
  jay: {
    ...agentConfigs.jay,
    systemPrompt: `${agentConfigs.jay.systemPrompt}

This is a DEMO conversation. Keep responses concise (2-3 sentences max). Be helpful and show what you can do.`,
  },
  may: {
    ...agentConfigs.may,
    systemPrompt: `${agentConfigs.may.systemPrompt}

This is a DEMO conversation. Keep responses concise (2-3 sentences max). Show how you help food businesses.`,
  },
  cece: {
    ...agentConfigs.cece,
    systemPrompt: `${agentConfigs.cece.systemPrompt}

This is a DEMO conversation. Keep responses concise (2-3 sentences max). Show how you help hotels/resorts.`,
  },
};

// Language instructions for demo (uses shared language names)
const languageInstructions: Record<string, string> = {
  en: 'Respond in English.',
  tl: 'Respond in Tagalog (Filipino). Use natural Tagalog expressions.',
  ceb: 'Respond in Cebuano (Bisaya). Use natural Cebuano expressions.',
  ja: 'Respond in Japanese (日本語). Use polite Japanese.',
  zh: 'Respond in Mandarin Chinese (中文). Use simplified Chinese characters.',
};

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  try {
    const { message, agentType, language, knowledgeBase, conversationHistory } = await req.json();

    const safeMessage = normalizeMessage(message, MAX_DEMO_MESSAGE_LENGTH);
    if (!safeMessage) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 20 requests per IP per hour for demo usage
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const ip = getClientIp(req);

      const hourWindow = new Date();
      hourWindow.setMinutes(0, 0, 0);
      const windowStartIso = hourWindow.toISOString();
      const rlKey = `demo_ai_chat_ip:${ip}`;

      const { data: rlData, error: rlError } = await supabase.rpc('increment_rate_limit', {
        p_key: rlKey,
        p_window_start: windowStartIso,
        p_increment: 1,
      });

      if (rlError) {
        console.error('Rate limit RPC error:', rlError);
        const fallbackResult = checkFallbackRateLimit(rlKey);
        if (!fallbackResult.allowed) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded for demo usage. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const currentCount = Array.isArray(rlData) ? rlData[0] : rlData;
        const countValue = typeof currentCount === 'number' ? currentCount : (currentCount?.count ?? currentCount);
        if (typeof countValue === 'number' && countValue > RATE_LIMIT_MAX_REQUESTS) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded for demo usage. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (e) {
      console.error('Rate limit check failed:', e);
      const fallbackResult = checkFallbackRateLimit(`demo_ai_chat_ip:${getClientIp(req)}`);
      if (!fallbackResult.allowed) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded for demo usage. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const agent = demoAgentConfigs[agentType as AgentType] || demoAgentConfigs.jay;
    const langInstruction = languageInstructions[language] || languageInstructions.en;
    const sanitizedHistory = sanitizeConversationHistory(conversationHistory, 20);
    const safeKnowledgeBase = normalizeKnowledgeBase(knowledgeBase);

    // Build system prompt with date context for accurate date handling
    const dateContext = getDateContext();
    
    let systemPrompt = `${agent.systemPrompt}

${langInstruction}

${dateContext}

IMPORTANT: This is a demo. After 4-5 exchanges, encourage the user to click "Get Started" to learn more.`;

    // Add knowledge base if provided
    if (safeKnowledgeBase) {
      systemPrompt += `\n\nKnowledge about your business (use this to answer questions):\n${safeKnowledgeBase}`;
    }

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: safeMessage },
    ];

    console.log(`[Demo ${agent.name}] Processing message in ${language}`);

    // Call Google Gemini API directly
    try {
      const geminiRequest = convertToGeminiFormat(messages);
      const callOptions: GeminiCallOptions = {
        maxRetries: 2,
        retryDelayMs: 500,
        timeout: 20000,
        trackMetrics: true,
        fallbackResponse: 'I apologize, I\'m currently experiencing technical difficulties. Please try again in a moment.',
      };

      const responseText = await callGeminiAPI(GOOGLE_API_KEY, {
        ...geminiRequest,
        generationConfig: {
          maxOutputTokens: 300,
          temperature: getAgentTemperature(agentType as AgentType),
        },
      }, 'gemini-2.5-flash', callOptions);

      console.log(`[Demo ${agent.name}] Response generated successfully`);
      return new Response(
        JSON.stringify({ 
          message: responseText,
          agentName: agent.name,
          language: getLanguageName(language)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Demo ${agent.name}] Gemini API error:`, errorMsg);
      return new Response(
        JSON.stringify({ error: 'Unable to generate response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    // Log detailed error server-side only
    console.error('Error in demo AI chat:', error);
    // Return generic error to client - don't expose internal details
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request. Please try again.',
      code: 'ERR_PROCESSING'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
