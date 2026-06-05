// CORS configuration with origin validation
// Only allow requests from these domains

const ALLOWED_ORIGINS = [
  'https://alcornexus.com',
  'https://www.alcornexus.com',
  'https://alcor-nexus.lovable.app',
  // Add localhost for development
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
];

const DEFAULT_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

export function getCorsHeaders(origin: string | null, additionalHeaders?: string): Record<string, string> {
  // Allow production domains + Lovable preview domains
  const allowedOrigin =
    origin &&
    ALLOWED_ORIGINS.some((allowed) =>
      origin === allowed ||
      origin.endsWith('.lovable.app') ||
      origin.endsWith('.lovableproject.com')
    )
      ? origin
      : ALLOWED_ORIGINS[0];

  const allowedHeaders = additionalHeaders 
    ? `${DEFAULT_ALLOWED_HEADERS}, ${additionalHeaders}` 
    : DEFAULT_ALLOWED_HEADERS;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCorsPreflightRequest(req: Request, additionalHeaders?: string): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, { headers: getCorsHeaders(origin, additionalHeaders) });
  }
  return null;
}

// For backwards compatibility - returns headers with origin validation
export function createCorsHeaders(req: Request, additionalHeaders?: string): Record<string, string> {
  const origin = req.headers.get('origin');
  return getCorsHeaders(origin, additionalHeaders);
}
