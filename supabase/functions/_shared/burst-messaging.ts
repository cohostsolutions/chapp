/**
 * BURST MESSAGING SYSTEM
 * 
 * Transforms single-message (Ping-Pong) model to multi-message (Burst) model.
 * Enables AI to send multiple consecutive messages with human-like delays.
 * 
 * Three Core Features:
 * 1. Message Burst - AI returns array of strings instead of single response
 * 2. Human Jitter - Typing delay simulation between messages
 * 3. Self-Correction - Post-message reflection to send follow-ups
 */

/**
 * Represents a burst of messages the AI wants to send
 */
export interface MessageBurst {
  messages: string[];
  reflectionNeeded: boolean;
  confidence: number; // 0-1, used to determine if self-correction needed
  reasoning?: string; // Why multiple messages?
}

/**
 * Configuration for burst messaging behavior
 */
export interface BurstConfig {
  enabled: boolean;
  maxBurstMessages: number; // Safety limit (default 3)
  minDelayBetweenMessages: number; // milliseconds
  maxDelayBetweenMessages: number; // milliseconds
  charsPerSecond: number; // For typing speed calculation
  allowSelfCorrection: boolean;
  selfCorrectionThreshold: number; // Confidence below this triggers reflection
}

/**
 * Default burst configuration
 */
export const DEFAULT_BURST_CONFIG: BurstConfig = {
  enabled: true,
  maxBurstMessages: 3,
  minDelayBetweenMessages: 1000, // 1 second minimum
  maxDelayBetweenMessages: 3000, // 3 second maximum
  charsPerSecond: 30,
  allowSelfCorrection: true,
  selfCorrectionThreshold: 0.6, // If confidence < 0.6, reflect
};

/**
 * Parse AI response to extract burst messages
 * 
 * The AI can return messages in several formats:
 * 1. Single string (backward compatible)
 * 2. JSON object with burst info: { "burst": ["msg1", "msg2"], "confidence": 0.95 }
 * 3. Message array separated by [BURST] delimiters
 */
export function parseBurstResponse(
  response: string,
  enableBurst: boolean = true
): MessageBurst {
  if (!enableBurst) {
    // Backward compatibility: return single message as burst of 1
    return {
      messages: [response],
      reflectionNeeded: false,
      confidence: 1.0,
    };
  }

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(response);
    if (parsed.burst && Array.isArray(parsed.burst)) {
      return {
        messages: parsed.burst.filter((m: string) => m && m.trim()),
        reflectionNeeded: parsed.reflectionNeeded || false,
        confidence: parsed.confidence ?? 0.8,
        reasoning: parsed.reasoning,
      };
    }
  } catch {
    // Not JSON, continue
  }

  // Check for [BURST] delimiter format
  if (response.includes('[BURST]')) {
    const messages = response
      .split('[BURST]')
      .map(msg => msg.trim())
      .filter(msg => msg && msg.length > 0);

    if (messages.length > 1) {
      return {
        messages,
        reflectionNeeded: false,
        confidence: 0.8,
      };
    }
  }

  // Default: single message
  return {
    messages: [response.trim()],
    reflectionNeeded: false,
    confidence: 1.0,
  };
}

/**
 * Calculate typing delay for a message based on length
 * 
 * Simulates human reading + thinking time
 * Formula: random_base_delay + (message_length / chars_per_second)
 */
export function calculateTypingDelay(
  messageLength: number,
  config: BurstConfig,
  addJitter: boolean = true
): number {
  // Base delay (thinking time)
  const baseDelay = config.minDelayBetweenMessages;
  
  // Character-based delay (typing speed)
  const charDelay = (messageLength / config.charsPerSecond) * 1000;
  
  // Total before jitter
  let total = baseDelay + charDelay * 0.5; // Reduce char delay weight
  
  // Cap at max
  total = Math.min(total, config.maxDelayBetweenMessages);
  
  if (addJitter) {
    // Add random jitter (±10%)
    const jitter = (Math.random() - 0.5) * total * 0.2;
    total += jitter;
  }
  
  return Math.round(total);
}

/**
 * Determines if a response needs self-correction
 * 
 * Low confidence responses may need follow-up reflection
 * Checks for:
 * - Uncertainty phrases ("I think", "maybe", "not sure")
 * - Correction keywords ("[CORRECTION]", "[UPDATE]")
 * - Confidence score below threshold
 */
export function shouldSelfCorrect(
  response: string,
  confidence: number,
  config: BurstConfig
): boolean {
  if (!config.allowSelfCorrection) {
    return false;
  }

  // Confidence-based check
  if (confidence < config.selfCorrectionThreshold) {
    return true;
  }

  // Keyword-based check
  const correctionKeywords = [
    '[CORRECTION]',
    '[UPDATE]',
    '[CLARIFICATION]',
    '[REFLECTION]'
  ];
  
  if (correctionKeywords.some(keyword => response.includes(keyword))) {
    return true;
  }

  // Uncertainty phrases (less strict - only if low confidence)
  if (confidence < config.selfCorrectionThreshold + 0.2) {
    const uncertaintyPhrases = [
      "let me correct that",
      "actually, i should mention",
      "to clarify",
      "i realize i missed",
      "let me add",
    ];
    
    if (uncertaintyPhrases.some(phrase => response.toLowerCase().includes(phrase))) {
      return true;
    }
  }

  return false;
}

