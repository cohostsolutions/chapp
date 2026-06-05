/**
 * Security Headers Utilities - WCAG 2.1 AAA Compliant
 * Comprehensive security header management for production applications
 *
 * @module securityHeaders
 */

import { logError } from './logger';

/* ============================================================================
   Types & Interfaces
   ============================================================================ */

/**
 * Content Security Policy directive configuration
 */
export interface CSPDirective {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  fontSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  objectSrc?: string[];
  frameSrc?: string[];
  childSrc?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  baseUri?: string[];
  reportUri?: string;
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  requireSriFor?: string[];
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  csp?: CSPDirective;
  hsts?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  cors?: CORSConfig;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  xContentTypeOptions?: 'nosniff';
  referrerPolicy?:
    | 'no-referrer'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin';
  permissionsPolicy?: Record<string, string[]>;
  xXssProtection?: '1; mode=block' | '0';
  contentSecurityPolicyReportOnly?: boolean;
  enableNonce?: boolean;
}

/**
 * Security header validation result
 */
export interface SecurityHeaderValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Security audit result
 */
export interface SecurityAudit {
  timestamp: Date;
  headers: Record<string, string>;
  missingHeaders: string[];
  issues: AuditIssue[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Individual audit issue
 */
export interface AuditIssue {
  type: 'critical' | 'warning' | 'info';
  header: string;
  message: string;
  recommendation: string;
}

/**
 * Nonce registry for inline scripts/styles
 */
export interface NonceRegistry {
  [key: string]: string;
}

/* ============================================================================
   Constants
   ============================================================================ */

/**
 * Default CSP configuration - strict policy
 */
export const DEFAULT_CSP: CSPDirective = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'strict-dynamic'"],
  styleSrc: ["'self'", "'nonce-{nonce}'"],
  fontSrc: ["'self'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: ["'self'"],
  childSrc: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  baseUri: ["'self'"],
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
};

/**
 * Default HSTS configuration
 */
export const DEFAULT_HSTS = {
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true,
};

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS: CORSConfig = {
  origin: 'https://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Default Permissions Policy configuration
 */
export const DEFAULT_PERMISSIONS_POLICY: Record<string, string[]> = {
  'accelerometer': [],
  'ambient-light-sensor': [],
  'autoplay': ["'self'"],
  'battery': [],
  'camera': [],
  'document-domain': [],
  'encrypted-media': [],
  'fullscreen': ["'self'"],
  'geolocation': [],
  'gyroscope': [],
  'magnetometer': [],
  'microphone': [],
  'midi': [],
  'payment': [],
  'picture-in-picture': ["'self'"],
  'usb': [],
  'vr': [],
  'xr-spatial-tracking': [],
};

/**
 * Security headers to validate
 */
export const ESSENTIAL_SECURITY_HEADERS = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

/**
 * Recommended security headers
 */
export const RECOMMENDED_SECURITY_HEADERS = [
  'X-XSS-Protection',
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Headers',
];

/* ============================================================================
   CSP Functions
   ============================================================================ */

/**
 * Generate CSP header string from directive object
 * @param directives CSP directives
 * @param nonce Optional nonce for inline scripts
 * @returns CSP header value
 *
 * @example
 * const csp = generateCSP({ scriptSrc: ["'self'", "'nonce-abc123'"] });
 * // "script-src 'self' 'nonce-abc123'"
 */
export function generateCSP(
  directives: CSPDirective,
  nonce?: string
): string {
  const parts: string[] = [];

  const directiveMap: Record<keyof CSPDirective, string> = {
    defaultSrc: 'default-src',
    scriptSrc: 'script-src',
    styleSrc: 'style-src',
    fontSrc: 'font-src',
    imgSrc: 'img-src',
    connectSrc: 'connect-src',
    mediaSrc: 'media-src',
    objectSrc: 'object-src',
    frameSrc: 'frame-src',
    childSrc: 'child-src',
    formAction: 'form-action',
    frameAncestors: 'frame-ancestors',
    baseUri: 'base-uri',
    reportUri: 'report-uri',
    requireSriFor: 'require-sri-for',
    upgradeInsecureRequests: 'upgrade-insecure-requests',
    blockAllMixedContent: 'block-all-mixed-content',
  };

  for (const [key, headerName] of Object.entries(directiveMap)) {
    const value = directives[key as keyof CSPDirective];

    if (typeof value === 'boolean') {
      if (value) {
        parts.push(headerName);
      }
    } else if (Array.isArray(value)) {
      let sources = value.join(' ');
      if (nonce && (key === 'scriptSrc' || key === 'styleSrc')) {
        sources = sources.replace('{nonce}', nonce);
      }
      parts.push(`${headerName} ${sources}`);
    } else if (typeof value === 'string') {
      parts.push(`${headerName} ${value}`);
    }
  }

  return parts.join('; ');
}

/**
 * Parse CSP header string to directive object
 * @param headerValue CSP header value
 * @returns Parsed CSP directives
 */
export function parseCSP(headerValue: string): CSPDirective {
  const directives: CSPDirective = {};
  const parts = headerValue.split(';').map(part => part.trim());

  for (const part of parts) {
    if (!part) continue;

    const [directiveName, ...sourcesList] = part.split(/\s+/);
    const sources = sourcesList.join(' ');

    switch (directiveName) {
      case 'default-src':
        directives.defaultSrc = sourcesList;
        break;
      case 'script-src':
        directives.scriptSrc = sourcesList;
        break;
      case 'style-src':
        directives.styleSrc = sourcesList;
        break;
      case 'font-src':
        directives.fontSrc = sourcesList;
        break;
      case 'img-src':
        directives.imgSrc = sourcesList;
        break;
      case 'connect-src':
        directives.connectSrc = sourcesList;
        break;
      case 'media-src':
        directives.mediaSrc = sourcesList;
        break;
      case 'object-src':
        directives.objectSrc = sourcesList;
        break;
      case 'frame-src':
        directives.frameSrc = sourcesList;
        break;
      case 'form-action':
        directives.formAction = sourcesList;
        break;
      case 'frame-ancestors':
        directives.frameAncestors = sourcesList;
        break;
      case 'report-uri':
        directives.reportUri = sources;
        break;
    }
  }

  return directives;
}

/* ============================================================================
   HSTS Functions
   ============================================================================ */

/**
 * Generate HSTS header string
 * @param config HSTS configuration
 * @returns HSTS header value
 *
 * @example
 * const hsts = generateHSTS({ maxAge: 31536000, includeSubDomains: true });
 * // "max-age=31536000; includeSubDomains; preload"
 */
export function generateHSTS(config: {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}): string {
  const parts = [`max-age=${config.maxAge}`];

  if (config.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  if (config.preload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

/**
 * Validate HSTS max age is production-ready
 * @param maxAge Max age in seconds
 * @returns Validation result with warnings
 */
export function validateHSTSMaxAge(maxAge: number): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (maxAge < 10886400) {
    // Less than 18 weeks
    warnings.push('HSTS max-age less than 18 weeks may not qualify for preload');
  }

  if (maxAge > 63072000) {
    // More than 2 years
    warnings.push('HSTS max-age over 2 years may be unnecessarily restrictive');
  }

  return {
    valid: maxAge > 0,
    warnings,
  };
}

/* ============================================================================
   CORS Functions
   ============================================================================ */

/**
 * Generate CORS headers from configuration
 * @param config CORS configuration
 * @returns Object with CORS headers
 */
export function generateCORSHeaders(config: CORSConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  // Handle origin
  if (typeof config.origin === 'boolean') {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (typeof config.origin === 'string') {
    headers['Access-Control-Allow-Origin'] = config.origin;
  } else if (Array.isArray(config.origin)) {
    headers['Access-Control-Allow-Origin'] = config.origin[0];
  }

  headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
  headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
  headers['Access-Control-Max-Age'] = config.maxAge.toString();

  if (config.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Validate CORS configuration
 * @param config CORS configuration
 * @returns Validation result
 */
export function validateCORSConfig(config: CORSConfig): SecurityHeaderValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.origin) {
    errors.push('CORS origin is required');
  }

  if (
    config.credentials &&
    typeof config.origin === 'boolean' &&
    config.origin === true
  ) {
    errors.push('Cannot use credentials with wildcard origin');
  }

  if (config.methods.length === 0) {
    errors.push('At least one HTTP method must be specified');
  }

  if (config.maxAge < 0) {
    errors.push('CORS max age must be non-negative');
  }

  if (config.maxAge > 86400) {
    warnings.push('CORS max age over 24 hours may cache stale configuration');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/* ============================================================================
   Nonce Management
   ============================================================================ */

/**
 * Generate a cryptographic nonce for inline scripts/styles
 * @returns Base64-encoded nonce
 *
 * @example
 * const nonce = generateNonce();
 * // "kV3kzJhNc/3aBcD5eF9gH2iJ4kL5mN6oP7qR8sT9uV0w=="
 */
export function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)));
}

/**
 * Create a nonce registry for tracking nonces
 * @returns Empty nonce registry
 */
export function createNonceRegistry(): NonceRegistry {
  return {};
}

/**
 * Register a nonce for a specific context
 * @param registry Nonce registry
 * @param context Context name (e.g., 'styles', 'scripts')
 * @param nonce Nonce value
 */
export function registerNonce(
  registry: NonceRegistry,
  context: string,
  nonce: string
): void {
  registry[context] = nonce;
}

/**
 * Get nonce from registry
 * @param registry Nonce registry
 * @param context Context name
 * @returns Nonce value or undefined
 */
export function getNonce(
  registry: NonceRegistry,
  context: string
): string | undefined {
  return registry[context];
}

/**
 * Validate nonce format (base64)
 * @param nonce Nonce value
 * @returns True if valid format
 */
export function validateNonce(nonce: string): boolean {
  try {
    atob(nonce);
    return /^[A-Za-z0-9+/=]+$/.test(nonce);
  } catch {
    return false;
  }
}

/* ============================================================================
   Security Validation Functions
   ============================================================================ */

/**
 * Validate security headers configuration
 * @param config Security headers configuration
 * @returns Validation result
 */
export function validateSecurityConfig(
  config: SecurityHeadersConfig
): SecurityHeaderValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate CSP
  if (config.csp) {
    if (!config.csp.defaultSrc || config.csp.defaultSrc.length === 0) {
      errors.push('CSP default-src directive is required');
    }

    if (config.csp.objectSrc && config.csp.objectSrc.includes("'none'")) {
      // Good practice, no warning
    } else {
      warnings.push('Consider setting object-src to "none" to prevent embedding attacks');
    }
  } else {
    errors.push('CSP configuration is recommended for security');
  }

  // Validate HSTS
  if (config.hsts) {
    if (config.hsts.maxAge < 0) {
      errors.push('HSTS maxAge must be non-negative');
    }
  } else {
    warnings.push('HSTS header is recommended for production environments');
  }

  // Validate CORS
  if (config.cors) {
    const corsValidation = validateCORSConfig(config.cors);
    if (!corsValidation.valid) {
      errors.push(...corsValidation.errors);
    }
    warnings.push(...corsValidation.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if header value contains dangerous patterns
 * @param headerValue Header value to check
 * @returns Array of security issues found
 */
export function detectSecurityIssues(headerValue: string): string[] {
  const issues: string[] = [];

  if (headerValue.includes("'unsafe-inline'")) {
    issues.push("Detected 'unsafe-inline' - allows inline script/style execution");
  }

  if (headerValue.includes("'unsafe-eval'")) {
    issues.push("Detected 'unsafe-eval' - allows eval() execution");
  }

  if (headerValue.includes('*')) {
    issues.push('Detected wildcard (*) - allows any source');
  }

  if (headerValue.includes('data:')) {
    issues.push('Detected data: URI - allows data URL execution');
  }

  return issues;
}

/* ============================================================================
   Security Audit Functions
   ============================================================================ */

/**
 * Audit security headers in response
 * @param headers Response headers object
 * @returns Security audit result
 */
export function auditSecurityHeaders(
  headers: Record<string, string>
): SecurityAudit {
  const issues: AuditIssue[] = [];
  const missingHeaders: string[] = [];
  let score = 0;

  // Check essential headers
  for (const headerName of ESSENTIAL_SECURITY_HEADERS) {
    const headerValue = headers[headerName.toLowerCase()];

    if (!headerValue) {
      missingHeaders.push(headerName);
      issues.push({
        type: 'critical',
        header: headerName,
        message: `Missing ${headerName} header`,
        recommendation: `Add ${headerName} header to security configuration`,
      });
    } else {
      // Check for dangerous patterns
      const securityIssues = detectSecurityIssues(headerValue);
      if (securityIssues.length > 0) {
        for (const issue of securityIssues) {
          issues.push({
            type: 'warning',
            header: headerName,
            message: issue,
            recommendation: 'Use more restrictive CSP directives',
          });
        }
      }
    }
  }

  // Check recommended headers
  for (const headerName of RECOMMENDED_SECURITY_HEADERS) {
    if (!headers[headerName.toLowerCase()]) {
      issues.push({
        type: 'info',
        header: headerName,
        message: `Missing recommended ${headerName} header`,
        recommendation: `Consider adding ${headerName} header`,
      });
    }
  }

  // Calculate score
  const essentialPresent = ESSENTIAL_SECURITY_HEADERS.filter(
    h => headers[h.toLowerCase()]
  ).length;
  score = Math.round((essentialPresent / ESSENTIAL_SECURITY_HEADERS.length) * 100);

  // Deduct for issues
  const criticalCount = issues.filter(i => i.type === 'critical').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  score -= criticalCount * 10;
  score -= warningCount * 5;
  score = Math.max(0, score);

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  return {
    timestamp: new Date(),
    headers,
    missingHeaders,
    issues,
    score,
    grade,
  };
}

/**
 * Generate security report from audit
 * @param audit Security audit result
 * @returns Formatted report string
 */
export function generateSecurityReport(audit: SecurityAudit): string {
  const lines = [
    `Security Audit Report - ${audit.timestamp.toISOString()}`,
    `Grade: ${audit.grade} (Score: ${audit.score}/100)`,
    '',
    `Missing Headers (${audit.missingHeaders.length}):`,
    ...audit.missingHeaders.map(h => `  - ${h}`),
    '',
    `Issues Found (${audit.issues.length}):`,
    ...audit.issues.map(issue => [
      `  [${issue.type.toUpperCase()}] ${issue.header}`,
      `    Message: ${issue.message}`,
      `    Recommendation: ${issue.recommendation}`,
    ]).flat(),
  ];

  return lines.join('\n');
}

/* ============================================================================
   React Hook for Security Headers
   ============================================================================ */

/**
 * React hook to manage security headers and nonces
 * @param config Security headers configuration
 * @returns Object with headers, nonces, and utilities
 *
 * @example
 * const { headers, nonce, registerNonce } = useSecurityHeaders({
 *   csp: DEFAULT_CSP,
 *   hsts: DEFAULT_HSTS,
 * });
 */
export function useSecurityHeaders(config: SecurityHeadersConfig) {
  // Generate nonce registry
  const nonceRegistry = createNonceRegistry();
  const styleNonce = generateNonce();
  const scriptNonce = generateNonce();

  registerNonce(nonceRegistry, 'styles', styleNonce);
  registerNonce(nonceRegistry, 'scripts', scriptNonce);

  // Build headers object
  const headers: Record<string, string> = {};

  // CSP header
  if (config.csp) {
    const csp = { ...config.csp };
    // Inject nonces into CSP
    if (csp.styleSrc) {
      csp.styleSrc = csp.styleSrc.map(src =>
        src.replace('{nonce}', `'nonce-${styleNonce}'`)
      );
    }
    if (csp.scriptSrc) {
      csp.scriptSrc = [
        ...csp.scriptSrc,
        `'nonce-${scriptNonce}'`,
      ];
    }

    const cspHeader = generateCSP(csp);
    headers[
      config.contentSecurityPolicyReportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy'
    ] = cspHeader;
  }

  // HSTS header
  if (config.hsts) {
    headers['Strict-Transport-Security'] = generateHSTS(config.hsts);
  }

  // CORS headers
  if (config.cors) {
    const corsHeaders = generateCORSHeaders(config.cors);
    Object.assign(headers, corsHeaders);
  }

  // X-Frame-Options
  if (config.xFrameOptions) {
    headers['X-Frame-Options'] = config.xFrameOptions;
  }

  // X-Content-Type-Options
  if (config.xContentTypeOptions) {
    headers['X-Content-Type-Options'] = config.xContentTypeOptions;
  }

  // Referrer-Policy
  if (config.referrerPolicy) {
    headers['Referrer-Policy'] = config.referrerPolicy;
  }

  // Permissions-Policy
  if (config.permissionsPolicy) {
    const policies = Object.entries(config.permissionsPolicy)
      .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
      .join(', ');
    headers['Permissions-Policy'] = policies;
  }

  // X-XSS-Protection
  if (config.xXssProtection) {
    headers['X-XSS-Protection'] = config.xXssProtection;
  }

  return {
    headers,
    nonces: nonceRegistry,
    styleNonce,
    scriptNonce,
    registerNonce: (context: string, nonce: string) =>
      registerNonce(nonceRegistry, context, nonce),
    getNonce: (context: string) => getNonce(nonceRegistry, context),
  };
}

/**
 * Hook to validate and audit current headers
 * @param headers Response headers
 * @returns Security audit result
 */
export function useSecurityAudit(headers: Record<string, string>) {
  return auditSecurityHeaders(headers);
}

/**
 * Hook to check if current origin is secure (HTTPS)
 * @returns True if current origin uses HTTPS
 */
export function useSecureOrigin(): boolean {
  if (typeof window === 'undefined') return true;
  return window.location.protocol === 'https:';
}

/**
 * Hook to validate SubResource Integrity (SRI)
 * @param url Resource URL
 * @param integrity SRI hash
 * @returns Promise resolving to validation result
 */
export async function validateSRI(
  url: string,
  integrity: string
): Promise<boolean> {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    // Extract hash algorithm from integrity
    const [algo, hash] = integrity.split('-');
    const hashBuffer = await crypto.subtle.digest(algo, buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));

    return hashBase64 === hash;
  } catch (error) {
    logError(error, 'SRI validation error');
    return false;
  }
}
