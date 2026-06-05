# AI Function Security Quick Reference

## Using the Auth Guard (All New Functions)

```typescript
import { verifyAuth, enforceOrganizationAccess, createAuthErrorResponse } from "../_shared/auth-guard.ts";

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  try {
    const authHeader = req.headers.get('authorization');
    
    // Step 1: Verify authentication
    const authContext = await verifyAuth(
      authHeader,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (!authContext) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }
    
    // Step 2: Parse request
    const { organizationId: requestedOrgId } = await req.json();
    
    // Step 3: Enforce org access
    let authorizedOrgId: string;
    try {
      authorizedOrgId = enforceOrganizationAccess(authContext, requestedOrgId, {
        requireOrganization: true,
        allowSuperAdminOverride: true,
      });
    } catch (error) {
      return createAuthErrorResponse(error as Error, corsHeaders);
    }
    
    // Step 4: Use authorizedOrgId in queries (never use requestedOrgId)
    const { data } = await supabase
      .from('your_table')
      .select('*')
      .eq('organization_id', authorizedOrgId);
    
    // Your business logic here...
    
  } catch (error) {
    return createAuthErrorResponse(error as Error, corsHeaders);
  }
});
```

---

## Sanitizing User Inputs

```typescript
import { sanitizeConversationHistory, sanitizeImageUrls } from "../_shared/sanitization.ts";

// Sanitize conversation history (removes injection patterns, bounds length)
const sanitizedHistory = sanitizeConversationHistory(clientHistory, 80);

// Sanitize image URLs (blocks localhost, private IPs)
const sanitizedUrls = sanitizeImageUrls(clientImageUrls, 5);

// Use sanitized inputs only
const chatMessages = [
  { role: 'system', content: systemPrompt },
  ...sanitizedHistory,
  { role: 'user', content: userMessage }
];
```

---

## AI Error Handling with Retries

```typescript
import { retryAIRequest, generateFallbackResponse, logAIError } from "../_shared/ai-errors.ts";

// Call AI with automatic retries
const { response, error: aiError } = await retryAIRequest(
  () => fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens }),
  }),
  'operation-name',  // For logging
  3,                 // Max retries
  1000               // Base delay ms
);

if (aiError || !response) {
  logAIError('operation-name', aiError || new Error('No response'), {
    organizationId,
    userId,
  });
  
  // Return fallback response
  const fallbackMessage = generateFallbackResponse('chat');
  return new Response(JSON.stringify({ response: fallbackMessage }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Parse successful response
const data = await response.json();
```

---

## Document Validation

```typescript
import { validateFileUpload, sanitizeExtractedText } from "../_shared/sanitization.ts";

// Validate file before processing
const fileValidation = validateFileUpload(document.file_type, document.file_size);
if (!fileValidation.valid) {
  return new Response(
    JSON.stringify({ error: fileValidation.error }),
    { status: 400, headers: corsHeaders }
  );
}

// Extract text from document...
let extractedText = "...";

// Redact PII if org has it enabled
if (orgSettings?.training_pii_redaction) {
  extractedText = sanitizeExtractedText(extractedText, true);
}
```

---

## Resource Ownership Verification

```typescript
import { verifyResourceOwnership } from "../_shared/auth-guard.ts";

// After fetching a resource, verify it belongs to authorized org
const { data: resource } = await supabase
  .from('resources')
  .select('*')
  .eq('id', resourceId)
  .single();

try {
  verifyResourceOwnership(authContext, resource.organization_id, authorizedOrgId);
} catch (error) {
  return createAuthErrorResponse(error as Error, corsHeaders);
}

// Safe to proceed - resource is owned by authorized org
```

---

## Common Patterns

### ✅ DO: Always use enforced org ID
```typescript
const authorizedOrgId = enforceOrganizationAccess(authContext, requestedOrgId);
// Use authorizedOrgId in all queries
```

### ❌ DON'T: Trust client-supplied org ID
```typescript
const { organizationId } = await req.json();
// NEVER use organizationId directly without enforcement
```

