# Burst Messaging - Quick Implementation Reference

**Status:** Ready to implement  
**Effort:** Medium (4-6 hours)  
**Risk:** Low (backward compatible, can be toggled off)

---

## What You Need to Implement

### 1. Three Core Functions (Already Created)

**File:** `supabase/functions/_shared/burst-messaging.ts`

These are pre-built and ready to use:

```typescript
parseBurstResponse(response, enableBurst)
  ↓ Takes AI response (string or JSON)
  ↓ Returns: MessageBurst { messages[], confidence, reflectionNeeded }

calculateTypingDelay(messageLength, config, addJitter)
  ↓ Calculates natural typing delay
  ↓ Returns: number (milliseconds)

validateBurstLength(burst, config)
  ↓ Checks max 3 messages, validates each
  ↓ Returns: { valid, messages, warnings }

shouldSelfCorrect(response, confidence, config)
  ↓ Checks if response needs follow-up
  ↓ Returns: boolean

cleanMessageForDelivery(message)
  ↓ Removes [BURST] markers
  ↓ Returns: clean message string
```

### 2. One New Function to Create

**Location:** `supabase/functions/social-webhook/index.ts`

Create `sendBurstMessages()`:

```typescript
async function sendBurstMessages(
  burst: MessageBurst,
  platform: string,
  senderId: string,
  accessToken: string,
  pageId: string,
  config: BurstConfig
): Promise<{ success: boolean; messagesSent: number; errors: string[] }> {
  const errors: string[] = [];
  let messagesSent = 0;

  // 1. Validate burst
  const validation = validateBurstLength(burst, config);
  if (!validation.valid) {
    errors.push(...validation.warnings);
  }

  // 2. For each message
  for (const message of validation.messages) {
    try {
      // 2a. Clean meta tags
      const cleanMsg = cleanMessageForDelivery(message);

      // 2b. Calculate delay
      const delay = calculateTypingDelay(cleanMsg.length, config);
      console.log(`Burst: waiting ${delay}ms...`);

      // 2c. Wait (async)
      await delayMs(delay);

      // 2d. Send via Meta API
      const msgId = await sendPlatformResponse(
        platform,
        senderId,
        cleanMsg,
        accessToken,
        pageId
      );

      if (msgId) {
        messagesSent++;
      } else {
        errors.push(`Send failed: "${cleanMsg.slice(0, 30)}..."`);
      }
    } catch (err) {
      errors.push(`Exception: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return { success: errors.length === 0, messagesSent, errors };
}
```

### 3. Update the processMessage() Flow

**Location:** Same file, in `processMessage()` function

Replace this section:
```typescript
// OLD CODE (around line 4840)
const aiResponse = await generateAIResponse(...);
const typingDelay = Math.min((aiResponse.length / CHARS_PER_SECOND) * 1000, 5000);
await new Promise(resolve => setTimeout(resolve, totalDelay));
const sentMessageId = await sendPlatformResponse(platform, senderId, aiResponse, accessToken, pageId);
```

With this:
```typescript
// NEW CODE
const aiResponseRaw = await generateAIResponse(...);

// Parse burst format (backward compatible)
const burst = parseBurstResponse(aiResponseRaw, true);

// Send burst messages with natural delays
const result = await sendBurstMessages(
  burst,
  platform,
  senderId,
  accessToken,
  pageId,
  DEFAULT_BURST_CONFIG
);

if (!result.success) {
  console.error('Burst errors:', result.errors);
}

// Optional: Check for self-correction
if (shouldSelfCorrect(aiResponseRaw, burst.confidence, DEFAULT_BURST_CONFIG)) {
  const reflection = buildReflectionMessage(aiResponseRaw, ['low_confidence']);
  if (result.messagesSent < 3) { // Enforce max 3 total
    await sendBurstMessages({
      messages: [reflection],
      confidence: 0.7,
      reflectionNeeded: false
    }, platform, senderId, accessToken, pageId, DEFAULT_BURST_CONFIG);
  }
}

// Store message as before...
const sentMessageId = result.messagesSent > 0 ? 'sent' : null;
```

### 4. Add Burst Instruction to System Prompt

**Location:** `generateAIResponse()` function

Find where `systemPrompt` is built (around line 3700):

```typescript
// CURRENT
const systemPrompt = `${agentPrompts[agentType]}\n\n${dateContext}...`;

