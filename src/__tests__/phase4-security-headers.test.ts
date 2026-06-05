import { describe, it, expect, vi } from 'vitest';
import {
  generateCSP,
  parseCSP,
  generateHSTS,
  validateHSTSMaxAge,
  generateCORSHeaders,
  validateCORSConfig,
  generateNonce,
  createNonceRegistry,
  registerNonce,
  getNonce,
  validateNonce,
  validateSecurityConfig,
  detectSecurityIssues,
  auditSecurityHeaders,
  generateSecurityReport,
  useSecurityHeaders,
  useSecurityAudit,
  useSecureOrigin,
  validateSRI,
  DEFAULT_CSP,
  DEFAULT_HSTS,
  DEFAULT_CORS,
  DEFAULT_PERMISSIONS_POLICY,
  ESSENTIAL_SECURITY_HEADERS,
  RECOMMENDED_SECURITY_HEADERS,
  type CSPDirective,
  type SecurityHeadersConfig,
} from '../lib/securityHeaders';

describe('Security Headers Utilities', () => {
  describe('CSP Functions', () => {
    it('should generate CSP header string', () => {
      const csp = generateCSP({ scriptSrc: ["'self'", "'strict-dynamic'"] });
      expect(csp).toContain("script-src 'self' 'strict-dynamic'");
    });

    it('should handle default-src directive', () => {
      const csp = generateCSP({ defaultSrc: ["'self'"] });
      expect(csp).toContain("default-src 'self'");
    });

    it('should handle multiple directives', () => {
      const csp = generateCSP({
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      });

      expect(csp).toContain('default-src');
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
    });

    it('should handle boolean directives', () => {
      const csp = generateCSP({
        upgradeInsecureRequests: true,
        blockAllMixedContent: true,
      });

      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('block-all-mixed-content');
    });

    it('should exclude false boolean directives', () => {
      const csp = generateCSP({
        upgradeInsecureRequests: false,
      });

      expect(csp).not.toContain('upgrade-insecure-requests');
    });

    it('should replace nonce placeholder', () => {
      const csp = generateCSP(
        { styleSrc: ["'nonce-{nonce}'"] },
        'abc123'
      );

      expect(csp).toContain("'nonce-abc123'");
    });

    it('should handle object-src none', () => {
      const csp = generateCSP({ objectSrc: ["'none'"] });
      expect(csp).toContain("object-src 'none'");
    });

    it('should handle report-uri', () => {
      const csp = generateCSP({ reportUri: '/csp-report' });
      expect(csp).toContain('report-uri /csp-report');
    });

    it('should parse CSP header back', () => {
      const original = "script-src 'self'; style-src 'self'";
      const parsed = parseCSP(original);

      expect(parsed.scriptSrc).toContain("'self'");
      expect(parsed.styleSrc).toContain("'self'");
    });
  });

  describe('HSTS Functions', () => {
    it('should generate HSTS header', () => {
      const hsts = generateHSTS({ maxAge: 31536000 });
      expect(hsts).toBe('max-age=31536000');
    });

    it('should include includeSubDomains', () => {
      const hsts = generateHSTS({
        maxAge: 31536000,
        includeSubDomains: true,
      });

      expect(hsts).toContain('includeSubDomains');
    });

    it('should include preload', () => {
      const hsts = generateHSTS({
        maxAge: 31536000,
        preload: true,
      });

      expect(hsts).toContain('preload');
    });

    it('should include all options', () => {
      const hsts = generateHSTS({
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      });

      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should validate HSTS max age', () => {
      const result = validateHSTSMaxAge(31536000);
      expect(result.valid).toBe(true);
    });

    it('should warn on low max age', () => {
      const result = validateHSTSMaxAge(1000000);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on high max age', () => {
      const result = validateHSTSMaxAge(100000000);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject negative max age', () => {
      const result = validateHSTSMaxAge(-1000);
      expect(result.valid).toBe(false);
    });
  });

  describe('CORS Functions', () => {
    it('should generate CORS headers', () => {
      const headers = generateCORSHeaders(DEFAULT_CORS);

      expect(headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(headers['Access-Control-Allow-Headers']).toBeDefined();
    });

    it('should handle array origins', () => {
      const headers = generateCORSHeaders({
        ...DEFAULT_CORS,
        origin: ['https://example.com', 'https://test.com'],
      });

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    });

    it('should handle wildcard origin', () => {
      const headers = generateCORSHeaders({
        ...DEFAULT_CORS,
        origin: true,
      });

      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should include credentials header when enabled', () => {
      const headers = generateCORSHeaders({
        ...DEFAULT_CORS,
        credentials: true,
      });

      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should set max age', () => {
      const headers = generateCORSHeaders({
        ...DEFAULT_CORS,
        maxAge: 3600,
      });

      expect(headers['Access-Control-Max-Age']).toBe('3600');
    });

    it('should validate CORS config', () => {
      const result = validateCORSConfig(DEFAULT_CORS);
      expect(result.valid).toBe(true);
    });

    it('should error on missing origin', () => {
      const result = validateCORSConfig({
        ...DEFAULT_CORS,
        origin: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error on credentials with wildcard', () => {
      const result = validateCORSConfig({
        ...DEFAULT_CORS,
        origin: true,
        credentials: true,
      });

      expect(result.valid).toBe(false);
    });

    it('should error on empty methods', () => {
      const result = validateCORSConfig({
        ...DEFAULT_CORS,
        methods: [],
      });

      expect(result.valid).toBe(false);
    });

    it('should warn on high max age', () => {
      const result = validateCORSConfig({
        ...DEFAULT_CORS,
        maxAge: 1000000,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Nonce Management', () => {
    it('should generate nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toBeDefined();
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate different nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it('should create nonce registry', () => {
      const registry = createNonceRegistry();
      expect(registry).toEqual({});
    });

    it('should register nonce', () => {
      const registry = createNonceRegistry();
      const nonce = generateNonce();

      registerNonce(registry, 'styles', nonce);
      expect(registry['styles']).toBe(nonce);
    });

    it('should get nonce from registry', () => {
      const registry = createNonceRegistry();
      const nonce = generateNonce();

      registerNonce(registry, 'scripts', nonce);
      const retrieved = getNonce(registry, 'scripts');

      expect(retrieved).toBe(nonce);
    });

    it('should return undefined for missing nonce', () => {
      const registry = createNonceRegistry();
      const nonce = getNonce(registry, 'nonexistent');

      expect(nonce).toBeUndefined();
    });

    it('should validate nonce format', () => {
      const validNonce = generateNonce();
      expect(validateNonce(validNonce)).toBe(true);
    });

    it('should reject invalid nonce', () => {
      expect(validateNonce('invalid@#$%')).toBe(false);
      expect(validateNonce('')).toBe(false);
    });
  });

  describe('Security Detection', () => {
    it('should detect unsafe-inline', () => {
      const issues = detectSecurityIssues("script-src 'unsafe-inline'");
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('unsafe-inline');
    });

    it('should detect unsafe-eval', () => {
      const issues = detectSecurityIssues("script-src 'unsafe-eval'");
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('unsafe-eval');
    });

    it('should detect wildcard', () => {
      const issues = detectSecurityIssues("script-src *");
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should detect data: URI', () => {
      const issues = detectSecurityIssues("script-src data:");
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should accept safe CSP', () => {
      const issues = detectSecurityIssues("script-src 'self'");
      expect(issues.length).toBe(0);
    });
  });

  describe('Security Validation', () => {
    it('should validate secure config', () => {
      const result = validateSecurityConfig({
        csp: DEFAULT_CSP,
        hsts: DEFAULT_HSTS,
      });

      expect(result.valid).toBe(true);
    });

    it('should error on missing CSP', () => {
      const result = validateSecurityConfig({});
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error on missing default-src', () => {
      const result = validateSecurityConfig({
        csp: { scriptSrc: ["'self'"] },
      });

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on missing object-src none', () => {
      const result = validateSecurityConfig({
        csp: {
          defaultSrc: ["'self'"],
          objectSrc: ["'self'"],
        },
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Security Audit', () => {
    it('should audit security headers', () => {
      const headers = {
        'content-security-policy': generateCSP(DEFAULT_CSP),
        'strict-transport-security': generateHSTS(DEFAULT_HSTS),
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
      };

      const audit = auditSecurityHeaders(headers);

      expect(audit.grade).toBeDefined();
      expect(audit.score).toBeGreaterThan(0);
      expect(audit.issues).toBeDefined();
    });

    it('should detect missing headers', () => {
      const headers = {
        'content-security-policy': generateCSP(DEFAULT_CSP),
      };

      const audit = auditSecurityHeaders(headers);

      expect(audit.missingHeaders.length).toBeGreaterThan(0);
    });

    it('should grade A with all headers', () => {
      const headers = {
        'content-security-policy': generateCSP(DEFAULT_CSP),
        'strict-transport-security': generateHSTS(DEFAULT_HSTS),
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
      };

      const audit = auditSecurityHeaders(headers);

      expect(audit.grade).toBe('A');
      expect(audit.score).toBeGreaterThanOrEqual(90);
    });

    it('should grade F with no headers', () => {
      const audit = auditSecurityHeaders({});
      expect(audit.grade).toBe('F');
    });

    it('should generate security report', () => {
      const headers = {
        'content-security-policy': generateCSP(DEFAULT_CSP),
      };

      const audit = auditSecurityHeaders(headers);
      const report = generateSecurityReport(audit);

      expect(report).toContain('Security Audit Report');
      expect(report).toContain(audit.grade);
      expect(report).toContain(`${audit.score}/100`);
    });
  });

  describe('React Hooks', () => {
    it('should use security headers', () => {
      const result = useSecurityHeaders({
        csp: DEFAULT_CSP,
        hsts: DEFAULT_HSTS,
      });

      expect(result.headers).toBeDefined();
      expect(result.nonces).toBeDefined();
      expect(result.styleNonce).toBeDefined();
      expect(result.scriptNonce).toBeDefined();
    });

    it('should generate CSP header from config', () => {
      const result = useSecurityHeaders({
        csp: DEFAULT_CSP,
      });

      const cspHeader = result.headers['Content-Security-Policy'];
      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain('default-src');
    });

    it('should include nonces in CSP', () => {
      const result = useSecurityHeaders({
        csp: DEFAULT_CSP,
      });

      const cspHeader = result.headers['Content-Security-Policy'];
      expect(cspHeader).toContain(`'nonce-${result.styleNonce}'`);
    });

    it('should generate HSTS header', () => {
      const result = useSecurityHeaders({
        hsts: DEFAULT_HSTS,
      });

      expect(result.headers['Strict-Transport-Security']).toBeDefined();
    });

    it('should include CORS headers', () => {
      const result = useSecurityHeaders({
        cors: DEFAULT_CORS,
      });

      expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(result.headers['Access-Control-Allow-Methods']).toBeDefined();
    });

    it('should set X-Frame-Options', () => {
      const result = useSecurityHeaders({
        xFrameOptions: 'SAMEORIGIN',
      });

      expect(result.headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should set X-Content-Type-Options', () => {
      const result = useSecurityHeaders({
        xContentTypeOptions: 'nosniff',
      });

      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should set Referrer-Policy', () => {
      const result = useSecurityHeaders({
        referrerPolicy: 'strict-origin-when-cross-origin',
      });

      expect(result.headers['Referrer-Policy']).toBe(
        'strict-origin-when-cross-origin'
      );
    });

    it('should use CSP Report-Only mode', () => {
      const result = useSecurityHeaders({
        csp: DEFAULT_CSP,
        contentSecurityPolicyReportOnly: true,
      });

      expect(
        result.headers['Content-Security-Policy-Report-Only']
      ).toBeDefined();
      expect(result.headers['Content-Security-Policy']).toBeUndefined();
    });

    it('should manage nonce registry', () => {
      const result = useSecurityHeaders({});

      expect(result.getNonce('styles')).toBe(result.styleNonce);
      expect(result.getNonce('scripts')).toBe(result.scriptNonce);

      const newNonce = generateNonce();
      result.registerNonce('custom', newNonce);
      expect(result.getNonce('custom')).toBe(newNonce);
    });

    it('should audit current headers', () => {
      const headers = {
        'content-security-policy': generateCSP(DEFAULT_CSP),
        'strict-transport-security': generateHSTS(DEFAULT_HSTS),
      };

      const audit = useSecurityAudit(headers);

      expect(audit.timestamp).toBeInstanceOf(Date);
      expect(audit.grade).toBeDefined();
      expect(audit.score).toBeGreaterThanOrEqual(0);
    });

    it('should check secure origin in browser', () => {
      // In Node.js test environment, this should return true by default
      const isSecure = useSecureOrigin();
      expect(typeof isSecure).toBe('boolean');
    });
  });

  describe('Constants & Defaults', () => {
    it('should have default CSP', () => {
      expect(DEFAULT_CSP.defaultSrc).toBeDefined();
      expect(DEFAULT_CSP.defaultSrc?.length).toBeGreaterThan(0);
    });

    it('should have default HSTS', () => {
      expect(DEFAULT_HSTS.maxAge).toBeGreaterThan(0);
      expect(typeof DEFAULT_HSTS.includeSubDomains).toBe('boolean');
    });

    it('should have default CORS', () => {
      expect(DEFAULT_CORS.origin).toBeDefined();
      expect(DEFAULT_CORS.methods.length).toBeGreaterThan(0);
    });

    it('should have default Permissions Policy', () => {
      expect(Object.keys(DEFAULT_PERMISSIONS_POLICY).length).toBeGreaterThan(0);
    });

    it('should define essential headers list', () => {
      expect(ESSENTIAL_SECURITY_HEADERS.length).toBeGreaterThan(0);
      expect(ESSENTIAL_SECURITY_HEADERS).toContain('Content-Security-Policy');
    });

    it('should define recommended headers list', () => {
      expect(RECOMMENDED_SECURITY_HEADERS.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should create production security config', () => {
      const config: SecurityHeadersConfig = {
        csp: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'strict-dynamic'"],
          styleSrc: ["'self'", "'nonce-{nonce}'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: true,
          blockAllMixedContent: true,
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff',
        referrerPolicy: 'strict-origin-when-cross-origin',
      };

      const result = useSecurityHeaders(config);

      expect(result.headers['Content-Security-Policy']).toBeDefined();
      expect(result.headers['Strict-Transport-Security']).toBeDefined();
      expect(result.headers['X-Frame-Options']).toBe('DENY');
    });

    it('should audit strict security headers', () => {
      const strictHeaders = {
        'content-security-policy':
          "default-src 'self'; script-src 'self' 'strict-dynamic'; object-src 'none'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
      };

      const audit = auditSecurityHeaders(strictHeaders);
      expect(audit.grade).toMatch(/[AB]/);
    });

    it('should detect legacy insecure patterns', () => {
      const insecureHeader =
        "script-src 'unsafe-inline' 'unsafe-eval' * data:";
      const issues = detectSecurityIssues(insecureHeader);

      expect(issues.length).toBeGreaterThanOrEqual(4);
    });
  });
});
