# Google Gemini Integration - Technical Reference

## API Specification

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GOOGLE_API_KEY}
```

### Models Supported
- `gemini-2.5-flash` - Default (used for all functions)
- `gemini-2.0-flash` - Older version
- `gemini-pro` - Slower, not recommended for real-time

### Authentication
```typescript
// In environment
GOOGLE_API_KEY=your_google_api_key_here

// In code
const apiKey = Deno.env.get('GOOGLE_API_KEY')!;
```

---

## Request Format

### OpenAI Format (OLD - what we're converting FROM)
```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello"}
  ],
  "max_tokens": 500,
  "temperature": 0.7
}
```

### Gemini Format (NEW - what we're converting TO)
```json
{
  "system_instruction": {
    "parts": [{"text": "You are helpful"}]
  },
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "Hello"}]
    }
  ],
  "generationConfig": {
    "maxOutputTokens": 500,
    "temperature": 0.7
  }
}
```

### Conversion Function
```typescript
function convertToGeminiFormat(messages: any[], systemPrompt?: string) {
  // Separates system message from conversation messages
  // Converts to Gemini's nested structure
  // Returns properly formatted Gemini request
}
```

---

## Response Format

### Gemini Response
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Your response text here"
          }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": []
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 25,
    "candidatesTokenCount": 100,
    "totalTokenCount": 125
  }
}
```

### Extraction Function
```typescript
function extractGeminiResponse(data: any) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}
```

### Usage Metadata
```typescript
interface GeminiCallMetrics {
  inputTokens: number;        // promptTokenCount
  outputTokens: number;       // candidatesTokenCount
  totalTokens: number;        // totalTokenCount
  estimatedCost: number;      // Calculated: (input*0.075 + output*0.30) / 1000000
  latencyMs: number;          // Time from start to response
  success: boolean;           // true if no errors
  attempts: number;           // How many retries taken
  error?: string;             // Error message if failed
}
```

---

## Cost Calculation

### Per-Token Pricing
```
Input tokens:  $0.075 per 1 million tokens
Output tokens: $0.30  per 1 million tokens
```

### Formula
```typescript
const estimatedCost = 
  (inputTokens * 0.075 / 1000000) + 
  (outputTokens * 0.30 / 1000000);
```

### Examples
```
1. Short response (100 input, 50 output)
   Cost = (100 × 0.075 / 1M) + (50 × 0.30 / 1M) = $0.000015

2. Medium response (200 input, 200 output)
   Cost = (200 × 0.075 / 1M) + (200 × 0.30 / 1M) = $0.000075

3. Long response (500 input, 1000 output)
   Cost = (500 × 0.075 / 1M) + (1000 × 0.30 / 1M) = $0.000338

4. Bulk processing (10k calls, avg 150 in, 100 out)
   Daily cost = 10k × $0.000045 = $0.45
   Monthly cost = $0.45 × 30 = $13.50
```

---

## Helper Function API

### `callGeminiAPI()`

**Signature**
```typescript
async function callGeminiAPI(
  apiKey: string,
  request: any,
  model: string,
  options?: GeminiCallOptions
): Promise<{ content: string; metrics: GeminiCallMetrics }> {}
```

**Parameters**
```typescript
// apiKey: Your GOOGLE_API_KEY environment variable
// request: Gemini-formatted request object
// model: Usually 'gemini-2.5-flash'
// options: Configuration for retries, timeout, metrics, fallback
```

**Usage Example**
```typescript
const response = await callGeminiAPI(
  GOOGLE_API_KEY,
  {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
  },
  'gemini-2.5-flash',
  {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeout: 30000,
    trackMetrics: true,
    fallbackResponse: "Sorry, couldn't process that."
  }
);

console.log(response.content);           // The AI response text
console.log(response.metrics.inputTokens); // Token usage
console.log(response.metrics.estimatedCost); // Cost in dollars
```

---

### `convertToGeminiFormat()`

**Signature**
```typescript
function convertToGeminiFormat(
  messages: Array<{role: string, content: any}>,
  systemPrompt?: string
): any {}
```

**Behavior**
- Converts OpenAI-style messages to Gemini format
- Moves system message to `system_instruction`
- Wraps user/assistant messages in proper structure
- Handles different content types (text, images, etc.)