// ADD THIS
const burstInstruction = createBurstPromptInstruction();
const systemPrompt = `${agentPrompts[agentType]}\n\n${burstInstruction}\n\n${dateContext}...`;
```

### 5. Import Burst Module

**Location:** Top of `social-webhook/index.ts`

Add after line 45 (after other imports):

```typescript
import {
  parseBurstResponse,
  calculateTypingDelay,
  validateBurstLength,
  cleanMessageForDelivery,
  delayMs,
  createBurstPromptInstruction,
  shouldSelfCorrect,
  buildReflectionMessage,
  DEFAULT_BURST_CONFIG,
  type MessageBurst,
  type BurstConfig,
} from '../_shared/burst-messaging.ts';
```

---

## Implementation Checklist

### Phase 1: Setup (30 minutes)
- [ ] Copy `burst-messaging.ts` to `supabase/functions/_shared/`
- [ ] Add import statement to `social-webhook/index.ts`
- [ ] Verify no TypeScript errors

### Phase 2: Core Implementation (2 hours)
- [ ] Create `sendBurstMessages()` function in social-webhook
- [ ] Update `processMessage()` to use burst handler
- [ ] Add burst instruction to system prompt
- [ ] Test single message (backward compatible)

### Phase 3: Testing (1-2 hours)
- [ ] Test 2-message burst on Messenger
- [ ] Test 3-message burst on WhatsApp
- [ ] Test self-correction trigger
- [ ] Verify delays are working (~2-5 seconds total)
- [ ] Check logs for any errors

### Phase 4: Monitoring (Ongoing)
- [ ] Track burst success rate
- [ ] Monitor average messages per burst
- [ ] Watch for platform API errors
- [ ] Review logs for self-correction frequency

---

## Expected Behavior After Implementation

### Single Message (Backward Compatible)
```
User: "Hi"
AI: "Hello! How can I help?"
→ Single message sent immediately (as before)
```

### Burst Messaging
```
User: "I want to book"
AI: (returns JSON burst with 3 messages)
  ├─ Message 1: "Great! I'd love to help with your booking."
  │  └─ Delay: 1.2 seconds
  ├─ Message 2: "When are you planning to visit?"
  │  └─ Delay: 1.5 seconds
  └─ Message 3: "How many guests will be staying?"
      └─ Delay: 1.3 seconds

→ User sees messages arriving naturally over ~4 seconds
```

### Self-Correction
```
User: "Is the Avida available Jan 15-17?"
AI: (low confidence = 0.55)
  ├─ Message 1: "I think it might be available..."
  │  └─ Delay: 1.2 seconds
  ├─ Message 2: "Actually, let me verify with our system..."
  │  └─ Delay: 1.0 seconds
  └─ Message 3: "Yes, it's available! Total: ₱15,000 for 2 nights."
      └─ Delay: 1.3 seconds
```

---

## Key Implementation Details

### Timing (NO BLOCKING)
- Delays occur in background AFTER 200 OK returned to Meta
- Webhook responds in ~5 seconds as required
- Message sending happens asynchronously

### Safety Limits
- Max 3 messages total per response
- Max 1 self-correction round
- Each message max 1000 characters
- Minimum 500ms delay, maximum 5 seconds

### Backward Compatible
- Single string responses work unchanged
- Automatic fallback if burst parsing fails
- Can toggle feature off with one flag

### AI Prompt
- AI taught via system prompt instruction
- Two format options: JSON or [BURST] delimiters
- Clear guidelines on when to use bursts

---

## Configuration

Default values (in `burst-messaging.ts`):

```typescript
const DEFAULT_BURST_CONFIG = {
  enabled: true,
  maxBurstMessages: 3,
  minDelayBetweenMessages: 1000,
  maxDelayBetweenMessages: 3000,
  charsPerSecond: 30,
  allowSelfCorrection: true,
  selfCorrectionThreshold: 0.6,
};
```

Customize by passing different config to functions.

---

## Common Questions

**Q: How long does implementation take?**
A: 4-6 hours including testing. 2 hours for core code.

**Q: Will this slow down responses?**
A: No. Messages still sent quickly, just sequentially with ~1-3 sec delays between them.

**Q: What if burst parsing fails?**
A: Falls back to single message. Error logged but handled gracefully.

**Q: Can I test this before full rollout?**
A: Yes. Deploy with one platform first (Messenger), then roll out to WhatsApp/Instagram.

**Q: How do I disable this?**
A: Set `enableBurst: false` in `parseBurstResponse()` call. Immediate fallback to single messages.

---

## Files to Modify

| File | Changes | Lines |
|------|---------|-------|
| `supabase/functions/_shared/burst-messaging.ts` | CREATE NEW | 445 |
| `supabase/functions/social-webhook/index.ts` | ADD IMPORT | +15 |
| `supabase/functions/social-webhook/index.ts` | ADD FUNCTION | +50 |
| `supabase/functions/social-webhook/index.ts` | UPDATE processMessage() | +30 |
| `supabase/functions/social-webhook/index.ts` | UPDATE generateAIResponse() | +5 |
| **TOTAL** | | **~545 lines** |

---

## Success Metrics

After implementation, you should see:

1. **Increased conversation naturalness**
   - Users report AI feels more human-like
   - Multi-message responses feel intentional, not rushed

2. **Improved message clarity**
   - Shorter messages easier to read on mobile
   - Questions asked sequentially for better UX

3. **Better self-correction**
   - AI catches mistakes and clarifies
   - Users see "thinking process"

4. **Platform compatibility**
   - Works on Messenger, WhatsApp, Instagram
   - No API failures or timeouts

---

## Next Steps

1. Review `BURST_MESSAGING_ARCHITECTURE.md` for detailed architecture
2. Review `burst-messaging.ts` to understand helper functions
3. Implement `sendBurstMessages()` function
4. Update `processMessage()` flow
5. Test on Messenger first
6. Deploy to production
7. Monitor metrics

---

**Last Updated:** January 17, 2026  
**Architect:** Senior AI Architecture Team

