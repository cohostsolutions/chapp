/**
 * Standardized AI gateway error handling
 * Provides deterministic, user-friendly error responses
 */

export interface AIErrorResponse {
  error: string;
  code: string;
  retryable: boolean;
  retryAfter?: number;
}

/**
 * Parse and categorize AI gateway errors
 * Returns user-safe error messages without exposing internals
 */
export async function handleAIGatewayError(
  response: Response,
  operation: string
): Promise<AIErrorResponse> {
  const status = response.status;

  // Rate limiting
  if (status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    return {
      error: 'Too many AI requests. Please wait a moment and try again.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryable: true,
      retryAfter,
    };
  }

  // Payment/credits exhausted
  if (status === 402) {
    return {
      error: 'AI service credits exhausted. Please contact support to add more credits.',
      code: 'CREDITS_EXHAUSTED',
      retryable: false,
    };
  }

  // Bad request
  if (status === 400) {
    try {
      const errorData = await response.json();
      return {
        error: `Invalid request: ${errorData.error || 'Please check your input'}`,
        code: 'INVALID_REQUEST',
        retryable: false,
      };
    } catch {
      return {
        error: 'Invalid request to AI service',
        code: 'INVALID_REQUEST',
        retryable: false,
      };
    }
  }

  // Server errors (5xx) - retryable
  if (status >= 500) {
    return {
      error: 'AI service temporarily unavailable. Please try again in a moment.',
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
      retryAfter: 5,
    };
  }

  // Unauthorized
  if (status === 401 || status === 403) {
    return {
      error: 'AI service authentication failed. Please contact support.',
      code: 'AUTH_FAILED',
      retryable: false,
    };
  }

  // Unknown error
  return {
    error: `${operation} failed. Please try again or contact support if the issue persists.`,
    code: 'UNKNOWN_ERROR',
    retryable: true,
  };
}

/**
 * Generate a fallback response when AI is unavailable
 */
export function generateFallbackResponse(
  operation: 'chat' | 'summary' | 'evaluation' | 'document-processing',
  context?: Record<string, unknown>
): string {
  switch (operation) {
    case 'chat':
      return "I apologize, but I'm experiencing technical difficulties at the moment. Please try your message again, or contact support if the issue continues.";
    
    case 'summary':
      return "Summary unavailable at this time. The conversation history has been preserved.";
    
    case 'evaluation':
      return JSON.stringify({
        overall_score: 0,
        rubric_scores: [],
        key_strengths: ['Session completed'],
        areas_for_improvement: ['Evaluation temporarily unavailable'],
        recommendations: ['Please try evaluating again'],
        summary: 'Technical issue prevented automated evaluation. Manual review recommended.',
      });
    
    case 'document-processing':
      return `[Document: ${context?.filename || 'Uploaded file'}. Automated extraction temporarily unavailable. Please add content manually.]`;
    
    default:
      return 'Service temporarily unavailable. Please try again.';
  }
}

/**
 * Log AI errors for monitoring and debugging
 */
export function logAIError(
  operation: string,
  error: Error | AIErrorResponse,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : error.error;
  const errorCode = error instanceof Error ? 'EXCEPTION' : error.code;

  console.error('[AI Error]', {
    timestamp,
    operation,
    code: errorCode,
    message: errorMessage,
    context: context || {},
  });
}

/**
 * Retry helper with exponential backoff specifically for AI operations
 * Only retries on retryable errors
 */
export async function retryAIRequest<T>(
  operation: () => Promise<Response>,
  operationName: string,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<{ response?: Response; error?: AIErrorResponse }> {
  let lastError: AIErrorResponse | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await operation();
      clearTimeout(timeoutId);

      // Check if response indicates an error
      if (!response.ok) {
        const aiError = await handleAIGatewayError(response, operationName);
        lastError = aiError;

        // Don't retry non-retryable errors
        if (!aiError.retryable) {
          logAIError(operationName, aiError, { attempt, maxRetries });
          return { error: aiError };
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          logAIError(operationName, aiError, { attempt, maxRetries, exhausted: true });
          return { error: aiError };
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
          10000 // Max 10s delay
        );

        console.log(`[AI Retry] ${operationName} attempt ${attempt}/${maxRetries} failed (${aiError.code}), retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Success
      return { response };

    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      const errorMsg = isTimeout ? 'Request timeout' : error instanceof Error ? error.message : 'Unknown error';

      lastError = {
        error: isTimeout ? 'AI request timed out. Please try again.' : 'Network error communicating with AI service.',
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        retryable: true,
      };

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.log(`[AI Retry] ${operationName} attempt ${attempt}/${maxRetries} threw error (${errorMsg}), retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      logAIError(operationName, lastError, { attempt, maxRetries, error: errorMsg });
      return { error: lastError };
    }
  }

  return { error: lastError || { error: 'All retry attempts exhausted', code: 'MAX_RETRIES', retryable: false } };
}
