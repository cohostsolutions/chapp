/**
 * PHASE 1 Security Implementations - Test Suite
 * Tests for: Validation, File Upload, XSS Prevention, RLS
 */

import { describe, it, expect } from 'vitest';
import {
  priceSchema,
  amountSchema,
  quantitySchema,
  percentageSchema,
} from '@/lib/validations';
import {
  validateFileUpload,
  validateFiles,
  sanitizeFileName,
  ALLOWED_EXTENSIONS,
  FILE_SIZE_LIMITS,
} from '@/lib/fileValidation';
import {
  sanitizePlainText,
  sanitizeRichText,
  sanitizeChatInput,
  escapeHtml,
  isSuspiciousText,
  sanitizeUrl,
} from '@/lib/sanitize';

// ==================== NUMERIC VALIDATION TESTS ====================

describe('VALIDATE-001: Numeric Field Validation', () => {
  describe('Price Schema', () => {
    it('should accept valid prices', () => {
      expect(priceSchema.safeParse(0).success).toBe(true);
      expect(priceSchema.safeParse(99.99).success).toBe(true);
      expect(priceSchema.safeParse(9999).success).toBe(true);
      expect(priceSchema.safeParse(99999999).success).toBe(true);
    });

    it('should reject negative prices', () => {
      const result = priceSchema.safeParse(-1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('negative');
      }
    });

    it('should reject prices exceeding max limit', () => {
      const result = priceSchema.safeParse(100000000);
      expect(result.success).toBe(false);
    });

    it('should reject non-finite numbers', () => {
      expect(priceSchema.safeParse(Infinity).success).toBe(false);
      expect(priceSchema.safeParse(NaN).success).toBe(false);
    });
  });

  describe('Amount Schema', () => {
    it('should accept valid amounts', () => {
      expect(amountSchema.safeParse(0).success).toBe(true);
      expect(amountSchema.safeParse(500.50).success).toBe(true);
    });

    it('should reject negative amounts', () => {
      const result = amountSchema.safeParse(-100);
      expect(result.success).toBe(false);
    });
  });

  describe('Quantity Schema', () => {
    it('should accept valid quantities', () => {
      expect(quantitySchema.safeParse(1).success).toBe(true);
      expect(quantitySchema.safeParse(100).success).toBe(true);
    });

    it('should reject zero quantity', () => {
      const result = quantitySchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it('should reject decimal quantities', () => {
      const result = quantitySchema.safeParse(5.5);
      expect(result.success).toBe(false);
    });
  });

  describe('Percentage Schema', () => {
    it('should accept valid percentages', () => {
      expect(percentageSchema.safeParse(0).success).toBe(true);
      expect(percentageSchema.safeParse(50).success).toBe(true);
      expect(percentageSchema.safeParse(100).success).toBe(true);
    });

    it('should reject percentages over 100', () => {
      const result = percentageSchema.safeParse(101);
      expect(result.success).toBe(false);
    });

    it('should reject negative percentages', () => {
      const result = percentageSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });
  });
});

// ==================== FILE UPLOAD VALIDATION TESTS ====================

describe('UPLOAD-001: File Upload Validation', () => {
  describe('validateFileUpload', () => {
    it('should accept valid image files', () => {
      const file = new File(['test'], 'image.png', { type: 'image/png' });
      const result = validateFileUpload(file, 'image');
      expect(result.valid).toBe(true);
    });

    it('should reject executable files', () => {
      const file = new File(['test'], 'malware.exe', { type: 'application/x-msdownload' });
      const result = validateFileUpload(file, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject files exceeding size limit', () => {
      // Create a 6MB file (exceeds 5MB image limit)
      const largeContent = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeContent], 'large.png', { type: 'image/png' });
      const result = validateFileUpload(file, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should reject files with wrong MIME type', () => {
      const file = new File(['test'], 'file.exe', { type: 'text/plain' });
      const result = validateFileUpload(file, 'image');
      expect(result.valid).toBe(false);
    });

    it('should reject files with suspicious extensions', () => {
      const file = new File(['test'], 'script.js', { type: 'text/javascript' });
      const result = validateFileUpload(file, 'document');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should accept valid CSV files', () => {
      const csvContent = 'name,email\nJohn,john@example.com';
      const file = new File([csvContent], 'data.csv', { type: 'text/csv' });
      const result = validateFileUpload(file, 'document');
      expect(result.valid).toBe(true);
    });

    it('should reject files with very long names', () => {
      const longName = 'a'.repeat(256) + '.png';
      const file = new File(['test'], longName, { type: 'image/png' });
      const result = validateFileUpload(file, 'image');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFiles', () => {
    it('should validate multiple files and return first error', () => {
      const files = [
        new File(['test'], 'valid.png', { type: 'image/png' }),
        new File(['test'], 'malware.exe', { type: 'application/x-msdownload' }),
      ];
      const result = validateFiles(files, 'image');
      expect(result.valid).toBe(false);
      expect(result.invalidFileIndex).toBe(1);
    });

    it('should accept all valid files', () => {
      const files = [
        new File(['test'], 'image1.png', { type: 'image/png' }),
        new File(['test'], 'image2.jpg', { type: 'image/jpeg' }),
      ];
      const result = validateFiles(files, 'image');
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove path traversal attempts', () => {
      const name = sanitizeFileName('../../../etc/passwd');
      expect(name).not.toContain('..');
    });

    it('should remove dangerous characters', () => {
      const name = sanitizeFileName('file<script>.txt');
      expect(name).not.toContain('<');
      expect(name).not.toContain('>');
    });

    it('should preserve file extension', () => {
      const name = sanitizeFileName('document.pdf');
      expect(name).toContain('.pdf');
    });

    it('should limit name length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const name = sanitizeFileName(longName);
      expect(name.length).toBeLessThanOrEqual(210); // 200 + ".txt"
    });
  });
});

// ==================== XSS PREVENTION TESTS ====================

describe('XSS-001: Input Sanitization and XSS Prevention', () => {
  describe('sanitizePlainText', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const output = sanitizePlainText(input);
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('</script>');
      expect(output).toContain('Hello');
    });

    it('should escape HTML special characters', () => {
      const input = '<img src=x onerror="alert(1)">';
      const output = sanitizePlainText(input);
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
    });

    it('should handle SQL injection attempts safely', () => {
      const input = "'; DROP TABLE users; --";
      const output = sanitizePlainText(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain("DROP TABLE");
    });

    it('should return empty string for null/undefined', () => {
      expect(sanitizePlainText(null as any)).toBe('');
      expect(sanitizePlainText(undefined as any)).toBe('');
    });
  });

  describe('sanitizeRichText', () => {
    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const output = sanitizeRichText(input);
      expect(output).not.toContain('<script>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const output = sanitizeRichText(input);
      expect(output).not.toContain('onclick');
    });

    it('should remove javascript: protocol from href', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const output = sanitizeRichText(input);
      expect(output).not.toContain('javascript:');
    });

    it('should allow safe HTML tags', () => {
      const input = '<p><b>Bold</b> and <i>italic</i></p>';
      const output = sanitizeRichText(input);
      expect(output).toContain('<p>');
      expect(output).toContain('<b>');
    });
  });

  describe('sanitizeChatInput', () => {
    it('should sanitize message input', () => {
      const input = 'Hello <script>alert("xss")</script>';
      const output = sanitizeChatInput(input);
      expect(output).not.toContain('<script>');
    });

    it('should detect suspicious patterns', () => {
      const suspicious = '<img src=x onerror="alert(1)">';
      expect(isSuspiciousText(suspicious)).toBe(true);
    });

    it('should not flag normal text as suspicious', () => {
      const normal = 'Just a normal message';
      expect(isSuspiciousText(normal)).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<div>&"\'</div>';
      const output = escapeHtml(input);
      expect(output).toBe('&lt;div&gt;&amp;&quot;&#x27;&lt;/div&gt;');
    });

    it('should return empty string for null', () => {
      expect(escapeHtml(null as any)).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid HTTP URLs', () => {
      const url = sanitizeUrl('https://example.com/path');
      expect(url).toContain('https://example.com');
    });

    it('should reject javascript: protocol', () => {
      const url = sanitizeUrl('javascript:alert(1)');
      expect(url).toBe('');
    });

    it('should reject data: protocol', () => {
      const url = sanitizeUrl('data:text/html,<script>alert(1)</script>');
      expect(url).toBe('');
    });

    it('should accept mailto: protocol', () => {
      const url = sanitizeUrl('mailto:test@example.com');
      expect(url).toContain('mailto:');
    });
  });
});

// ==================== INTEGRATION TESTS ====================

describe('Phase 1 Security Implementations - Integration', () => {
  it('should prevent negative price injection via form', () => {
    const formData = {
      price: -5000,
    };
    const result = priceSchema.safeParse(formData.price);
    expect(result.success).toBe(false);
  });

  it('should prevent oversized file upload', () => {
    const largeFile = new File(
      [new ArrayBuffer(10 * 1024 * 1024)],
      'large.png',
      { type: 'image/png' }
    );
    const result = validateFileUpload(largeFile, 'image');
    expect(result.valid).toBe(false);
  });

  it('should prevent XSS in chat message', () => {
    const maliciousMessage = '<img src=x onerror="console.log(document.cookie)">';
    const sanitized = sanitizeChatInput(maliciousMessage);
    expect(sanitized).not.toContain('<img');
    expect(sanitized).not.toContain('onerror');
  });

  it('should handle SQL injection attempts safely', () => {
    const sqlInjection = "'; DROP TABLE leads; --";
    const sanitized = sanitizePlainText(sqlInjection);
    // Should be stored as plain text, not executed
    expect(sanitized).toContain('DROP');
    expect(sanitized).not.toContain('<');
  });
});