/**
 * Build a self-correction reflection message
 * 
 * If the AI feels uncertain about a response, it can trigger
 * a reflection message without waiting for user input.
 */
export function buildReflectionMessage(
  originalResponse: string,
  detectedIssues: string[]
): string {
  if (detectedIssues.length === 0) {
    return "Actually, let me reconsider that...";
  }

  // Build contextual reflection based on detected issues
  const reflections: Record<string, string> = {
    missing_confirmation: "Wait, I should ask for confirmation on that.",
    incomplete_info: "Actually, I realize I need more information to answer that properly.",
    conflicting_info: "Let me clarify something I just said...",
    policy_mention: "Actually, I should mention our policy on that.",
    availability_question: "Let me double-check availability for you.",
  };

  const reflection = reflections[detectedIssues[0]] || reflections.incomplete_info;
  return reflection;
}

/**
 * Validate burst message count against safety limits
 */
export function validateBurstLength(
  burst: MessageBurst,
  config: BurstConfig
): { valid: boolean; messages: string[]; warnings: string[] } {
  const warnings: string[] = [];
  let messages = [...burst.messages];

  if (messages.length > config.maxBurstMessages) {
    warnings.push(
      `Burst message count (${messages.length}) exceeds max (${config.maxBurstMessages}). Truncating.`
    );
    messages = messages.slice(0, config.maxBurstMessages);
  }

  // Validate and clean each message
  const validMessages = messages
    .map(msg => {
      // Remove empty messages
      if (!msg || msg.trim().length === 0) {
        warnings.push('Empty message filtered out');
        return null;
      }
      
      // Truncate messages longer than 2000 chars (Facebook/Instagram limit is ~2000)
      if (msg.length > 2000) {
        warnings.push(`Message too long (${msg.length} chars), truncating to 2000`);
        // Truncate at word boundary if possible
        let truncated = msg.slice(0, 2000);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 1900) {
          truncated = truncated.slice(0, lastSpace).trim();
        } else {
          truncated = truncated.trim();
        }
        return truncated;
      }
      
      return msg;
    })
    .filter((msg): msg is string => msg !== null);

  return {
    valid: validMessages.length > 0,
    messages: validMessages,
    warnings,
  };
}

/**
 * Format a message for platform delivery
 * Removes burst markers and JSON formatting
 */
export function cleanMessageForDelivery(message: string): string {
  return message
    .replace(/\[BURST\]/g, '') // Remove burst markers
    .replace(/\[CORRECTION\]/g, '') // Remove meta tags
    .replace(/\[UPDATE\]/g, '')
    .replace(/\[CLARIFICATION\]/g, '')
    .replace(/\[REFLECTION\]/g, '')
    .trim();
}

/**
 * Delay function for async message sending
 * Returns a promise that resolves after specified milliseconds
 */
export async function delayMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process and send a burst of messages with proper delays
 * 
 * This is the core orchestrator that:
 * 1. Validates message burst
 * 2. Calculates delays between messages
 * 3. Sends each message with typing delay
 * 4. Handles self-correction if needed
 */
export interface BurstSendResult {
  success: boolean;
  messagesSent: number;
  messageIds: string[];
  errors: string[];
  totalDelayMs: number;
}

/**
 * Create a system prompt instruction for burst messaging
 * 
 * This prompt is injected into the AI system prompt to enable burst responses
 */
export function createBurstPromptInstruction(): string {
  return `
## BURST MESSAGING CAPABILITY

You CAN send multiple messages in a single response if it makes the conversation better:

FORMAT OPTIONS:

### Option 1: JSON Format (Recommended for complex responses)
\`\`\`json
{
  "burst": [
    "First message about the topic",
    "Second message with additional context",
    "Third message with call-to-action"
  ],
  "confidence": 0.95,
  "reflectionNeeded": false,
  "reasoning": "Breaking into messages for clarity"
}
\`\`\`

### Option 2: [BURST] Delimiter Format (Simple)
Message 1 here explaining the first point.
[BURST]
Message 2 continuing with more details.
[BURST]
Message 3 with final thoughts.

### When to Use Multiple Messages:

✅ **DO send multiple messages when:**
- Breaking a long explanation into digestible chunks
- Acknowledging, then providing additional context
- Asking a clarifying question, then suggesting next steps
- Correcting a previous statement you just made
- Providing options sequentially for better readability

❌ **DON'T send multiple messages for:**
- Simple yes/no answers
- Single complete thoughts
- Responses that are naturally brief

### Self-Correction:

If you realize you made an error or missed important context AFTER formulating your response:

\`\`\`json
{
  "burst": [
    "Original message you want to send first",
    "[CORRECTION] Actually, I should add that...",
    "Follow-up correction or additional context"
  ],
  "reflectionNeeded": true,
  "confidence": 0.7
}
\`\`\`

The system will automatically send these messages with natural typing delays between them.

### Important Notes:

- Each message is sent separately with 1-3 second delays (simulating human typing)
- Maximum 3 messages per response (safety limit)
- Keep each message under 1000 characters
- Messages are sent to the user in the order you specify
`;
}
