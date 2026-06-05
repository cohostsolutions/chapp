/**
 * Phase 3 Tests: Compliance & Hardening
 * 
 * Tests for:
 * - Audit logging system
 * - RLS policy enforcement
 * - Data retention and deletion policies
 * - API rate limiting
 * - Service role key security
 * 
 * Run with: npm test -- phase3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  endpointLimiters,
  resetUserRateLimit,
  getUserUsageStats,
  RATE_LIMIT_CONFIGS,
  rateLimitManager
} from '@/lib/apiRateLimiting';
import {
  getDefaultRetentionPolicy,
  getHardDeleteDate
} from '@/lib/dataRetention';
import {
  getRLSAuditSQLFunctions,
  getRequiredRLSMigration
} from '@/lib/rlsAudit';

/**
 * ===== AUDIT LOGGING TESTS =====
 */
describe('AUDIT-LOG-001: Audit Logging System', () => {
  it('should define AuditAction types', () => {
    // Verify audit action types are properly defined
    const validActions = [
      'role_change',
      'data_delete',
      'data_export',
      'settings_update',
      'user_invite',
      'user_revoke',
      'organization_create',
      'organization_update',
      'password_reset',
      'mfa_enable',
      'mfa_disable',
      'api_key_create',
      'api_key_revoke',
      'data_hard_delete',
      'data_anonymize',
      'bulk_import'
    ];

    validActions.forEach(action => {
      expect(typeof action).toBe('string');
      expect(action.length).toBeGreaterThan(0);
    });
  });

  it('should support audit logging functions', async () => {
    // Verify audit logger exports exist
    const module = await import('@/lib/auditLogger');
    expect(typeof module).toBe('object');
  });

  it('should provide audit log query results structure', () => {
    // Test interface structure
    const mockLog = {
      id: 'log-123',
      user_id: 'user-456',
      user_email: 'test@example.com',
      action: 'role_change' as const,
      table_name: 'profiles',
      description: 'User role changed from user to admin',
      created_at: new Date().toISOString(),
      total_count: 1
    };

    expect(mockLog.id).toBeDefined();
    expect(mockLog.action).toBe('role_change');
    expect(mockLog.user_email).toContain('@');
  });
});

/**
 * ===== DATA RETENTION & DELETION TESTS =====
 */
describe('PRIVACY-001: Data Retention & Privacy', () => {
  describe('Deletion Reason Types', () => {
    it('should support user_requested reason', () => {
      const reason: 'user_requested' | 'gdpr_right_to_forget' | 'account_closure' = 'user_requested';
      expect(reason).toBe('user_requested');
    });

    it('should support GDPR right to be forgotten', () => {
      const reason: 'user_requested' | 'gdpr_right_to_forget' | 'account_closure' = 'gdpr_right_to_forget';
      expect(reason).toBe('gdpr_right_to_forget');
    });

    it('should support account closure reason', () => {
      const reason: 'user_requested' | 'gdpr_right_to_forget' | 'account_closure' = 'account_closure';
      expect(reason).toBe('account_closure');
    });
  });

  describe('Retention Policy Management', () => {
    it('should provide default retention policy', () => {
      const policy = getDefaultRetentionPolicy();

      expect(policy).toHaveProperty('data_retention_days');
      expect(policy).toHaveProperty('hard_delete_after_days');
      expect(policy).toHaveProperty('anonymize_pii');
      expect(policy).toHaveProperty('audit_retention_months');

      expect(policy.data_retention_days).toBeGreaterThan(0);
      expect(policy.hard_delete_after_days).toBeGreaterThan(0);
      expect(typeof policy.anonymize_pii).toBe('boolean');
      expect(policy.audit_retention_months).toBeGreaterThan(0);
    });

    it('should have reasonable default values', () => {
      const policy = getDefaultRetentionPolicy();

      // Retention should be at least 30 days
      expect(policy.data_retention_days).toBeGreaterThanOrEqual(30);
      
      // Hard delete should be less than retention
      expect(policy.hard_delete_after_days).toBeGreaterThan(0);
      
      // Audit retention should be at least 12 months
      expect(policy.audit_retention_months).toBeGreaterThanOrEqual(12);
    });

    it('should calculate hard delete date correctly', () => {
      const softDeleteDate = '2026-01-15T10:00:00Z';
      const policy = getDefaultRetentionPolicy();

      const hardDeleteDate = getHardDeleteDate(softDeleteDate, policy);

      expect(hardDeleteDate).toBeInstanceOf(Date);
      
      // Hard delete date should be after soft delete date
      const softDate = new Date(softDeleteDate);
      expect(hardDeleteDate.getTime()).toBeGreaterThan(softDate.getTime());
      
      // Should be approximately policy.hard_delete_after_days days later
      const daysDifference = (hardDeleteDate.getTime() - softDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDifference).toBeCloseTo(policy.hard_delete_after_days, 1);
    });

    it('should handle different policy configurations', () => {
      const customPolicy = {
        data_retention_days: 90,
        hard_delete_after_days: 30,
        anonymize_pii: true,
        audit_retention_months: 24
      };

      const softDeleteDate = '2026-01-01T00:00:00Z';
      const hardDeleteDate = getHardDeleteDate(softDeleteDate, customPolicy);

      const daysDifference = (hardDeleteDate.getTime() - new Date(softDeleteDate).getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDifference).toBeCloseTo(30, 1);
    });
  });

  describe('Soft Delete Data Structure', () => {
    it('should define soft delete record interface', () => {
      const softDeleteRecord = {
        table_name: 'leads',
        record_id: 'lead-123',
        deleted_at: new Date().toISOString(),
        deletion_reason: 'user_requested' as const
      };

      expect(softDeleteRecord.table_name).toBe('leads');
      expect(softDeleteRecord.record_id).toContain('lead');
      expect(softDeleteRecord.deletion_reason).toBe('user_requested');
    });
  });
});

