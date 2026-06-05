import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Note: Database types removed to avoid import issues - using any types
import { verifyAuth, verifyResourceOwnership, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { validateFileUpload, sanitizeExtractedText } from "../_shared/sanitization.ts";
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  const corsHeaders = createCorsHeaders(req);

  try {
    const authHeader = req.headers.get("authorization");

    const { documentId } = await req.json();

    if (typeof documentId !== "string" || !UUID_REGEX.test(documentId)) {
      return new Response(
        JSON.stringify({ error: "Valid document ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");

    if (!googleApiKey) {
      console.error("GOOGLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI processing not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify authentication and load user context
    const authContext = await verifyAuth(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
    if (!authContext) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Basic org guard before loading resource
    if (!authContext.isSuperAdmin && !authContext.organizationId) {
      return createAuthErrorResponse(new Error('User has no organization'), corsHeaders);
    }

    // Get document info
    const { data: document, error: docError } = await supabase
      .from("knowledge_base_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify resource ownership
    try {
      verifyResourceOwnership(authContext, document.organization_id, authContext.organizationId || document.organization_id || '');
    } catch (error) {
      return createAuthErrorResponse(error as Error, corsHeaders);
    }

    // Validate file type and size
    const fileValidation = validateFileUpload(document.file_type, document.file_size || 0);
    if (!fileValidation.valid) {
      console.error("File validation failed:", fileValidation.error);
      await supabase
        .from("knowledge_base_documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: fileValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get PII redaction settings for the organization
    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('training_pii_redaction')
      .eq('organization_id', document.organization_id)
      .maybeSingle();
    
    const redactPII = orgSettings?.training_pii_redaction ?? false;

    // Update status to processing
    await supabase
      .from("knowledge_base_documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    console.log(`Processing document: ${document.file_name} (${document.file_type})`);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("knowledge-base")
      .download(document.file_path);

    if (downloadError || !fileData) {
      console.error("Failed to download file:", downloadError);
      await supabase
        .from("knowledge_base_documents")
        .update({ status: "error" })
        .eq("id", documentId);
      
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extractedText = "";
    const fileType = document.file_type;

    // Handle different file types
    if (fileType === "text/plain") {
      // Plain text - read directly
      extractedText = await fileData.text();
    } else if (fileType.startsWith("image/")) {
      // Image - use AI vision to extract text/describe
      const base64 = await blobToBase64(fileData);
      extractedText = await extractTextFromImage(base64, fileType, googleApiKey);
    } else if (fileType === "application/pdf" || fileType.includes("word") || fileType.includes("document")) {
      // For PDFs and Word docs - try to extract what we can
      // Note: Full PDF parsing would require additional libraries
      // For now, we'll use AI to process if it's an image-based PDF
      try {
        const text = await fileData.text();
        if (text && text.trim().length > 50) {
          extractedText = text;
        } else {
          extractedText = `[Document uploaded: ${document.file_name}. Manual content entry may be needed for complex documents.]`;
        }
      } catch {
        extractedText = `[Document uploaded: ${document.file_name}. Content extraction pending.]`;
      }
    }

    // Use AI to summarize and structure the extracted content
    if (extractedText && extractedText.length > 100) {
      // Apply PII redaction if enabled before sending to AI
      const textForAI = sanitizeExtractedText(extractedText, redactPII);
      extractedText = await summarizeContent(textForAI, document.file_name, googleApiKey);
    } else if (redactPII && extractedText) {
      // Still redact even if not summarizing
      extractedText = sanitizeExtractedText(extractedText, true);
    }

    // Update document with extracted text
    const { error: updateError } = await supabase
      .from("knowledge_base_documents")
      .update({ 
        extracted_text: extractedText,
        status: "processed" 
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save extracted text" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully processed document: ${document.file_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? "..." : "")
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing document:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractTextFromImage(base64: string, mimeType: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all text from this image. If it's a document, transcribe the content. If it's an image with labels or captions, describe what you see and extract any visible text. Format the output as clean, readable text."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI vision API error:", response.status);
      return "[Image uploaded - text extraction failed]";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "[No text detected in image]";
  } catch (error) {
    console.error("Error extracting text from image:", error);
    return "[Image processing error]";
  }
}

async function summarizeContent(content: string, fileName: string, apiKey: string): Promise<string> {
  try {
    // Truncate very long content for API
    const truncatedContent = content.substring(0, 10000);
    
    const systemPrompt = "You are a helpful assistant that processes documents for a knowledge base. Your task is to clean up and structure the extracted text, preserving all important information while improving readability. Keep the original content but organize it better if needed.";
    
    const userMessage = `Process this content from the file "${fileName}":\n\n${truncatedContent}\n\nClean up the text, fix any extraction errors, and structure it for easy reference. Preserve all key information.`;
    
    const geminiRequest = convertToGeminiFormat([
      { role: 'user', content: userMessage }
    ], systemPrompt);

    const callOptions: GeminiCallOptions = {
      maxRetries: 2,
      retryDelayMs: 500,
      timeout: 30000,
      trackMetrics: true,
      fallbackResponse: truncatedContent, // Return original content as fallback
    };
    const result = await callGeminiAPI(apiKey, {
      ...geminiRequest,
      generationConfig: {
        maxOutputTokens: 2000,
      },
    }, 'gemini-2.5-flash', callOptions);

    return result;
  } catch (error) {
    console.error("Error summarizing content:", error);
    return content;
  }
}
