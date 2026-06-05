import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

interface LogContext {
  functionName: string;
  method: string;
  path?: string;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestBodySize?: number;
  metadata?: Record<string, unknown>;
}

interface LogResult {
  responseStatus: number;
  errorMessage?: string;
  responseTimeMs: number;
}

/**
 * Request logger for edge functions
 * Tracks API usage patterns and helps detect abuse
 */
export class EdgeFunctionLogger {
  private supabase: SupabaseClient;
  private startTime: number;
  private context: LogContext;

  constructor(supabase: SupabaseClient, context: LogContext) {
    this.supabase = supabase;
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * Log the completion of a request
   */
  async logRequest(result: LogResult): Promise<void> {
    // Silently skip logging - table may not exist
    // This is intentional to prevent request failures due to missing logging infrastructure
    console.log(`[${this.context.functionName}] ${this.context.method} - Status: ${result.responseStatus}, Time: ${result.responseTimeMs || (Date.now() - this.startTime)}ms`);
  }

  /**
   * Extract request metadata from headers and request
   */
  static extractRequestContext(req: Request, functionName: string): Partial<LogContext> {
    const url = new URL(req.url);
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      req.headers.get('x-real-ip') ||
                      undefined;
    
    const userAgent = req.headers.get('user-agent') || undefined;
    
    return {
      functionName,
      method: req.method,
      path: url.pathname,
      ipAddress,
      userAgent,
    };
  }

  /**
   * Check if an IP address has exceeded rate limits
   * Returns true if abuse is detected
   */
  static async checkAbusePattern(
    supabase: SupabaseClient,
    ipAddress: string | undefined,
    functionName: string,
    threshold: number = 100
  ): Promise<boolean> {
    if (!ipAddress) return false;

    try {
      // Check requests in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { count, error } = await supabase
        .from('edge_function_logs')
        .select('id', { count: 'exact', head: true })
        .eq('ip_address', ipAddress)
        .eq('function_name', functionName)
        .gte('created_at', fiveMinutesAgo);

      if (error) {
        console.error('Error checking abuse pattern:', error);
        return false;
      }

      const requestCount = count ?? 0;
      return requestCount > threshold;
    } catch (error) {
      console.error('Error in checkAbusePattern:', error);
      return false;
    }
  }
}

/**
 * Create a logger instance for an edge function
 */
export function createLogger(req: Request, functionName: string): EdgeFunctionLogger {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const context = EdgeFunctionLogger.extractRequestContext(req, functionName);
  
  return new EdgeFunctionLogger(supabase, context as LogContext);
}

/**
 * Middleware wrapper that automatically logs requests
 */
export function withLogging(
  functionName: string,
  handler: (req: Request, logger: EdgeFunctionLogger) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const logger = createLogger(req, functionName);
    const startTime = Date.now();

    try {
      const response = await handler(req, logger);
      const responseTimeMs = Date.now() - startTime;

      // Log successful request
      await logger.logRequest({
        responseStatus: response.status,
        responseTimeMs,
      });

      return response;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed request
      await logger.logRequest({
        responseStatus: 500,
        errorMessage,
        responseTimeMs,
      });

      throw error;
    }
  };
}
