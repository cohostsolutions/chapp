import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, enforceOrganizationAccess, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { logAIError } from "../_shared/ai-errors.ts";
import { createCorsHeaders, handleCorsPreflightRequest, getCorsHeaders } from "../_shared/cors.ts";
import { getDateContext } from "../_shared/ai-utils.ts";
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";
import { validateEvaluateSessionInput } from "../_shared/ai-request-validation.ts";

interface RubricCategory {
  id: string;
  name: string;
  description: string;
  guidelines: string[];
  weight: number;
}

interface TrainingModule {
  id: string;
  title: string;
  description?: string;
  objectives: string[];
  rubric: RubricCategory[];
  persona: {
    name: string;
    mood: string;
    goals: string[];
    constraints: string[];
    background: string;
  };
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface EvaluationResult {
  overallScore: number;
  categoryScores: Array<{
    categoryId: string;
    score: number;
    notes?: string;
  }>;
  strengths: string[];
  improvements: string[];
  aiSummary?: string;
}

function clampScore(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeEvaluation(raw: Record<string, unknown>, module: TrainingModule): EvaluationResult {
  const categoryScoresSource = Array.isArray(raw.categoryScores)
    ? raw.categoryScores
    : Array.isArray(raw.rubric_scores)
      ? raw.rubric_scores
      : [];

  const categoryScores = categoryScoresSource.map((entry, index) => {
    const source = entry as Record<string, unknown>;
    const categoryId = typeof source.categoryId === "string"
      ? source.categoryId
      : typeof source.category_id === "string"
        ? source.category_id
        : module.rubric[index]?.id || `category_${index + 1}`;

    const score = clampScore(
      typeof source.score === "number" && source.score > 5
        ? Math.round(source.score / 20)
        : source.score,
      1,
      5,
      3,
    );

    const noteParts = [
      typeof source.notes === "string" ? source.notes : null,
      typeof source.evidence === "string" ? `Evidence: ${source.evidence}` : null,
      typeof source.improvements === "string" ? `Improve: ${source.improvements}` : null,
    ].filter(Boolean);

    return {
      categoryId,
      score,
      notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
    };
  });

  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths.filter((item): item is string => typeof item === "string")
    : Array.isArray(raw.key_strengths)
      ? raw.key_strengths.filter((item): item is string => typeof item === "string")
      : [];

  const improvements = Array.isArray(raw.improvements)
    ? raw.improvements.filter((item): item is string => typeof item === "string")
    : Array.isArray(raw.areas_for_improvement)
      ? raw.areas_for_improvement.filter((item): item is string => typeof item === "string")
      : [];

  const aiSummary = typeof raw.aiSummary === "string"
    ? raw.aiSummary
    : typeof raw.summary === "string"
      ? raw.summary
      : undefined;

  const overallScore = clampScore(
    typeof raw.overallScore === "number" ? raw.overallScore : raw.overall_score,
    0,
    100,
    0,
  );

  return {
    overallScore,
    categoryScores,
    strengths,
    improvements,
    aiSummary,
  };
}

serve(async (req: Request) => {
  // Get CORS headers with proper origin validation
  const corsHeaders = createCorsHeaders(req);
  
  // Handle preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("authorization");

    const { sessionId, moduleId, transcript, organizationId, startedAt } = await req.json();

    const validation = validateEvaluateSessionInput({
      moduleId,
      sessionId,
      organizationId,
      transcript,
    });

    if (!validation.ok || !validation.normalizedTranscript) {
      return new Response(
        JSON.stringify({ error: validation.error || "Invalid request payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedTranscript = validation.normalizedTranscript;

    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "AI evaluation not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authContext = await verifyAuth(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
    if (!authContext) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }

    // Enforce organization access
    let authorizedOrgId: string;
    try {
      authorizedOrgId = enforceOrganizationAccess(authContext, organizationId, {
        requireOrganization: true,
        allowSuperAdminOverride: true,
      });
    } catch (error) {
      return createAuthErrorResponse(error as Error, corsHeaders);
    }

    console.log(`[evaluate-training-session] User ${authContext.user.id} evaluating module ${moduleId} for org ${authorizedOrgId}`);

    // Get module details (org-scoped)
    const { data: module, error: moduleError } = await supabase
      .from("training_modules")
      .select("*")
      .eq("id", moduleId)
      .eq("organization_id", authorizedOrgId)
      .single();

    if (moduleError || !module) {
      console.error("Module not found:", moduleError);
      return new Response(
        JSON.stringify({ error: "Training module not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trainingModule = module as TrainingModule;
    console.log(`Evaluating session for module: ${trainingModule.title}`);

    // Build evaluation prompt
    const rubricDescription = trainingModule.rubric.map(r => 
      `- ${r.name} (weight: ${r.weight}): ${r.description}\n  Guidelines: ${r.guidelines.join(", ")}`
    ).join("\n");

    const objectivesDescription = trainingModule.objectives.join("\n- ");
    
    const conversationText = normalizedTranscript.map((msg: ConversationMessage) => 
      `${msg.role === "user" ? "TRAINEE" : "CUSTOMER"}: ${msg.content}`
    ).join("\n\n");

    const evaluationPrompt = `You are an expert sales trainer evaluating a training session. 

## Training Module: ${trainingModule.title}
${trainingModule.description || ""}

## Objectives:
- ${objectivesDescription}

## Evaluation Rubric:
${rubricDescription}

## Persona Context:
The lead was playing "${trainingModule.persona?.name || "a customer"}" with mood: ${trainingModule.persona?.mood || "neutral"}
Goals: ${trainingModule.persona?.goals?.join(", ") || "Not specified"}
Background: ${trainingModule.persona?.background || "Not specified"}

## Conversation Transcript:
${conversationText}

## Your Task:
Evaluate the trainee's performance based on the rubric above.

Respond in JSON format using these exact keys:
{
  "overallScore": <number from 0-100>,
  "categoryScores": [
    {
      "categoryId": "<rubric id>",
      "score": <integer from 1-5>,
      "notes": "<one concise sentence with evidence and improvement guidance>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "aiSummary": "<2-3 sentence summary of performance>"
}`;

    // Call AI for evaluation
    const systemPrompt = "You are an expert sales training evaluator. Always respond with valid JSON.";
    const evaluationMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: evaluationPrompt }
    ];

    try {
      const geminiRequest = convertToGeminiFormat(evaluationMessages);
      const callOptions: GeminiCallOptions = {
        maxRetries: 2,
        retryDelayMs: 500,
        timeout: 30000,
        trackMetrics: true,
        fallbackResponse: JSON.stringify({ error: "Evaluation service temporarily unavailable" }),
      };

      const response = await callGeminiAPI(googleApiKey, {
        ...geminiRequest,
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.3,
        },
      }, 'gemini-2.5-flash', callOptions);

      if (!response?.content) {
        console.error("AI evaluation API returned empty response");
        logAIError('evaluate-training-session', new Error(`AI API returned empty response`), {
          organizationId: authorizedOrgId,
          userId: authContext.user.id,
          moduleId
        });
        return new Response(
          JSON.stringify({ error: "AI evaluation failed. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const evaluationText = response.content;
    
    // Parse the JSON from the response
    let evaluation: EvaluationResult;
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = evaluationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        evaluation = normalizeEvaluation(parsed, trainingModule);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse evaluation JSON:", parseError);
      evaluation = {
        overallScore: 70,
        categoryScores: trainingModule.rubric.map(r => ({
          categoryId: r.id,
          score: 3,
          notes: "Evaluation parsing error. Please try again."
        })),
        strengths: ["Completed the training session"],
        improvements: ["Evaluation could not be fully processed"],
        aiSummary: evaluationText.substring(0, 200)
      };
    }

    // Save or update the session
    const sessionData = {
      id: sessionId,
      module_id: moduleId,
      organization_id: authorizedOrgId,
      user_id: authContext.user.id,
      transcript: transcript,
      evaluation: evaluation,
      score: evaluation.overallScore,
      started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      ended_at: new Date().toISOString()
    };

    const { error: persistError } = await supabase
      .from("training_sessions")
      .upsert(sessionData, { onConflict: "id" });

    if (persistError) {
      console.error("Failed to persist training session:", persistError);
    }

      console.log(`Evaluation complete. Score: ${evaluation.overallScore}`);

      return new Response(
        JSON.stringify({ success: true, evaluation, sessionId: sessionId || sessionData.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (geminiError) {
      console.error("Error calling Gemini API:", geminiError);
      logAIError('evaluate-training-session', geminiError instanceof Error ? geminiError : new Error(String(geminiError)), {
        organizationId: authorizedOrgId,
        userId: authContext.user.id,
        moduleId
      });
      return new Response(
        JSON.stringify({ error: "Failed to evaluate session. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error evaluating session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to evaluate training session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
