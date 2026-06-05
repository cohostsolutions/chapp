# Edge Function Request Logging

## Overview

All edge functions now include comprehensive request logging to track API usage patterns, monitor performance, and detect potential abuse.

## Features

- **Request Tracking**: Logs every edge function request with metadata
- **Performance Monitoring**: Records response times for each request
- **Abuse Detection**: Real-time view of request patterns per IP address
- **Error Tracking**: Captures error messages and failed requests
- **User Attribution**: Links requests to user IDs and organization IDs when available

## Database Schema

### `edge_function_logs` Table

Stores detailed information about each edge function request:

- `id`: Unique identifier (UUID)
- `function_name`: Name of the edge function (e.g., 'ai-chat', 'social-webhook')
- `method`: HTTP method (GET, POST, etc.)
- `path`: Request path
- `user_id`: Authenticated user making the request (nullable)
- `organization_id`: Organization context (nullable)
- `ip_address`: Client IP address
- `user_agent`: Browser/client user agent string
- `request_body_size`: Size of request body in bytes
- `response_status`: HTTP response status code
- `response_time_ms`: Request processing time in milliseconds
- `error_message`: Error details if request failed
- `metadata`: Additional context as JSONB
- `created_at`: Timestamp of the request

### `edge_function_abuse_metrics` View

Real-time aggregated view for abuse detection:

```sql
SELECT * FROM edge_function_abuse_metrics;
```

Shows:
- Requests per IP address in the last hour
- Error counts
- Average response times
- Most recent request timestamp

Only displays IPs with more than 10 requests in the last hour.

## Usage in Edge Functions

### Basic Logging

```typescript
import { createLogger } from "../_shared/logger.ts";

serve(async (req) => {
  const logger = createLogger(req, 'my-function');
  const startTime = Date.now();
  
  try {
    // Your function logic here
    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Log successful request
    await logger.logRequest({ 
      responseStatus: 200, 
      responseTimeMs: Date.now() - startTime 
    });
    
    return response;
  } catch (error) {
    // Log failed request
    await logger.logRequest({ 
      responseStatus: 500, 
      errorMessage: error.message,
      responseTimeMs: Date.now() - startTime 
    });
    
    throw error;
  }
});
```

### Using Middleware Wrapper

For automatic logging:

```typescript
import { withLogging } from "../_shared/logger.ts";

const handler = withLogging('my-function', async (req, logger) => {
  // Your function logic here
  // Logging is handled automatically
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

serve(handler);
```

### Abuse Detection

Check for potential abuse before processing requests:

```typescript
import { EdgeFunctionLogger } from "../_shared/logger.ts";

const supabase = createClient(/* ... */);
const isAbuse = await EdgeFunctionLogger.checkAbusePattern(
  supabase,
  ipAddress,
  'my-function',
  100 // threshold: 100 requests in 5 minutes
);

if (isAbuse) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Monitoring & Queries

### View Recent Requests

```sql
SELECT 
  function_name,
  method,
  response_status,
  response_time_ms,
  ip_address,
  created_at
FROM edge_function_logs
ORDER BY created_at DESC
LIMIT 100;
```

### Find Slow Requests

```sql
SELECT 
  function_name,
  AVG(response_time_ms) as avg_ms,
  MAX(response_time_ms) as max_ms,
  COUNT(*) as request_count
FROM edge_function_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY function_name
ORDER BY avg_ms DESC;
```

### Identify Error Patterns

```sql
SELECT 
  function_name,
  response_status,
  error_message,
  COUNT(*) as error_count
FROM edge_function_logs
WHERE response_status >= 400
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY function_name, response_status, error_message
ORDER BY error_count DESC;
```

### Check for Abuse

```sql
SELECT * FROM edge_function_abuse_metrics
WHERE request_count > 100
ORDER BY request_count DESC;
```

## Functions with Logging Enabled

- ✅ `ai-chat` - AI conversation endpoint
- ✅ `social-webhook` - Facebook/WhatsApp/Instagram webhook handler
- ✅ `book-demo` - Demo booking endpoint
- ✅ `facebook-connect` - Facebook OAuth and page management
- ✅ `manage-user` - User management operations
- ⏳ Other functions can be added as needed

## Security & Privacy

- **RLS Policies**: Only super admins can query logs via SQL
- **Service Role**: Only service role can insert logs
- **Automatic Cleanup**: Consider adding a cleanup job to remove logs older than 30 days
- **PII Handling**: Request bodies are not logged by default; only their size

## Performance Impact

- Logging is non-blocking and won't fail the request if logging fails
- Minimal overhead (< 50ms per request)
- Async operations don't block response to client
- Logs are written after response is sent when possible

## Future Enhancements

- [ ] Automatic log archival/cleanup after 30 days
- [ ] Alerting for abnormal patterns
- [ ] Dashboard for real-time monitoring
- [ ] Request/response body sampling for debugging
- [ ] Integration with external monitoring tools (Datadog, New Relic, etc.)
