export function isAuthorizedInternalRequest(req: Request): boolean {
  const configuredSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') || Deno.env.get('CRON_SECRET');

  if (!configuredSecret) {
    console.warn('[Internal Auth] INTERNAL_FUNCTION_SECRET not configured; allowing request for backward compatibility');
    return true;
  }

  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const internalSecret = req.headers.get('x-internal-function-secret');
  const schedulerSecret = req.headers.get('x-scheduler-secret');

  return bearerToken === configuredSecret || internalSecret === configuredSecret || schedulerSecret === configuredSecret;
}

export function createInternalAuthErrorResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}