**Example**
```typescript
const messages = [
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "What is 2+2?" }
];

const geminiRequest = convertToGeminiFormat(messages);
// Result:
// {
//   system_instruction: { parts: [{ text: "You are helpful..." }] },
//   contents: [
//     { role: "user", parts: [{ text: "What is 2+2?" }] }
//   ]
// }
```

---

### `extractGeminiResponse()`

**Signature**
```typescript
function extractGeminiResponse(data: any): string | null {}
```

**Behavior**
- Safely navigates nested Gemini response structure
- Returns null if response missing or invalid
- Prevents crashes from unexpected formats

**Example**
```typescript
const rawResponse = await fetch(...).then(r => r.json());
const content = extractGeminiResponse(rawResponse);
// Content: "4" (or null if extraction failed)
```

---

### `logGeminiMetrics()`

**Signature**
```typescript
function logGeminiMetrics(
  functionName: string,
  metrics: GeminiCallMetrics
): void {}
```

**Output**
```
[Gemini Metrics] ai-chat: tokens_in=145, tokens_out=89, cost=$0.00034, latency=450ms, success=true, attempts=1
```

**Loggable Fields**
- `tokens_in`: Input token count
- `tokens_out`: Output token count
- `cost`: Estimated cost in dollars
- `latency`: Response time in milliseconds
- `success`: Boolean success/failure
- `attempts`: Number of retry attempts

---

### `estimateGeminiCost()`

**Signature**
```typescript
function estimateGeminiCost(
  inputTokens: number,
  outputTokens: number
): number {}
```

**Returns**
```
Dollar amount as decimal (e.g., 0.000045 = $0.000045)
```

**Formula**
```
cost = (inputTokens * 0.075 / 1000000) + (outputTokens * 0.30 / 1000000)
```

---

## Error Handling Patterns

### Standard Try-Catch Pattern
```typescript
try {
  const geminiRequest = convertToGeminiFormat(messages);
  const callOptions: GeminiCallOptions = {
    maxRetries: 2,
    retryDelayMs: 500,
    timeout: 20000,
    trackMetrics: true,
    fallbackResponse: "I apologize, I couldn't process that right now."
  };

  const response = await callGeminiAPI(
    GOOGLE_API_KEY,
    {
      ...geminiRequest,
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    },
    'gemini-2.5-flash',
    callOptions
  );

  if (!response?.content) {
    console.error("Empty response from Gemini API");
    return fallbackResponse;
  }

  return response.content;
} catch (error) {
  console.error('Error calling Gemini API:', error);
  logAIError('function-name', error, { contextData });
  return fallbackResponse;
}
```

### Error Types

**Network Errors** (retried automatically)
- `ERR_NETWORK_UNREACHABLE`
- `ERR_CONNECTION_TIMEOUT`
- `ERR_DNS_LOOKUP_FAILED`

**API Errors** (most retried)
- `429` - Rate limit (retried with exponential backoff)
- `500-599` - Server errors (retried)
- `400` - Bad request (NOT retried)

**Timeout Errors** (aborted requests)
- `AbortError` when request exceeds timeout
- Fallback response returned

---

## Configuration Per Function

### `generate-summary`
```typescript
const callOptions: GeminiCallOptions = {
  maxRetries: 2,
  retryDelayMs: 500,
  timeout: 20000,
  trackMetrics: true,
  fallbackResponse: "Unable to summarize conversation."
};
```

### `reengage-lead`
```typescript
const callOptions: GeminiCallOptions = {
  maxRetries: 3,
  retryDelayMs: 500,
  timeout: 30000,
  trackMetrics: true,
  fallbackResponse: "I'd love to reconnect - how can I help?"
};
```

### `demo-ai-chat`
```typescript
const callOptions: GeminiCallOptions = {
  maxRetries: 2,
  retryDelayMs: 500,
  timeout: 15000,
  trackMetrics: true,
  fallbackResponse: "I'm sorry, I couldn't process that."
};
```

### `ai-chat` (Main chat function)
```typescript
const callOptions: GeminiCallOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeout: 30000,
  trackMetrics: true,
  fallbackResponse: "I'm having trouble understanding. Can you rephrase?"
};
```

### `social-webhook` (High volume)
```typescript
const callOptions: GeminiCallOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeout: 15000,
  trackMetrics: true,
  fallbackResponse: "I'm sorry, I couldn't process that request."
};
```

---

## Temperature Settings by Agent

### Agent Personalities
```typescript
const agentTemperatures: Record<string, number> = {
  jay: 0.7,    // Energetic, creative, some variation
  cece: 0.5,   // Balanced, moderate creativity
  may: 0.3     // Conservative, consistent responses
};
```