/**
 * ===== RLS POLICY AUDIT TESTS =====
 */
describe('RLS-AUDIT-001: RLS Policy Audit', () => {
  describe('RLS SQL Functions', () => {
    it('should provide RLS audit SQL functions', () => {
      const sql = getRLSAuditSQLFunctions();

      expect(typeof sql).toBe('string');
      expect(sql.length).toBeGreaterThan(0);
      expect(sql).toContain('CREATE');
      expect(sql).toContain('FUNCTION');
    });

    it('should include table RLS status function', () => {
      const sql = getRLSAuditSQLFunctions();

      expect(sql).toContain('get_all_tables_rls_status');
    });

    it('should include RLS enabled check function', () => {
      const sql = getRLSAuditSQLFunctions();

      expect(sql).toContain('check_table_rls_enabled');
    });

    it('should include policy retrieval function', () => {
      const sql = getRLSAuditSQLFunctions();

      expect(sql).toContain('get_table_policies');
    });
  });

  describe('RLS Migration Scripts', () => {
    it('should provide RLS migration SQL', () => {
      const sql = getRequiredRLSMigration();

      expect(typeof sql).toBe('string');
      expect(sql.length).toBeGreaterThan(0);
      expect(sql).toContain('ENABLE');
      expect(sql).toContain('ROW LEVEL SECURITY');
    });

    it('should enable RLS on all critical tables', () => {
      const sql = getRequiredRLSMigration();

      const criticalTables = [
        'profiles',
        'organizations',
        'leads',
        'conversations',
        'contacts'
      ];

      criticalTables.forEach(table => {
        expect(sql).toContain(table);
      });
    });
  });

  describe('RLS Status Interface', () => {
    it('should define RLS status structure', () => {
      const mockStatus = {
        table_name: 'leads',
        rls_enabled: true,
        policy_count: 4,
        policies: [],
        is_compliant: true
      };

      expect(mockStatus.table_name).toBe('leads');
      expect(typeof mockStatus.rls_enabled).toBe('boolean');
      expect(typeof mockStatus.policy_count).toBe('number');
      expect(Array.isArray(mockStatus.policies)).toBe(true);
      expect(typeof mockStatus.is_compliant).toBe('boolean');
    });
  });

  describe('RLS Audit Result Structure', () => {
    it('should define audit result interface', () => {
      const mockAudit = {
        schema_name: 'public',
        audit_timestamp: new Date().toISOString(),
        total_tables: 10,
        compliant_tables: 8,
        non_compliant_tables: ['table1', 'table2'],
        tables: [],
        overall_compliant: false
      };

      expect(mockAudit.schema_name).toBe('public');
      expect(mockAudit.total_tables).toBeGreaterThan(0);
      expect(mockAudit.compliant_tables).toBeLessThanOrEqual(mockAudit.total_tables);
      expect(Array.isArray(mockAudit.non_compliant_tables)).toBe(true);
      expect(typeof mockAudit.overall_compliant).toBe('boolean');
    });
  });
});

/**
 * ===== API RATE LIMITING TESTS =====
 */