---

### ✅ DO: Sanitize conversation history
```typescript
const sanitized = sanitizeConversationHistory(clientHistory);
const messages = [{ role: 'system', content: prompt }, ...sanitized];
```

### ❌ DON'T: Use raw client history
```typescript
const messages = [{ role: 'system', content: prompt }, ...clientHistory]; // UNSAFE
```

---

### ✅ DO: Use retry helper for AI calls
```typescript
const { response, error } = await retryAIRequest(() => fetch(...), 'op-name');
if (error) {
  return generateFallbackResponse('chat');
}
```

### ❌ DON'T: Expose raw AI errors to users
```typescript
const response = await fetch(...);
if (!response.ok) {
  return new Response(await response.text()); // Exposes internals
}
```

---

## Rate Limiting (Persistent)

```typescript
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
const windowStart = new Date();
windowStart.setSeconds(0, 0);

const keys = [
  `operation_user:${userId}`,
  ip ? `operation_ip:${ip}` : null,
].filter(Boolean);

for (const key of keys) {
  const { data } = await supabase.rpc('increment_rate_limit', {
    p_key: key,
    p_window_start: windowStart.toISOString(),
    p_increment: 1,
  });
  
  const count = Array.isArray(data) ? data[0] : data;
  if (count > LIMIT) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Retry-After': '60' },
    });
  }
}
```

---

## Security Checklist for New AI Functions

- [ ] Import and use `verifyAuth()` from `auth-guard.ts`
- [ ] Enforce organization access with `enforceOrganizationAccess()`
- [ ] Sanitize conversation history with `sanitizeConversationHistory()`
- [ ] Validate image URLs with `sanitizeImageUrls()`
- [ ] Verify resource ownership with `verifyResourceOwnership()`
- [ ] Use `retryAIRequest()` for AI gateway calls
- [ ] Return `generateFallbackResponse()` on AI failures
- [ ] Log errors with `logAIError()` for monitoring
- [ ] Implement rate limiting with `increment_rate_limit` RPC
- [ ] Never expose internal error messages to users
- [ ] Always use `authorizedOrgId`, never trust client `organizationId`
- [ ] Add telemetry metadata (orgId, userId) to logs

---

## Testing Your Function

1. **Test without auth:** Should return 401
2. **Test cross-org access:** Should return 403
3. **Test as super admin with override:** Should succeed
4. **Test with prompt injection:** AI should refuse
5. **Test rate limit:** Hit limit, verify 429 response
6. **Test AI gateway error:** Verify fallback response

See `/supabase/functions/_tests/ai-diagnostic.md` for full test suite.

---

## Common Errors & Solutions

**Error:** "User has no organization"  
**Solution:** User's profile missing organization_id, or function requires org but user is not assigned

**Error:** "Forbidden: organization mismatch"  
**Solution:** Non-admin user tried to access different org's data

**Error:** "Forbidden: resource belongs to another organization"  
**Solution:** Resource ownership check failed, user cannot access this resource

**Error:** "Rate limit exceeded"  
**Solution:** User or IP hit rate limit, wait for window to reset (check Retry-After header)

---

## Emergency Procedures

**If auth bypass detected:**
1. Immediately disable affected function via Supabase dashboard
2. Review logs for extent of breach
3. Notify security team
4. Rotate service role keys if compromised

**If prompt injection successful:**
1. Add pattern to `removePromptInjection()` in sanitization.ts
2. Deploy emergency hotfix
3. Review logs for similar attempts
4. Consider additional model-level safety filters

**If PII leakage occurs:**
1. Enable `training_pii_redaction` for affected org
2. Purge leaked data from AI provider logs (if possible)
3. Notify affected users per GDPR/compliance requirements
4. Review and strengthen PII detection patterns

---

**Last Updated:** January 9, 2026  
**Maintainer:** Engineering Team  
**Questions?** See `AI_SECURITY_AUDIT_SUMMARY.md` or ask in #security channel