### Applied Across Functions
- `ai-chat`: Uses agent-specific temperature
- `reengage-lead`: Uses agent-specific temperature
- `demo-ai-chat`: Fixed 0.5
- `process-document`: Fixed 0.3
- `social-webhook`: Uses agent-specific temperature

### Behavior
```
Temperature 0.3 = Deterministic, consistent (good for evaluations)
Temperature 0.5 = Balanced (good for most use cases)
Temperature 0.7 = Creative, variable (good for engaging interactions)
```

---

## Token Limits by Function

| Function | Max Tokens | Purpose |
|----------|-----------|---------|
| generate-summary | 800 | Detailed summary of conversation |
| reengage-lead | 300 | Short re-engagement message |
| demo-ai-chat | 500 | Demo response |
| ai-chat | 1000+ | Full conversation response |
| process-document | 2000 | Full document summary (capped) |
| social-webhook | 500 | Facebook message response |
| process-pending-messages | 800 | Lead response message |
| evaluate-training-session | 1500 | Detailed evaluation |

---

## Monitoring & Debugging

### Enable Debug Logging
```typescript
// In function
console.log(`[DEBUG] Request:`, JSON.stringify(geminiRequest, null, 2));
console.log(`[DEBUG] Response:`, JSON.stringify(response, null, 2));
```

### View Function Logs
```bash
supabase functions logs ai-chat --tail
```

### Search Logs
```bash
# Find all Gemini metrics
supabase functions logs ai-chat | grep "Gemini Metrics"

# Find errors
supabase functions logs ai-chat | grep "error\|Error\|ERROR"

# Find specific call
supabase functions logs ai-chat | grep "1234-5678-uuid"
```

### Performance Metrics
```bash
# Extract latency over time
supabase functions logs ai-chat | grep "latency" | awk '{print $NF}'

# Count successful vs failed calls
supabase functions logs ai-chat | grep "success=true" | wc -l
supabase functions logs ai-chat | grep "success=false" | wc -l
```

---

## Common Issues & Solutions

### Issue: "GOOGLE_API_KEY not found"
```
Cause: Environment variable not set in Supabase
Solution: 
  supabase secrets set GOOGLE_API_KEY=your_key
  supabase functions deploy
```

### Issue: "API returned 429 (rate limit)"
```
Cause: Exceeding Google Cloud quota
Solution:
  1. Wait for backoff (automatic retry happens)
  2. Check Google Cloud console quotas
  3. Request quota increase
  4. Adjust max retries if needed
```

### Issue: "Request timeout after 30s"
```
Cause: API taking too long
Solution:
  1. Check Google Cloud API status
  2. Increase timeout in callOptions
  3. Optimize request (fewer tokens)
  4. Split into smaller requests
```

### Issue: "Empty response from API"
```
Cause: API returned success but no content
Solution:
  1. Check fallback response triggering
  2. Verify request format
  3. Check model availability
  4. Try again (might be transient)
```

---

## Migration Checklist

- [ ] GOOGLE_API_KEY obtained from Google Cloud
- [ ] GOOGLE_API_KEY set in Supabase secrets
- [ ] All 8 functions deployed
- [ ] Build passes without errors
- [ ] Smoke tests completed
- [ ] Monitoring enabled
- [ ] Logs being collected
- [ ] Team notified
- [ ] Rollback plan documented
- [ ] 24-hour monitoring completed
- [ ] Success metrics validated

---

## Quick Reference Commands

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy ai-chat

# View function logs (streaming)
supabase functions logs ai-chat --tail

# View function logs (last 100 lines)
supabase functions logs ai-chat | head -100

# Set Google API key
supabase secrets set GOOGLE_API_KEY=your_key_here

# List all secrets
supabase secrets list

# Check function status
supabase functions list

# Delete a function
supabase functions delete ai-chat

# Create a function
supabase functions new my-function
```

---

## Additional Resources

- **Google Gemini API**: https://ai.google.dev/gemini-api
- **Pricing Calculator**: https://ai.google.dev/pricing
- **Model Docs**: https://ai.google.dev/models
- **Supabase Functions**: https://supabase.com/docs/guides/functions
- **Deno Runtime**: https://deno.com/runtime

---

**This technical reference provides everything needed to understand, deploy, monitor, and troubleshoot the Google Gemini integration.**
