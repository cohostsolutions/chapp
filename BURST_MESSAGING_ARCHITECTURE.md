# Burst Messaging System - Architecture & Implementation Guide

**Status:** 🚀 Ready for Implementation  
**Version:** 1.0  
**Last Updated:** January 17, 2026  
**Lead Architect:** Senior AI Architecture Team

---

## Table of Contents
1. [Overview](#overview)
2. [Three Core Logic Changes](#three-core-logic-changes)
3. [Architecture Design](#architecture-design)
4. [Implementation Details](#implementation-details)
5. [Safety Guardrails](#safety-guardrails)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Checklist](#deployment-checklist)

---

## Overview

### What is Burst Messaging?

Burst Messaging transforms your AI from a **Ping-Pong model** (1 input → 1 output) into a **Burst model** (1 input → multiple sequential messages with human-like delays).

**Current (Ping-Pong):**
```
User: "Hi, I want to book a room"
AI: "Great! I'd be happy to help. Let me check availability. When are you planning to visit? How many guests?"
```

**New (Burst):**
```
User: "Hi, I want to book a room"
AI sends 3 messages sequentially:
  1. "Hi! 👋 I'd love to help you with a booking."
  2. [1.5 sec pause for typing]
  3. "When are you planning to visit?"
  4. [1 sec pause]
  5. "And how many guests will be staying?"
```

---

## Three Core Logic Changes

### 1. Message Burst Capability

**Current State:** AI returns single string response
```typescript
const aiResponse: string = "I can help you book...";
```

**New State:** AI returns MessageBurst object with multiple messages
```typescript
interface MessageBurst {
  messages: string[]; // ["Message 1", "Message 2", "Message 3"]
  reflectionNeeded: boolean; // Does AI want to add a follow-up?
  confidence: number; // 0-1, used for self-correction
  reasoning?: string; // Why multiple messages?
}
```

**Implementation:**
1. AI can return JSON response with burst structure
2. Alternatively, use `[BURST]` delimiters in plain text
3. Backward compatible - single strings work as before

**File:** [`burst-messaging.ts`](supabase/functions/_shared/burst-messaging.ts)
- `parseBurstResponse()` - Extract burst format from AI response
- `validateBurstLength()` - Enforce max 3 messages safety limit

### 2. Human Jitter (Debouncing & Delays)

**Current State:** 
- Static 3-8 second delay before sending
- Single message sent instantly

**New State:**
- Per-message delay calculated from message length
- Variable jitter to feel natural (±10% randomness)
- **Runs asynchronously in background** - doesn't block webhook response

**Delay Formula:**
```
baseDelay = 1-3 seconds (thinking time)
charDelay = (messageLength / 30 chars/sec) * 0.5
totalDelay = min(baseDelay + charDelay, 3000ms)
jitter = random(±10%)
```

**Implementation Details:**

```typescript
// In processMessage() - NEW BURST HANDLER
for (const message of burst.messages) {
  const delay = calculateTypingDelay(message.length, config);
  await delayMs(delay); // Async, non-blocking
  await sendPlatformResponse(platform, senderId, message, accessToken, pageId);
}
```

**Key Point:** The delay happens **AFTER** webhook returns OK to Meta, in the background worker context. This means:
- ✅ Meta gets 200 response within 5 seconds
- ✅ Messages send with natural delays in background
- ✅ No timeout issues

**File:** [`burst-messaging.ts`](supabase/functions/_shared/burst-messaging.ts)
- `calculateTypingDelay()` - Per-message delay calculation
- `delayMs()` - Async sleep function

### 3. Self-Correction & Silence Breaking

**Current State:** AI sends one response and waits for user reply

**New State:** AI can detect low confidence and trigger follow-up immediately

**When Self-Correction Triggers:**
1. Confidence score < 0.6
2. Message contains `[CORRECTION]` marker
3. Uncertainty phrases detected + low confidence

**Example Flow:**
```
AI detects: "I said something uncertain, better clarify"
Confidence: 0.55 (below 0.6 threshold)

Response 1: "I think the room is available..."
[Self-correction triggers]
Response 2: "Actually, let me confirm - the best way is to check with our team for exact availability."
```

**Safety Guardrail:** Max 3 consecutive messages total
```typescript
const validated = validateBurstLength(burst, {
  maxBurstMessages: 3, // Hard limit
  ...config
});

if (burst.messages.length > 3) {
  burst.messages = burst.messages.slice(0, 3);
  console.log("Truncated burst to 3 messages");
}
```

**File:** [`burst-messaging.ts`](supabase/functions/_shared/burst-messaging.ts)
- `shouldSelfCorrect()` - Determine if correction needed
- `buildReflectionMessage()` - Generate appropriate follow-up

---

## Architecture Design

### High-Level Message Flow

```
┌─────────────────────────────────────────────────────────┐
│ User sends message via Facebook/WhatsApp/Messenger       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌─────────────────────────┐
         │ social-webhook handler  │
         │ (receive + validate)    │
         └────────────┬────────────┘
                      │
                      ▼
          ┌──────────────────────────┐
          │ processMessage() async   │
          │ (background worker)      │
          └────────────┬─────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │ generateAIResponse()        │
         │ (call Lovable AI)           │
         │ + generate burst prompt     │
         └────────────┬────────────────┘
                      │
                      ▼
        ┌──────────────────────────────┐
        │ parseBurstResponse()          │
        │ Extract MessageBurst format  │
        │ ["msg1", "msg2", "msg3"]    │
        └────────────┬─────────────────┘
                     │
                     ▼
       ┌──────────────────────────────┐
       │ validateBurstLength()         │
       │ Check: max 3 messages         │
       │ Check: all messages valid     │
       └────────────┬──────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │ FOR EACH MESSAGE IN BURST    │
         │ ┌──────────────────────────┐ │
         │ │ calculateTypingDelay()   │ │
         │ │ Based on message length  │ │
         │ │ 1-3 seconds per message  │ │
         │ └────────────┬─────────────┘ │
         │              ▼               │
         │  ┌────────────────────────┐  │
         │  │ delayMs(delay)         │  │
         │  │ Async - non-blocking   │  │
         │  └────────────┬───────────┘  │
         │               ▼              │
         │  ┌────────────────────────┐  │
         │  │ sendPlatformResponse() │  │
         │  │ Send via Meta API      │  │
         │  │ Save to DB             │  │
         │  └────────────┬───────────┘  │
         │               │              │
         │ [Repeat for next message]    │
         └──────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────┐
        │ Check shouldSelfCorrect()    │
        │ If true: append reflection   │
        │ If max messages hit: stop    │
        └──────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ All complete │
              │ Return 200 OK│
              └──────────────┘
```

### Timing Diagram

```
Time ──────────────────────────────────────────────────────────►

0ms    ├─ Meta webhook arrives
       │  └─ Get 200 OK response within 5 seconds
       │
5ms    ├─ processMessage() starts (background)
       │
50ms   ├─ generateAIResponse() calls Lovable AI
       │
2500ms ├─ AI returns response (typical: 1-2 seconds)
       │  └─ parseBurstResponse() → ["Hello", "How can I help?"]
       │
2550ms ├─ Message 1: "Hello"
       │  └─ calculateTypingDelay("Hello", 5 chars) = 1200ms
       │
2560ms ├─ HTTP 200 OK returned to Meta ✅
       │
3750ms ├─ Delay complete, send Message 1 via Graph API
       │
3850ms ├─ Message 2: "How can I help?"
       │  └─ calculateTypingDelay("How can I help?", 15 chars) = 1500ms
       │
5350ms ├─ Delay complete, send Message 2 via Graph API
       │
5400ms ├─ Self-correction check: confidence=0.8 (no correction needed)
       │
5410ms └─ Background task complete

User Timeline:
└─ Sees "Hello" at ~3.75 seconds ✅
└─ Sees "How can I help?" at ~5.35 seconds ✅
└─ Feels natural, like human typing
```

---

## Implementation Details

### File Structure

```
supabase/functions/
├── _shared/
│   └── burst-messaging.ts ← NEW (445 lines)
│       ├── parseBurstResponse()
│       ├── calculateTypingDelay()
│       ├── validateBurstLength()
│       ├── shouldSelfCorrect()
│       └── buildReflectionMessage()
│
├── social-webhook/
│   └── index.ts ← MODIFIED
│       ├── Import burst-messaging.ts
│       ├── Add burst prompt to system message
│       ├── Create sendBurstMessages() handler
│       └── Update processMessage() flow
```

### Code Snippets

#### 1. Add Burst Capability to System Prompt

```typescript
// In generateAIResponse() - Add this to system prompt
const burstInstruction = createBurstPromptInstruction();
const systemPrompt = `${agentPrompts[agentType]}\n\n${burstInstruction}\n\n...`;
```

**The burst instruction teaches the AI:**
- JSON format for burst responses
- When to use multiple messages
- Confidence scoring
- Self-correction markers

#### 2. New Handler: sendBurstMessages()

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

  // Validate burst before sending
  const validation = validateBurstLength(burst, config);
  if (!validation.valid) {
    errors.push(...validation.warnings);
  }

  for (const message of validation.messages) {
    try {
      // Clean message for delivery (remove meta tags)
      const cleanMessage = cleanMessageForDelivery(message);

      // Calculate typing delay
      const delay = calculateTypingDelay(cleanMessage.length, config);
      console.log(`Message burst: waiting ${delay}ms before sending...`);

      // Wait (async, non-blocking)
      await delayMs(delay);

      // Send message
      const messageId = await sendPlatformResponse(
        platform,
        senderId,
        cleanMessage,
        accessToken,
        pageId
      );

      if (!messageId) {
        errors.push(`Failed to send message: "${cleanMessage.slice(0, 50)}..."`);
      } else {
        messagesSent++;
      }
    } catch (err) {
      errors.push(`Error sending burst message: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return { success: errors.length === 0, messagesSent, errors };
}
```

#### 3. Update processMessage() to Use Bursts

```typescript
async function processMessage(messageData: {...}, platform: string) {
  // ...existing setup code...

  // Get AI response (now may return burst format)
  const aiResponseRaw = await generateAIResponse(
    agentType,
    combinedMessage,
    history,
    knowledgeBase,
    validatedImageUrls,
    orgSettings
  );

  // Parse response - may be single string or burst format
  const burst = parseBurstResponse(aiResponseRaw, true); // enableBurst=true

  // Send burst messages with delays
  const result = await sendBurstMessages(
    burst,
    platform,
    senderId,
    accessToken,
    pageId,
    DEFAULT_BURST_CONFIG
  );

  if (!result.success) {
    console.error('Burst send errors:', result.errors);
    // Log failure...
  }

  // Check for self-correction opportunity
  if (burst.reflectionNeeded || shouldSelfCorrect(aiResponseRaw, burst.confidence, DEFAULT_BURST_CONFIG)) {
    const reflection = buildReflectionMessage(aiResponseRaw, ['incomplete_info']);
    const reflectionBurst: MessageBurst = {
      messages: [reflection],
      reflectionNeeded: false,
      confidence: 0.7
    };
    
    // Don't exceed max messages
    if (result.messagesSent < DEFAULT_BURST_CONFIG.maxBurstMessages) {
      await sendBurstMessages(
        reflectionBurst,
        platform,
        senderId,
        accessToken,
        pageId,
        DEFAULT_BURST_CONFIG
      );
    }
  }

  // Save to database as before...
}
```

### AI Prompt Addition

The `createBurstPromptInstruction()` is injected into the system prompt:

```
## BURST MESSAGING CAPABILITY

You CAN send multiple messages in a single response if it makes the conversation better:

FORMAT OPTIONS:

### Option 1: JSON Format (Recommended)
{
  "burst": [
    "First message about the topic",
    "Second message with more context",
    "Third message with call-to-action"
  ],
  "confidence": 0.95,
  "reflectionNeeded": false
}

### Option 2: [BURST] Delimiter Format
First message here.
[BURST]
Second message here.
[BURST]
Third message here.

### When to Use Multiple Messages:
✅ Breaking long explanations into digestible chunks
✅ Acknowledging, then providing context
✅ Asking a question, then suggesting next steps
✅ Self-correcting a previous statement

❌ DON'T for simple yes/no answers or single thoughts
```

---

## Safety Guardrails

### 1. Message Count Limit

```typescript
const MAX_MESSAGES_PER_BURST = 3;

if (burst.messages.length > MAX_MESSAGES_PER_BURST) {
  burst.messages = burst.messages.slice(0, MAX_MESSAGES_PER_BURST);
  console.warn(`Truncated burst to ${MAX_MESSAGES_PER_BURST} messages`);
}
```

### 2. Message Length Validation

```typescript
for (const message of burst.messages) {
  if (message.length < 1) {
    console.warn("Skipping empty message");
    continue; // Skip empty messages
  }
  
  if (message.length > 1000) {
    console.warn(`Message too long (${message.length} chars), truncating`);
    message = message.slice(0, 1000) + "..."; // Truncate
  }
}
```

### 3. Infinite Loop Prevention

```typescript
let correctionAttempts = 0;
const MAX_CORRECTION_ATTEMPTS = 1; // Only 1 round of self-correction

while (shouldSelfCorrect(response, confidence, config) && correctionAttempts < MAX_CORRECTION_ATTEMPTS) {
  const reflection = buildReflectionMessage(response, issues);
  // Send reflection...
  correctionAttempts++;
}
```

### 4. Jitter Validation

```typescript
const delay = calculateTypingDelay(message.length, config);

// Ensure delay is reasonable
if (delay < 500) delay = 500; // Minimum 500ms
if (delay > 5000) delay = 5000; // Maximum 5 seconds

console.log(`Sending after ${delay}ms delay`);
```

### 5. Confidence Thresholds

```typescript
// Only self-correct if confidence is genuinely low
const SELF_CORRECT_THRESHOLD = 0.6; // 0-1 scale

if (burst.confidence < SELF_CORRECT_THRESHOLD) {
  console.log(`Low confidence (${burst.confidence}), considering self-correction...`);
  // May trigger reflection
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/burst-messaging.test.ts

describe("parseBurstResponse", () => {
  it("parses JSON burst format", () => {
    const response = '{"burst": ["msg1", "msg2"], "confidence": 0.9}';
    const result = parseBurstResponse(response, true);
    expect(result.messages).toEqual(["msg1", "msg2"]);
    expect(result.confidence).toBe(0.9);
  });

  it("parses [BURST] delimiter format", () => {
    const response = "First message\n[BURST]\nSecond message";
    const result = parseBurstResponse(response, true);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toBe("First message");
  });

  it("handles single string (backward compatible)", () => {
    const response = "Single message";
    const result = parseBurstResponse(response, true);
    expect(result.messages).toEqual(["Single message"]);
  });
});

describe("calculateTypingDelay", () => {
  it("calculates delay based on message length", () => {
    const delay = calculateTypingDelay("Hello world", DEFAULT_BURST_CONFIG, false);
    expect(delay).toBeGreaterThan(1000);
    expect(delay).toBeLessThan(3000);
  });

  it("adds jitter when enabled", () => {
    const delays = [];
    for (let i = 0; i < 10; i++) {
      delays.push(calculateTypingDelay("Same message", DEFAULT_BURST_CONFIG, true));
    }
    // Delays should vary due to jitter
    expect(new Set(delays).size).toBeGreaterThan(1);
  });
});

describe("validateBurstLength", () => {
  it("enforces max message limit", () => {
    const burst: MessageBurst = {
      messages: ["m1", "m2", "m3", "m4", "m5"],
      confidence: 0.8,
      reflectionNeeded: false
    };
    const result = validateBurstLength(burst, DEFAULT_BURST_CONFIG);
    expect(result.messages).toHaveLength(3);
  });

  it("filters empty messages", () => {
    const burst: MessageBurst = {
      messages: ["msg1", "", "msg2"],
      confidence: 0.8,
      reflectionNeeded: false
    };
    const result = validateBurstLength(burst, DEFAULT_BURST_CONFIG);
    expect(result.messages).toHaveLength(2);
  });
});
```

### Integration Tests

```typescript
// test/social-webhook-burst.integration.ts

describe("Burst messaging end-to-end", () => {
  it("sends 3 messages with appropriate delays", async () => {
    const startTime = Date.now();
    
    const burst: MessageBurst = {
      messages: ["Hello", "How are you?", "Ready to book?"],
      confidence: 0.9,
      reflectionNeeded: false
    };

    const result = await sendBurstMessages(
      burst,
      "messenger",
      "user123",
      "token",
      "page456",
      DEFAULT_BURST_CONFIG
    );

    const elapsed = Date.now() - startTime;
    
    expect(result.messagesSent).toBe(3);
    expect(elapsed).toBeGreaterThan(2000); // Should have delays
  });

  it("respects max message limit", async () => {
    const burst: MessageBurst = {
      messages: ["m1", "m2", "m3", "m4"],
      confidence: 0.8,
      reflectionNeeded: false
    };

    const result = await sendBurstMessages(burst, "whatsapp", "id", "token", "page", DEFAULT_BURST_CONFIG);
    
    expect(result.messagesSent).toBeLessThanOrEqual(3);
  });
});
```

### Manual Testing Checklist

- [ ] Single message (backward compatible)
- [ ] 2 messages with delay
- [ ] 3 messages with increasing delays
- [ ] Message with special characters
- [ ] Very long message (>1000 chars)
- [ ] Self-correction trigger
- [ ] Confidence-based reflection
- [ ] Cross-platform (Messenger, WhatsApp, Instagram)

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing completed on all platforms
- [ ] Code review approved
- [ ] No TypeScript compilation errors
- [ ] Rate limiting still functional
- [ ] Database operations tested

### Deployment Steps

1. **Deploy burst-messaging.ts**
   ```bash
   Deploy to: supabase/functions/_shared/burst-messaging.ts
   Status: No breaking changes
   ```

2. **Update social-webhook/index.ts**
   ```bash
   Add burst import
   Add createBurstPromptInstruction() to system prompt
   Implement sendBurstMessages() handler
   Update processMessage() flow
   ```

3. **Monitor rollout**
   - Track burst message send success rate
   - Monitor delay timing accuracy
   - Watch for any platform API errors
   - Check for self-correction frequency

### Post-Deployment Monitoring

```typescript
// Monitor these metrics
- bursts_sent: Number of multi-message bursts sent
- burst_success_rate: % of bursts fully sent
- messages_per_burst: Average messages per burst
- self_corrections_triggered: Frequency of reflection
- average_delay_ms: Actual timing of delays
- platform_errors: Any failures in sending
```

### Rollback Plan

If issues arise:

1. Revert burst import (disable feature)
2. Set `enableBurst: false` in parseBurstResponse()
3. This falls back to single-message mode
4. No customer impact, seamless degradation

---

## Configuration Options

```typescript
// Customize for your needs
export const CUSTOM_BURST_CONFIG: BurstConfig = {
  enabled: true,
  maxBurstMessages: 3, // Hard limit
  minDelayBetweenMessages: 1000, // Minimum 1 second
  maxDelayBetweenMessages: 3000, // Maximum 3 seconds
  charsPerSecond: 30, // Typing speed
  allowSelfCorrection: true,
  selfCorrectionThreshold: 0.6, // Confidence threshold
};
```

---

## FAQ & Troubleshooting

**Q: Will this cause webhook timeouts?**
A: No. Delays happen in the background worker after returning 200 OK to Meta.

**Q: Can the AI send more than 3 messages?**
A: No. Hard limit enforced by `validateBurstLength()`.

**Q: What if a message fails to send?**
A: Logged to audit_logs. Next message in burst still sends.

**Q: Can I disable burst messaging?**
A: Yes. Set `enableBurst: false` in `parseBurstResponse()` call.

**Q: Does this work on all platforms?**
A: Yes. Messenger, WhatsApp, Instagram all supported.

**Q: How much slower is this vs. single messages?**
A: 2-5 additional seconds total. Users perceive it as natural typing, improving experience.

---

## Quick Start

1. **Copy `burst-messaging.ts` to `supabase/functions/_shared/`**
2. **Update `social-webhook/index.ts`:**
   - Add import for burst-messaging
   - Add burst instruction to system prompt
   - Implement sendBurstMessages()
   - Update processMessage()
3. **Test with one platform first** (Messenger)
4. **Roll out to all platforms**
5. **Monitor metrics**

---

## Questions or Issues?

Contact: AI Architecture Team

---

**Version History:**
- v1.0 (Jan 17, 2026) - Initial architecture & implementation guide

