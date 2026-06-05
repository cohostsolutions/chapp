import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_ENCRYPTION_CONFIG,
  generateSalt,
  generateIV,
  deriveKey,
  encryptSecret,
  decryptSecret,
  rotateCredentialKey,
  createCredentialStore,
  addCredential,
  getCredential,
  updateCredential,
  rotateCredential,
  deleteCredential,
  addAuditEntry,
  validateCredentialRecord,
  auditStore,
  filterAuditByAction,
  redactAuditLog,
  summarizeStore,
  verifyPassphrase,
  sanitizeName,
  exportCredential,
  importCredential,
  hashSecret,
  generateKeyCheckValue,
  isStrongPassphrase,
  validateRecordIntegrity,
  summarizeConfig,
  calculateEntropy,
  CredentialRecord,
} from '../lib/encryptedCredentials';

const PASSPHRASE = 'CorrectHorseBatteryStaple!1';

describe('Encrypted Credentials Utilities', () => {
  describe('Random generation', () => {
    it('should generate salts of correct length', () => {
      const salt = generateSalt();
      const decoded = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
      expect(decoded.byteLength).toBe(DEFAULT_ENCRYPTION_CONFIG.saltLength);
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });

    it('should generate IVs of correct length', () => {
      const iv = generateIV();
      const decoded = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      expect(decoded.byteLength).toBe(DEFAULT_ENCRYPTION_CONFIG.ivLength);
    });

    it('should generate unique IVs', () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      expect(iv1).not.toBe(iv2);
    });
  });

  describe('Key derivation', () => {
    it('should derive a key with PBKDF2', async () => {
      const salt = generateSalt();
      const key = await deriveKey(PASSPHRASE, salt);
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should produce different keys for different salts', async () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const key1 = await deriveKey(PASSPHRASE, salt1);
      const key2 = await deriveKey(PASSPHRASE, salt2);

      // Encrypt same plaintext with same IV; ciphertext should differ with different salts/keys
      const iv = Uint8Array.from(atob(generateIV()), c => c.charCodeAt(0));
      const data = new TextEncoder().encode('diff-test');

      const ct1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        data
      );
      const ct2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key2,
        data
      );

      const toB64 = (buf: ArrayBuffer) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)));
      expect(toB64(ct1)).not.toBe(toB64(ct2));
    });
  });

  describe('Encryption & Decryption', () => {
    it('should encrypt and decrypt a secret', async () => {
      const record = await encryptSecret('top-secret', PASSPHRASE, 'api_key');
      const plaintext = await decryptSecret(record, PASSPHRASE);
      expect(plaintext).toBe('top-secret');
    });

    it('should use different IVs for same secret', async () => {
      const record1 = await encryptSecret('same', PASSPHRASE);
      const record2 = await encryptSecret('same', PASSPHRASE);
      expect(record1.iv).not.toBe(record2.iv);
      expect(record1.encryptedValue).not.toBe(record2.encryptedValue);
    });

    it('should fail decryption with wrong passphrase', async () => {
      const record = await encryptSecret('secret', PASSPHRASE);
      await expect(decryptSecret(record, 'wrong-pass')).rejects.toThrow();
    });

    it('should include metadata fields', async () => {
      const record = await encryptSecret('secret', PASSPHRASE, 'db_password');
      expect(record.createdAt).toBeDefined();
      expect(record.name).toBe('db_password');
      expect(record.version).toBe(1);
      expect(record.algorithm).toBe('AES-GCM');
    });
  });

  describe('Key rotation', () => {
    it('should rotate key and preserve id', async () => {
      const record = await encryptSecret('rotate-me', PASSPHRASE, 'service');
      const rotated = await rotateCredentialKey(
        record,
        PASSPHRASE,
        'NewPassphrase!234'
      );

      expect(rotated.id).toBe(record.id);
      expect(rotated.version).toBe((record.version ?? 1) + 1);
      const value = await decryptSecret(rotated, 'NewPassphrase!234');
      expect(value).toBe('rotate-me');
    });

    it('should fail rotation with wrong old passphrase', async () => {
      const record = await encryptSecret('rotate-me', PASSPHRASE);
      await expect(
        rotateCredentialKey(record, 'wrong-pass', 'new-pass')
      ).rejects.toThrow();
    });
  });

  describe('Credential store', () => {
    let store = createCredentialStore();

    beforeEach(() => {
      store = createCredentialStore();
    });

    it('should create empty store', () => {
      expect(store.records.length).toBe(0);
      expect(store.auditLog.length).toBe(0);
    });

    it('should add credential and audit entry', async () => {
      const record = await addCredential(
        store,
        'api_key',
        'value123',
        PASSPHRASE
      );

      expect(store.records.length).toBe(1);
      expect(record.name).toBe('api_key');
      expect(store.auditLog.length).toBe(1);
      expect(store.auditLog[0].action).toBe('create');
    });

    it('should read credential value', async () => {
      const record = await addCredential(store, 'secret', 'abc', PASSPHRASE);
      const value = await getCredential(store, record.id, PASSPHRASE);
      expect(value).toBe('abc');
      expect(store.auditLog.some(e => e.action === 'read')).toBe(true);
    });

    it('should return null for missing credential', async () => {
      const value = await getCredential(store, 'missing', PASSPHRASE);
      expect(value).toBeNull();
    });

    it('should update credential and increment version', async () => {
      const record = await addCredential(store, 'token', 'old', PASSPHRASE);
      const updated = await updateCredential(store, record.id, 'new', PASSPHRASE);

      expect(updated?.version).toBe(2);
      const value = await decryptSecret(updated!, PASSPHRASE);
      expect(value).toBe('new');
      expect(store.auditLog.some(e => e.action === 'update')).toBe(true);
    });

    it('should rotate credential and keep id', async () => {
      const record = await addCredential(store, 'token', 'keep', PASSPHRASE);
      const rotated = await rotateCredential(
        store,
        record.id,
        PASSPHRASE,
        'AnotherPass!23'
      );

      expect(rotated?.id).toBe(record.id);
      const value = await decryptSecret(rotated!, 'AnotherPass!23');
      expect(value).toBe('keep');
      expect(store.auditLog.some(e => e.action === 'rotate')).toBe(true);
    });

    it('should delete credential', async () => {
      const record = await addCredential(store, 'token', 'delete-me', PASSPHRASE);
      const deleted = deleteCredential(store, record.id);
      expect(deleted).toBe(true);
      expect(store.records.length).toBe(0);
      expect(store.auditLog.some(e => e.action === 'delete')).toBe(true);
    });

    it('should not delete missing credential', () => {
      const deleted = deleteCredential(store, 'missing');
      expect(deleted).toBe(false);
    });
  });

  describe('Audit logging', () => {
    let store = createCredentialStore();

    beforeEach(() => {
      store = createCredentialStore();
    });

    it('should add audit entry', () => {
      const entry = addAuditEntry(store, {
        action: 'create',
        credentialId: '123',
        actor: 'tester',
      });

      expect(entry.id).toBeDefined();
      expect(store.auditLog.length).toBe(1);
    });

    it('should filter audit by action', () => {
      addAuditEntry(store, { action: 'create', credentialId: '1' });
      addAuditEntry(store, { action: 'read', credentialId: '1' });
      const reads = filterAuditByAction(store, 'read');
      expect(reads.length).toBe(1);
    });

    it('should redact audit metadata', () => {
      addAuditEntry(store, {
        action: 'create',
        credentialId: '1',
        metadata: { info: 'sensitive' },
      });

      const redacted = redactAuditLog(store);
      expect(redacted[0].metadata).toEqual({});
    });

    it('should summarize store', async () => {
      await addCredential(store, 'a', '1', PASSPHRASE);
      await addCredential(store, 'b', '2', PASSPHRASE);
      const summary = summarizeStore(store);
      expect(summary.totalCredentials).toBe(2);
      expect(summary.auditCount).toBe(2);
    });
  });

  describe('Validation & integrity', () => {
    it('should validate credential record', async () => {
      const record = await encryptSecret('validate', PASSPHRASE, 'name');
      const result = validateCredentialRecord(record);
      expect(result.valid).toBe(true);
    });

    it('should catch missing fields', () => {
      const invalid = {
        id: '',
        name: '',
        encryptedValue: '',
        iv: '',
        salt: '',
        createdAt: '',
        algorithm: 'AES-GCM',
      } as CredentialRecord;

      const result = validateCredentialRecord(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on short IV', () => {
      const record = {
        id: '1',
        name: 'short',
        encryptedValue: 'aaa',
        iv: btoa('short'),
        salt: btoa('salt'),
        createdAt: new Date().toISOString(),
        algorithm: 'AES-GCM',
      } as CredentialRecord;

      const result = validateCredentialRecord(record);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should verify passphrase correctness', async () => {
      const record = await encryptSecret('verify', PASSPHRASE);
      const ok = await verifyPassphrase(record, PASSPHRASE);
      const bad = await verifyPassphrase(record, 'wrong');
      expect(ok).toBe(true);
      expect(bad).toBe(false);
    });

    it('should validate record integrity', async () => {
      const record = await encryptSecret('integrity', PASSPHRASE);
      const valid = await validateRecordIntegrity(record, PASSPHRASE, 'integrity');
      expect(valid).toBe(true);
    });
  });

  describe('Utilities', () => {
    it('should sanitize names', () => {
      const name = sanitizeName(' Prod API Key #1 ');
      expect(name).toBe('Prod_API_Key_1');
    });

    it('should export and import credential', async () => {
      const record = await encryptSecret('export-me', PASSPHRASE, 'exp');
      const serialized = await exportCredential(record);
      const imported = await importCredential(serialized);
      expect(imported.id).toBe(record.id);
      expect(imported.encryptedValue).toBe(record.encryptedValue);
    });

    it('should hash secret', async () => {
      const hash = await hashSecret('hello');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(10);
    });

    it('should generate key check value', async () => {
      const kcv = await generateKeyCheckValue(PASSPHRASE);
      const kcv2 = await generateKeyCheckValue(PASSPHRASE);
      expect(kcv).toBe(kcv2);
    });

    it('should estimate entropy', () => {
      const entropy = calculateEntropy('abc123ABC!@#');
      expect(entropy).toBeGreaterThan(5);
    });

    it('should summarize config', () => {
      const summary = summarizeConfig({ iterations: 200000 });
      expect(summary.iterations).toBe(200000);
      expect(summary.ivLength).toBe(DEFAULT_ENCRYPTION_CONFIG.ivLength);
    });

    it('should evaluate strong passphrase', () => {
      const strong = isStrongPassphrase('StrongPassphrase!234');
      expect(strong.valid).toBe(true);
    });

    it('should flag weak passphrase', () => {
      const weak = isStrongPassphrase('short');
      expect(weak.valid).toBe(false);
      expect(weak.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world flows', () => {
    it('should create, read, rotate, and delete credential', async () => {
      const store = createCredentialStore();
      const record = await addCredential(store, 'api', 'v1', PASSPHRASE);
      const value1 = await getCredential(store, record.id, PASSPHRASE);
      expect(value1).toBe('v1');

      const rotated = await rotateCredential(
        store,
        record.id,
        PASSPHRASE,
        'NewPass!123'
      );
      expect(rotated?.version).toBe(2);
      const value2 = await getCredential(store, record.id, 'NewPass!123');
      expect(value2).toBe('v1');

      const deleted = deleteCredential(store, record.id);
      expect(deleted).toBe(true);
    });

    it('should keep audit log for multiple actions', async () => {
      const store = createCredentialStore();
      const record = await addCredential(store, 'db', 'pw', PASSPHRASE);
      await getCredential(store, record.id, PASSPHRASE);
      await updateCredential(store, record.id, 'pw2', PASSPHRASE);
      await rotateCredential(store, record.id, PASSPHRASE, 'NextPass!123');

      const audit = auditStore(store);
      expect(audit.length).toBe(4);
      const actions = audit.map(a => a.action);
      expect(actions).toEqual(['create', 'read', 'update', 'rotate']);
    });

    it('should redact audit log output', async () => {
      const store = createCredentialStore();
      await addCredential(store, 'svc', 'pw', PASSPHRASE);
      const redacted = redactAuditLog(store);
      expect(redacted[0].metadata).toEqual({});
    });

    it('should handle multiple credentials with different passphrases', async () => {
      const store = createCredentialStore();
      const r1 = await addCredential(store, 'svc1', 'alpha', PASSPHRASE);
      const r2 = await addCredential(store, 'svc2', 'beta', 'OtherPass!234');

      const v1 = await getCredential(store, r1.id, PASSPHRASE);
      const v2 = await getCredential(store, r2.id, 'OtherPass!234');

      expect(v1).toBe('alpha');
      expect(v2).toBe('beta');
    });

    it('should validate record integrity after update', async () => {
      const store = createCredentialStore();
      const record = await addCredential(store, 'svc', 'v1', PASSPHRASE);
      await updateCredential(store, record.id, 'v2', PASSPHRASE);
      const updated = store.records[0];
      const ok = await validateRecordIntegrity(updated, PASSPHRASE, 'v2');
      expect(ok).toBe(true);
    });
  });
});
