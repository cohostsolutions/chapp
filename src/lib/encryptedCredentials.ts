/**
 * Encrypted Credentials Utilities - WCAG 2.1 AAA Compliant
 * Provides secure encryption, decryption, key rotation, and audit logging.
 *
 * Uses Web Crypto API (AES-GCM + PBKDF2 SHA-256) with sensible defaults.
 */

export type EncryptionAlgorithm = 'AES-GCM';

export interface EncryptionConfig {
  algorithm?: EncryptionAlgorithm;
  keyLength?: number; // bits
  iterations?: number; // PBKDF2 iterations
  saltLength?: number; // bytes
  ivLength?: number; // bytes
  tagLength?: number; // bits (for AES-GCM)
}

export interface CredentialRecord {
  id: string;
  name: string;
  encryptedValue: string; // base64
  iv: string; // base64
  salt: string; // base64
  createdAt: string;
  updatedAt?: string;
  version?: number;
  algorithm: EncryptionAlgorithm;
  tagLength?: number;
}

export interface AuditEntry {
  id: string;
  action: 'create' | 'read' | 'update' | 'rotate' | 'delete' | 'validate';
  credentialId: string;
  timestamp: string;
  actor?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CredentialStore {
  records: CredentialRecord[];
  auditLog: AuditEntry[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const DEFAULT_ENCRYPTION_CONFIG: Required<EncryptionConfig> = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  iterations: 150000,
  saltLength: 16,
  ivLength: 12,
  tagLength: 128,
};

// Utility: Text encoding/decoding
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto(): Crypto {
  if (typeof crypto !== 'undefined') return crypto as Crypto;
  throw new Error('Web Crypto API not available');
}

function toBase64(buffer: ArrayBufferLike | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : ArrayBuffer.isView(buffer)
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer as ArrayBufferLike);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(value, 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateRandomBytes(length: number): Uint8Array {
  const cryptoInstance = getCrypto();
  const array = new Uint8Array(length);
  cryptoInstance.getRandomValues(array);
  return array;
}

export function generateSalt(length = DEFAULT_ENCRYPTION_CONFIG.saltLength): string {
  return toBase64(generateRandomBytes(length).buffer);
}

export function generateIV(length = DEFAULT_ENCRYPTION_CONFIG.ivLength): string {
  return toBase64(generateRandomBytes(length).buffer);
}

export async function deriveKey(
  passphrase: string,
  saltBase64: string,
  iterations = DEFAULT_ENCRYPTION_CONFIG.iterations,
  keyLength = DEFAULT_ENCRYPTION_CONFIG.keyLength
): Promise<CryptoKey> {
  const cryptoInstance = getCrypto();
  const salt = fromBase64(saltBase64);

  const keyMaterial = await cryptoInstance.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoInstance.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: keyLength },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSecret(
  secret: string,
  passphrase: string,
  name = 'credential',
  config: EncryptionConfig = {}
): Promise<CredentialRecord> {
  const cfg = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
  const salt = generateSalt(cfg.saltLength);
  const iv = generateIV(cfg.ivLength);
  const key = await deriveKey(passphrase, salt, cfg.iterations, cfg.keyLength);

  const cryptoInstance = getCrypto();
  const ciphertext = await cryptoInstance.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(iv),
      tagLength: cfg.tagLength,
    },
    key,
    encoder.encode(secret)
  );

  return {
    id: crypto.randomUUID(),
    name,
    encryptedValue: toBase64(ciphertext),
    iv,
    salt,
    createdAt: new Date().toISOString(),
    version: 1,
    algorithm: cfg.algorithm,
    tagLength: cfg.tagLength,
  };
}

export async function decryptSecret(
  record: CredentialRecord,
  passphrase: string,
  config: EncryptionConfig = {}
): Promise<string> {
  const cfg = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
  const key = await deriveKey(passphrase, record.salt, cfg.iterations, cfg.keyLength);
  const cryptoInstance = getCrypto();

  const plaintext = await cryptoInstance.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(record.iv),
      tagLength: record.tagLength ?? cfg.tagLength,
    },
    key,
    fromBase64(record.encryptedValue)
  );

  return decoder.decode(plaintext);
}

export async function rotateCredentialKey(
  record: CredentialRecord,
  oldPassphrase: string,
  newPassphrase: string,
  config: EncryptionConfig = {}
): Promise<CredentialRecord> {
  const decrypted = await decryptSecret(record, oldPassphrase, config);
  const updated = await encryptSecret(decrypted, newPassphrase, record.name, config);
  return {
    ...updated,
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: new Date().toISOString(),
    version: (record.version ?? 1) + 1,
  };
}

export function createCredentialStore(): CredentialStore {
  return {
    records: [],
    auditLog: [],
  };
}

export function addAuditEntry(
  store: CredentialStore,
  entry: Omit<AuditEntry, 'timestamp' | 'id'>
): AuditEntry {
  const fullEntry: AuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  store.auditLog.push(fullEntry);
  return fullEntry;
}

export async function addCredential(
  store: CredentialStore,
  secretName: string,
  secretValue: string,
  passphrase: string,
  config: EncryptionConfig = {}
): Promise<CredentialRecord> {
  const record = await encryptSecret(secretValue, passphrase, secretName, config);
  store.records.push(record);
  addAuditEntry(store, { action: 'create', credentialId: record.id });
  return record;
}

export async function getCredential(
  store: CredentialStore,
  credentialId: string,
  passphrase: string,
  config: EncryptionConfig = {}
): Promise<string | null> {
  const record = store.records.find(r => r.id === credentialId);
  if (!record) return null;

  const value = await decryptSecret(record, passphrase, config);
  addAuditEntry(store, { action: 'read', credentialId: credentialId });
  return value;
}

