// Test to verify truncation logic works correctly

interface MessageBurst {
  messages: string[];
  reflectionNeeded: boolean;
  confidence: number;
  reasoning?: string;
}

interface BurstConfig {
  enabled: boolean;
  maxBurstMessages: number;
  minDelayBetweenMessages: number;
  maxDelayBetweenMessages: number;
  charsPerSecond: number;
  allowSelfCorrection: boolean;
  selfCorrectionThreshold: number;
}

function validateBurstLength(
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

// Test cases
const config: BurstConfig = {
  enabled: true,
  maxBurstMessages: 3,
  minDelayBetweenMessages: 1000,
  maxDelayBetweenMessages: 3000,
  charsPerSecond: 30,
  allowSelfCorrection: true,
  selfCorrectionThreshold: 0.6,
};

// Test 1: Normal message
const test1: MessageBurst = {
  messages: ["That's a great question, and it gives me a chance to clarify!"],
  reflectionNeeded: false,
  confidence: 0.95,
};

console.log('Test 1 - Normal message:');
const result1 = validateBurstLength(test1, config);
console.log('Valid:', result1.valid);
console.log('Message:', result1.messages[0]);
console.log('Warnings:', result1.warnings);
console.log('');

// Test 2: Very long message (3000+ chars)
const longText = "This is a very long message. ".repeat(100); // ~2800 chars
const test2: MessageBurst = {
  messages: [longText],
  reflectionNeeded: false,
  confidence: 0.95,
};

console.log('Test 2 - Long message:');
const result2 = validateBurstLength(test2, config);
console.log('Valid:', result2.valid);
console.log('Original length:', longText.length);
console.log('Truncated length:', result2.messages[0].length);
console.log('Message ends with:', result2.messages[0].slice(-50));
console.log('Warnings:', result2.warnings);
console.log('');

// Test 3: Multi-message burst
const test3: MessageBurst = {
  messages: [
    "This is message 1.",
    "This is message 2.",
    "This is message 3.",
    "This is message 4 (should be removed).",
  ],
  reflectionNeeded: false,
  confidence: 0.95,
};

console.log('Test 3 - Multi-message burst:');
const result3 = validateBurstLength(test3, config);
console.log('Valid:', result3.valid);
console.log('Message count:', result3.messages.length);
console.log('Messages:', result3.messages);
console.log('Warnings:', result3.warnings);
