/**
 * Input Sanitization and Output Encoding Utilities
 * Prevents XSS (Cross-Site Scripting) attacks
 * SECURITY: Critical for preventing stored and reflected XSS
 */

import { devWarn } from '@/lib/logger';

/**
 * Sanitize plain text input - strips all HTML tags
 * Use this for chat messages, comments, etc. where NO HTML is allowed
 * @param input - Raw user input
 * @returns Sanitized text safe for display
 */
export function sanitizePlainText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Escape HTML special characters first, then remove any dangerous patterns
  let sanitized = input
    .replace(/&/g, '&amp;') // Escape ampersands (must be first)
    .replace(/</g, '&lt;') // Escape less-than
    .replace(/>/g, '&gt;') // Escape greater-than
    .replace(/"/g, '&quot;') // Escape quotes
    .replace(/'/g, '&#x27;') // Escape single quotes
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=

  return sanitized.trim();
}

/**
 * Sanitize rich text input - allows only safe HTML tags
 * Use this for descriptions, notes where SOME formatting is allowed
 * @param input - Raw user input with potential HTML
 * @returns Sanitized HTML with only safe tags
 */
export function sanitizeRichText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove dangerous tags and attributes
  let sanitized = input
    // Remove script tags completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove event handlers (onclick, onload, etc.)
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove style tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove any style attributes with javascript
    .replace(/style\s*=\s*["'][^"']*javascript[^"']*["']/gi, '')
    // Remove javascript: protocol from href
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // Remove data: protocol from href (can execute scripts)
    .replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');

  return sanitized.trim();
}

/**
 * Escape HTML special characters for safe display
 * Use when displaying user content as text
 * @param text - Text to escape
 * @returns HTML-escaped text
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Decode HTML entities back to text
 * Use when you need to convert escaped HTML back to readable text
 * @param html - HTML-encoded text
 * @returns Decoded text
 */
export function decodeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
}

/**
 * Check if text contains suspicious patterns
 * Returns true if potential XSS payload detected
 * @param text - Text to check
 * @returns true if suspicious patterns found
 */
export function isSuspiciousText(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();

  // Check for common XSS patterns
  const xssPatterns = [
    /<script/,
    /javascript:/,
    /on\w+\s*=/,
    /<iframe/,
    /<embed/,
    /<object/,
    /eval\(/,
    /alert\(/,
    /fetch\(/,
    /fetch\s/,
    /data:/,
    /vbscript:/,
    /expression\(/,
  ];

  return xssPatterns.some((pattern) => pattern.test(lowerText));
}

/**
 * Sanitize chat message input
 * Used specifically for chat/messaging components
 * @param input - Raw chat input
 * @returns Sanitized message safe for storage and display
 */
export function sanitizeChatInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Check for suspicious patterns first
  if (isSuspiciousText(input)) {
    // Log potential attack (in real app, log to security system)
    devWarn('[Security] Suspicious input detected in chat:', {
      input: input.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
  }

  // Use plain text sanitization for chat (no HTML allowed)
  return sanitizePlainText(input);
}

/**
 * Validate and sanitize URL
 * Prevents javascript: and data: protocol attacks
 * @param url - URL to validate
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    // Parse the URL
    const parsed = new URL(url, window.location.href);

    // Only allow http and https protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    // Invalid URL format
    return '';
  }
}

/**
 * Create a safe text node for DOM insertion
 * Use instead of innerHTML when you have plain text
 * @param text - Text to insert
 * @returns Text node safe for DOM
 */
export function createSafeTextNode(text: string): Text {
  return document.createTextNode(sanitizePlainText(text));
}

/**
 * Safely set text content of an element
 * Use this instead of innerHTML for user-generated content
 * @param element - DOM element
 * @param text - Text content
 */
export function setSafeTextContent(element: HTMLElement, text: string): void {
  // Clear existing content
  element.textContent = '';
  // Add sanitized text
  element.appendChild(createSafeTextNode(text));
}

/**
 * Check if Content Security Policy is properly set
 * Returns recommended CSP headers for production
 */
export function getRecommendedCSP(): string {
  return (
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' https: data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
}

/**
 * Strip sensitive data from error messages
 * Prevents leaking API keys, tokens, etc.
 * @param error - Error message
 * @returns Cleaned error message
 */
export function stripSensitiveFromError(error: string): string {
  if (!error || typeof error !== 'string') {
    return 'An error occurred';
  }

  // Regex patterns for sensitive data
  const sensitivePatterns = [
    /['"]?[A-Za-z0-9_-]{40,}['"]?/g, // API keys
    /Bearer\s+[A-Za-z0-9_-]+/g, // Bearer tokens
    /\b\d{4}['\s-]?\d{4}['\s-]?\d{4}['\s-]?\d{4}\b/g, // Credit cards
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  ];

  let cleaned = error;
  sensitivePatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  });

  return cleaned;
}