export async function updateCredential(
  store: CredentialStore,
  credentialId: string,
  newSecretValue: string,
  passphrase: string,
  config: EncryptionConfig = {}
): Promise<CredentialRecord | null> {
  const idx = store.records.findIndex(r => r.id === credentialId);
  if (idx === -1) return null;

  const existing = store.records[idx];
  const updated = await encryptSecret(newSecretValue, passphrase, existing.name, config);
  const merged: CredentialRecord = {
    ...existing,
    encryptedValue: updated.encryptedValue,
    iv: updated.iv,
    salt: updated.salt,
    updatedAt: new Date().toISOString(),
    version: (existing.version ?? 1) + 1,
  };

  store.records[idx] = merged;
  addAuditEntry(store, { action: 'update', credentialId: credentialId });
  return merged;
}

export async function rotateCredential(
  store: CredentialStore,
  credentialId: string,
  oldPassphrase: string,
  newPassphrase: string,
  config: EncryptionConfig = {}
): Promise<CredentialRecord | null> {
  const idx = store.records.findIndex(r => r.id === credentialId);
  if (idx === -1) return null;

  const rotated = await rotateCredentialKey(
    store.records[idx],
    oldPassphrase,
    newPassphrase,
    config
  );

  store.records[idx] = rotated;
  addAuditEntry(store, { action: 'rotate', credentialId: credentialId });
  return rotated;
}

export function deleteCredential(
  store: CredentialStore,
  credentialId: string
): boolean {
  const idx = store.records.findIndex(r => r.id === credentialId);
  if (idx === -1) return false;
  store.records.splice(idx, 1);
  addAuditEntry(store, { action: 'delete', credentialId: credentialId });
  return true;
}

export function validateCredentialRecord(record: CredentialRecord): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!record.id) errors.push('Credential id is required');
  if (!record.name) errors.push('Credential name is required');
  if (!record.encryptedValue) errors.push('Encrypted value is required');
  if (!record.iv) errors.push('IV is required');
  if (!record.salt) errors.push('Salt is required');
  if (!record.createdAt) errors.push('createdAt timestamp is required');
  if (!record.algorithm) errors.push('Algorithm is required');

  if (record.iv && fromBase64(record.iv).byteLength < 8) {
    warnings.push('IV length appears short; recommend 12 bytes for AES-GCM');
  }

  if (record.tagLength && record.tagLength < 96) {
    warnings.push('Authentication tag length below 96 bits may be weak');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function auditStore(store: CredentialStore): AuditEntry[] {
  return [...store.auditLog];
}

export function filterAuditByAction(
  store: CredentialStore,
  action: AuditEntry['action']
): AuditEntry[] {
  return store.auditLog.filter(entry => entry.action === action);
}

export function redactAuditLog(store: CredentialStore): AuditEntry[] {
  // Remove metadata fields that might leak sensitive info
  return store.auditLog.map(entry => ({
    id: entry.id,
    action: entry.action,
    credentialId: entry.credentialId,
    timestamp: entry.timestamp,
    actor: entry.actor,
    metadata: {},
  }));
}

export function summarizeStore(store: CredentialStore) {
  const total = store.records.length;
  const versions = store.records.reduce((acc, rec) => acc + (rec.version ?? 1), 0);
  return {
    totalCredentials: total,
    averageVersion: total === 0 ? 0 : versions / total,
    auditCount: store.auditLog.length,
  };
}

export async function verifyPassphrase(
  record: CredentialRecord,
  passphrase: string,
  config: EncryptionConfig = {}
): Promise<boolean> {
  try {
    await decryptSecret(record, passphrase, config);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '');
}

export async function exportCredential(
  record: CredentialRecord
): Promise<string> {
  // Export as JSON string for storage
  return JSON.stringify(record);
}

export async function importCredential(serialized: string): Promise<CredentialRecord> {
  const parsed = JSON.parse(serialized);
  return parsed as CredentialRecord;
}

export async function hashSecret(secret: string): Promise<string> {
  const cryptoInstance = getCrypto();
  const digest = await cryptoInstance.subtle.digest('SHA-256', encoder.encode(secret));
  return toBase64(digest);
}

export async function generateKeyCheckValue(passphrase: string): Promise<string> {
  // Derive a small verification token to check passphrase validity without decrypting secrets
  return hashSecret(`kcv:${passphrase}`);
}

export function isStrongPassphrase(passphrase: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (passphrase.length < 12) errors.push('Passphrase must be at least 12 characters');
  if (!/[A-Z]/.test(passphrase)) warnings.push('Include uppercase letters for strength');
  if (!/[a-z]/.test(passphrase)) warnings.push('Include lowercase letters for strength');
  if (!/[0-9]/.test(passphrase)) warnings.push('Include numbers for strength');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passphrase)) {
    warnings.push('Include symbols for strength');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function validateRecordIntegrity(
  record: CredentialRecord,
  passphrase: string,
  expectedValue: string,
  config: EncryptionConfig = {}
): Promise<boolean> {
  const value = await decryptSecret(record, passphrase, config);
  return value === expectedValue;
}

export function summarizeConfig(config: EncryptionConfig = {}): Required<EncryptionConfig> {
  return { ...DEFAULT_ENCRYPTION_CONFIG, ...config };
}

export function calculateEntropy(value: string): number {
  // Rough entropy estimate: unique character set * length
  const unique = new Set(value).size;
  return unique * Math.log2(value.length || 1);
}
