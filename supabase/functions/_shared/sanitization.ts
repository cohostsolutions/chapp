/**
 * Input sanitization and validation utilities
 * Prevents prompt injection and enforces content safety
 */

/**
 * Sanitize conversation history from client
 * - Bounds the history size
 * - Strips potentially harmful instructions
 * - Validates message format
 */
export function sanitizeConversationHistory(
  history: Array<{ role: string; content: unknown }>,
  maxMessages = 80
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(history)) {
    return [];
  }

  // Take only the most recent messages
  const bounded = history.slice(-maxMessages);

  const sanitized: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of bounded) {
    // Validate role
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      continue;
    }

    // Extract text content
    let textContent = '';
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Handle multimodal content parts
      for (const part of msg.content as Array<unknown>) {
        const p = part as { type?: string; text?: unknown };
        if (p.type === 'text' && typeof p.text === 'string') {
          textContent += p.text + ' ';
        }
      }
      textContent = textContent.trim();
    } else {
      continue;
    }

    // Skip empty messages
    if (!textContent || textContent.length === 0) {
      continue;
    }

    // Truncate individual messages
    if (textContent.length > 10000) {
      textContent = textContent.substring(0, 10000);
    }

    // Remove obvious prompt injection attempts
    textContent = removePromptInjection(textContent);

    sanitized.push({
      role: msg.role as 'user' | 'assistant',
      content: textContent,
    });
  }

  return sanitized;
}

/**
 * Remove common prompt injection patterns
 */
function removePromptInjection(text: string): string {
  // Patterns that attempt to override system instructions
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|directives?)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /new\s+(instructions?|prompts?|rules?):/gi,
    /you\s+are\s+now\s+(a|an)/gi,
    /act\s+as\s+(if\s+)?(you\s+are|you're)/gi,
    /pretend\s+(you\s+are|you're|to\s+be)/gi,
    /reset\s+your\s+(instructions?|prompts?|programming)/gi,
    /override\s+(your\s+)?(instructions?|prompts?|rules?)/gi,
  ];

  let cleaned = text;
  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, '[filtered]');
  }

  return cleaned;
}

/**
 * Validate and sanitize file uploads for document processing
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedType?: string;
  maxSizeBytes?: number;
}

const ALLOWED_MIME_TYPES = [
  'text/plain',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateFileUpload(
  fileType: string,
  fileSize: number
): FileValidationResult {
  // Check MIME type whitelist
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: `File type ${fileType} is not supported. Allowed types: PDF, Word documents, plain text, and images (PNG, JPG, WebP, GIF).`,
    };
  }

  // Check file size
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
    };
  }

  return {
    valid: true,
    sanitizedType: fileType,
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
  };
}

/**
 * Sanitize text extracted from documents
 * Remove potential PII patterns before sending to AI
 */
export function sanitizeExtractedText(text: string, redactPII = false): string {
  if (!redactPII) {
    return text;
  }

  let sanitized = text;

  // Redact email addresses
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );

  // Redact phone numbers (various formats)
  sanitized = sanitized.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    '[PHONE_REDACTED]'
  );

  // Redact credit card numbers
  sanitized = sanitized.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '[CARD_REDACTED]'
  );

  // Redact SSN-like patterns
  sanitized = sanitized.replace(
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    '[SSN_REDACTED]'
  );

  return sanitized;
}

/**
 * Validate image URLs to prevent SSRF attacks
 */
export function validateImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow https
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Block internal/private IP ranges
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname === '0.0.0.0' ||
      hostname === '[::]'
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize and validate image URLs array
 */
export function sanitizeImageUrls(urls: unknown, maxImages = 5): string[] {
  if (!Array.isArray(urls)) {
    return [];
  }

  const validated: string[] = [];
  for (const url of urls.slice(0, maxImages)) {
    if (typeof url === 'string' && validateImageUrl(url)) {
      validated.push(url);
    }
  }

  return validated;
}