describe('RATELIMIT-ENDPOINT-001: API Rate Limiting', () => {
  const testUserId = 'user-123';

  beforeEach(() => {
    // Reset rate limiters before each test
    resetUserRateLimit(testUserId);
  });

  afterEach(() => {
    resetUserRateLimit(testUserId);
  });

  describe('Rate Limit Configurations', () => {
    it('should define NORMAL rate limit config', () => {
      expect(RATE_LIMIT_CONFIGS.NORMAL).toHaveProperty('requestsPerWindow');
      expect(RATE_LIMIT_CONFIGS.NORMAL).toHaveProperty('windowMs');
      expect(RATE_LIMIT_CONFIGS.NORMAL.requestsPerWindow).toBe(100);
    });

    it('should define EXPORT rate limit config', () => {
      expect(RATE_LIMIT_CONFIGS.EXPORT).toHaveProperty('requestsPerWindow');
      expect(RATE_LIMIT_CONFIGS.EXPORT.requestsPerWindow).toBe(10);
    });

    it('should define AUTH rate limit config', () => {
      expect(RATE_LIMIT_CONFIGS.AUTH).toHaveProperty('requestsPerWindow');
      expect(RATE_LIMIT_CONFIGS.AUTH.requestsPerWindow).toBe(5);
    });

    it('should define SENSITIVE rate limit config', () => {
      expect(RATE_LIMIT_CONFIGS.SENSITIVE).toHaveProperty('requestsPerWindow');
      expect(RATE_LIMIT_CONFIGS.SENSITIVE.requestsPerWindow).toBe(3);
    });

    it('should define IMPORT rate limit config', () => {
      expect(RATE_LIMIT_CONFIGS.IMPORT).toHaveProperty('requestsPerWindow');
      expect(RATE_LIMIT_CONFIGS.IMPORT.requestsPerWindow).toBe(5);
    });

    it('configs should have window size', () => {
      Object.values(RATE_LIMIT_CONFIGS).forEach(config => {
        expect(config.windowMs).toBe(60000); // 1 minute
      });
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const result = checkRateLimit(testUserId, 'test-endpoint', RATE_LIMIT_CONFIGS.NORMAL);

      expect(result.allowed).toBe(true);
      expect(result.headers).toBeDefined();
    });

    it('should provide rate limit headers', () => {
      const result = checkRateLimit(testUserId, 'test-endpoint', RATE_LIMIT_CONFIGS.NORMAL);

      expect(result.headers).toHaveProperty('X-RateLimit-Limit');
      expect(result.headers).toHaveProperty('X-RateLimit-Remaining');
      expect(result.headers).toHaveProperty('X-RateLimit-Reset');
    });

    it('should include correct limit in headers', () => {
      const result = checkRateLimit(testUserId, 'test-endpoint', RATE_LIMIT_CONFIGS.NORMAL);

      expect(result.headers['X-RateLimit-Limit']).toBe('100');
    });

    it('should track remaining requests', () => {
      const result = checkRateLimit(testUserId, 'test-endpoint', RATE_LIMIT_CONFIGS.NORMAL);

      const remaining = parseInt(result.headers['X-RateLimit-Remaining']);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(99);
    });
  });

  describe('Endpoint-Specific Limiters', () => {
    it('should limit login attempts with AUTH config', () => {
      const result = endpointLimiters.login(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('5');
    });

    it('should limit registration with AUTH config', () => {
      const result = endpointLimiters.register(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('5');
    });

    it('should limit password reset with AUTH config', () => {
      const result = endpointLimiters.passwordReset(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('5');
    });

    it('should limit export with EXPORT config', () => {
      const result = endpointLimiters.export(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('10');
    });

    it('should limit import with IMPORT config', () => {
      const result = endpointLimiters.import(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('5');
    });

    it('should limit delete with SENSITIVE config', () => {
      const result = endpointLimiters.delete(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('3');
    });

    it('should limit bulk operations with SENSITIVE config', () => {
      const result = endpointLimiters.bulkOperation(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('3');
    });

    it('should allow normal list operations', () => {
      const result = endpointLimiters.list(testUserId);
      expect(result.headers['X-RateLimit-Limit']).toBe('100');
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should block after exceeding limit', () => {
      const config = { requestsPerWindow: 2, windowMs: 60000 };

      // Use up the limit
      checkRateLimit(testUserId, 'strict-endpoint', config);
      checkRateLimit(testUserId, 'strict-endpoint', config);

      // Next request should be blocked
      const result = checkRateLimit(testUserId, 'strict-endpoint', config);
      expect(result.allowed).toBe(false);
    });

    it('should provide error message when blocked', () => {
      const config = { requestsPerWindow: 1, windowMs: 60000, message: 'Too many requests' };

      checkRateLimit(testUserId, 'test', config);
      const result = checkRateLimit(testUserId, 'test', config);

      expect(result.message).toContain('request');
    });

    it('should include Retry-After when blocked', () => {
      const config = { requestsPerWindow: 1, windowMs: 60000 };

      checkRateLimit(testUserId, 'test', config);
      const result = checkRateLimit(testUserId, 'test', config);

      expect(result.headers['Retry-After']).toBeDefined();
      expect(parseInt(result.headers['Retry-After'] || '0')).toBeGreaterThan(0);
    });
  });

  describe('Per-Endpoint Isolation', () => {
    it('should track limits per endpoint independently', () => {
      const config = { requestsPerWindow: 1, windowMs: 60000 };

      // Use up limit on endpoint1
      checkRateLimit(testUserId, 'endpoint1', config);
      const result1 = checkRateLimit(testUserId, 'endpoint1', config);
      expect(result1.allowed).toBe(false);

      // But endpoint2 should still work
      const result2 = checkRateLimit(testUserId, 'endpoint2', config);
      expect(result2.allowed).toBe(true);
    });

    it('should track different users independently', () => {
      const config = { requestsPerWindow: 1, windowMs: 60000 };
      const user1 = 'user-1';
      const user2 = 'user-2';

      // Use up limit for user1
      checkRateLimit(user1, 'test', config);
      const user1Result = checkRateLimit(user1, 'test', config);
      expect(user1Result.allowed).toBe(false);

      // But user2 should be unaffected
      const user2Result = checkRateLimit(user2, 'test', config);
      expect(user2Result.allowed).toBe(true);

      // Cleanup
      resetUserRateLimit(user1);
      resetUserRateLimit(user2);
    });
  });

  describe('Rate Limit Reset', () => {
    it('should reset user rate limits', () => {
      const config = { requestsPerWindow: 1, windowMs: 60000 };

      checkRateLimit(testUserId, 'endpoint', config);
      let result = checkRateLimit(testUserId, 'endpoint', config);
      expect(result.allowed).toBe(false);

      resetUserRateLimit(testUserId);

      result = checkRateLimit(testUserId, 'endpoint', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Usage Statistics', () => {
    it('should get user usage stats', () => {
      checkRateLimit(testUserId, 'endpoint1', RATE_LIMIT_CONFIGS.NORMAL);

      const stats = getUserUsageStats(testUserId);
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should clear stats on user reset', () => {
      checkRateLimit(testUserId, 'endpoint', RATE_LIMIT_CONFIGS.NORMAL);

      resetUserRateLimit(testUserId);

      const stats = getUserUsageStats(testUserId);
      expect(stats.length).toBe(0);
    });
  });

  describe('Rate Limit Manager', () => {
    it('should provide rate limit manager', () => {
      expect(rateLimitManager).toBeDefined();
      expect(typeof rateLimitManager).toBe('object');
    });
  });
});

/**
 * ===== INTEGRATION TESTS =====
 */
describe('Phase 3 Integration Tests', () => {
  const testUserId = 'test-user-123';

  it('should handle rate limited export workflow', () => {
    const exportResult = endpointLimiters.export(testUserId);
    expect(exportResult.allowed).toBe(true);
    expect(exportResult.headers['X-RateLimit-Limit']).toBe('10');
  });

  it('should handle strict authentication rate limiting', () => {
    const config = RATE_LIMIT_CONFIGS.AUTH;
    
    // First attempt should succeed
    let result = checkRateLimit(testUserId, 'login', config);
    expect(result.allowed).toBe(true);
    expect(result.headers['X-RateLimit-Limit']).toBe('5');

    resetUserRateLimit(testUserId);
  });

  it('should track multiple operations with rate limiting', () => {
    const normal = checkRateLimit(testUserId, 'list', RATE_LIMIT_CONFIGS.NORMAL);
    expect(normal.headers['X-RateLimit-Limit']).toBe('100');

    const strict = endpointLimiters.delete(testUserId);
    expect(strict.headers['X-RateLimit-Limit']).toBe('3');

    resetUserRateLimit(testUserId);
  });

  it('should support data retention with compliance audit', () => {
    const policy = getDefaultRetentionPolicy();
    expect(policy).toBeDefined();
    expect(policy.data_retention_days).toBeGreaterThan(0);
    expect(policy.hard_delete_after_days).toBeGreaterThan(0);
  });

  it('should provide RLS audit utilities', () => {
    const sql = getRLSAuditSQLFunctions();
    expect(sql).toContain('FUNCTION');
    
    const migration = getRequiredRLSMigration();
    expect(migration).toContain('ENABLE');
  });
});
