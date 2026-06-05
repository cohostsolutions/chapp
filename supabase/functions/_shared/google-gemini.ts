/**
 * Google Gemini API integration helper
 * Direct integration with Google Gemini API for robust AI responses
 * 
 * Features:
 * - Automatic retry logic for transient failures
 * - Cost tracking and monitoring
 * - Usage metrics collection
 * - Comprehensive error handling
 * - Rate limit awareness
 */

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData?: { mimeType: string; data: string } }>;
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiCallMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  duration: number; // milliseconds
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface GeminiCallOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number; // milliseconds
  trackMetrics?: boolean;
  fallbackResponse?: string;
}

/**
 * Convert OpenAI-style chat messages to Gemini format
 */
export function convertToGeminiFormat(
  messages: Array<{ role: string; content: string | Array<{ type: string; [key: string]: unknown }> }>,
  systemPrompt?: string
): { contents: GeminiMessage[]; systemInstruction?: { parts: Array<{ text: string }> } } {
  const contents: GeminiMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Skip system messages, we'll add as systemInstruction
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: Array<{ text: string } | { inlineData?: { mimeType: string; data: string } }> = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text as string });
        } else if (part.type === 'image_url') {
          // Handle image URLs - could be data URIs or external URLs
          const imageUrl = (part as { image_url?: { url: string } }).image_url?.url;
          if (imageUrl && imageUrl.startsWith('data:')) {
            // Handle data URI
            const [header, data] = imageUrl.split(',');
            const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
            parts.push({
              inlineData: {
                mimeType,
                data: data,
              },
            });
          } else if (imageUrl) {
            // For external URLs, Gemini expects them as text references
            parts.push({ text: `[Image: ${imageUrl}]` });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  const result: { contents: GeminiMessage[]; systemInstruction?: { parts: Array<{ text: string }> } } = { contents };

  // Add system instruction if provided
  if (systemPrompt) {
    result.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  return result;
}

/**
 * Extract text response from Gemini response
 */
export function extractGeminiResponse(response: GeminiResponse): string {
  if (response.error) {
    throw new Error(`Gemini API error: ${response.error.message}`);
  }

  const firstCandidate = response.candidates?.[0];
  if (!firstCandidate?.content?.parts?.[0]) {
    throw new Error('Empty response from Gemini API');
  }

  const textPart = firstCandidate.content.parts.find((p: { text?: string }) => p.text);
  if (!textPart || !('text' in textPart)) {
    throw new Error('No text content in Gemini response');
  }

  return (textPart as { text: string }).text;
}

/**
 * Call Google Gemini API with retry logic, metrics, and error handling
 * 
 * @param apiKey - Google API key
 * @param request - Gemini API request
 * @param model - Model to use (default: gemini-2.5-flash)
 * @param options - Call options including retries, timeout, fallback
 * @returns Generated text response
 * @throws Will throw if all retries fail and no fallback is provided
 */
export async function callGeminiAPI(
  apiKey: string,
  request: GeminiRequest,
  model: string = 'gemini-2.5-flash',
  options: GeminiCallOptions = {}
): Promise<string> {
  const {
    maxRetries = 3,
    retryDelayMs = 1000,
    timeout = 30000,
    trackMetrics = false,
    fallbackResponse,
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callGeminiAPIInternal(apiKey, request, model, timeout);
      
      if (trackMetrics) {
        const duration = Date.now() - startTime;
        const metrics: GeminiCallMetrics = {
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
          model,
          duration,
          timestamp: new Date().toISOString(),
          success: true,
        };
        logGeminiMetrics(metrics);
      }

      return extractGeminiResponse(response);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 401/403 (auth errors) or 429 (quota exceeded)
      const isAuthError = lastError.message.includes('401') || lastError.message.includes('403');
      const isQuotaError = lastError.message.includes('429');
      
      if (isAuthError || isQuotaError) {
        console.error(`[Gemini] Non-retryable error: ${lastError.message}`);
        break;
      }

      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
        console.warn(`[Gemini] Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If we get here, all retries failed
  const errorMsg = `Gemini API failed after ${maxRetries + 1} attempts: ${lastError?.message}`;
  
  if (trackMetrics) {
    const duration = Date.now() - startTime;
    const metrics: GeminiCallMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      model,
      duration,
      timestamp: new Date().toISOString(),
      success: false,
      error: lastError?.message,
    };
    logGeminiMetrics(metrics);
  }

  // Use fallback if provided
  if (fallbackResponse) {
    console.warn(`[Gemini] Using fallback response: ${errorMsg}`);
    return fallbackResponse;
  }

  throw new Error(errorMsg);
}

/**
 * Internal function to call Gemini API
 */
async function callGeminiAPIInternal(
  apiKey: string,
  request: GeminiRequest,
  model: string,
  timeout: number
): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: { message: string } }).error?.message || response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${errorMessage}`);
    }

    const data = (await response.json()) as GeminiResponse;
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Log Gemini API metrics for monitoring and cost tracking
 */
function logGeminiMetrics(metrics: GeminiCallMetrics): void {
  try {
    console.log(`[Gemini Metrics] ${JSON.stringify({
      model: metrics.model,
      tokens: {
        input: metrics.inputTokens,
        output: metrics.outputTokens,
        total: metrics.totalTokens,
      },
      duration_ms: metrics.duration,
      success: metrics.success,
      timestamp: metrics.timestamp,
      ...(metrics.error && { error: metrics.error }),
    })}`);
  } catch (e) {
    console.error('Failed to log Gemini metrics:', e);
  }
}

/**
 * Calculate estimated cost of Gemini API call
 * Based on Google's pricing (subject to change)
 */
export function estimateGeminiCost(inputTokens: number, outputTokens: number, _model: string = 'gemini-2.5-flash'): number {
  // Gemini 2.5 Flash pricing (as of Jan 2026)
  // Input: $0.075 per 1M tokens
  // Output: $0.30 per 1M tokens
  const inputCost = (inputTokens / 1_000_000) * 0.075;
  const outputCost = (outputTokens / 1_000_000) * 0.30;
  return inputCost + outputCost;
}
