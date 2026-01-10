/**
 * Secrets Manager
 *
 * Handles secure storage of credentials and sensitive data.
 * Uses platform-appropriate encryption (simulated here for cross-platform).
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { getDataDir } from './config.js';
import type { ConnectionSecrets } from '@de-connect/contracts';

const scryptAsync = promisify(scrypt);

/**
 * Secrets manager configuration
 */
export interface SecretsConfig {
  /**
   * Directory for encrypted secrets
   */
  secretsDir: string;

  /**
   * Master key (derived from machine-specific data)
   */
  masterKey?: Buffer;
}

/**
 * Encrypted data format
 */
interface EncryptedData {
  version: 1;
  algorithm: 'aes-256-gcm';
  salt: string; // hex
  iv: string; // hex
  authTag: string; // hex
  data: string; // hex
}

/**
 * Secrets Manager
 */
export class SecretsManager {
  private secretsDir: string;
  private masterKey: Buffer | null = null;
  private keyPromise: Promise<Buffer> | null = null;

  constructor(config?: Partial<SecretsConfig>) {
    this.secretsDir = config?.secretsDir ?? join(getDataDir(), 'secrets');
    if (config?.masterKey) {
      this.masterKey = config.masterKey;
    }
  }

  /**
   * Initialize the secrets manager
   */
  async init(): Promise<void> {
    if (!existsSync(this.secretsDir)) {
      await mkdir(this.secretsDir, { recursive: true, mode: 0o700 });
    }

    // Derive master key if not provided
    if (!this.masterKey) {
      this.masterKey = await this.deriveMasterKey();
    }
  }

  /**
   * Derive master key from machine-specific data
   * In production, use DPAPI on Windows, Keychain on macOS, etc.
   */
  private async deriveMasterKey(): Promise<Buffer> {
    // Use cached promise if already deriving
    if (this.keyPromise) {
      return this.keyPromise;
    }

    this.keyPromise = (async () => {
      const os = await import('os');
      const { createHash } = await import('crypto');

      // Create a machine-specific identifier
      const machineId = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model ?? 'cpu',
        // In production, would include actual hardware IDs
      ].join('|');

      const machineHash = createHash('sha256').update(machineId).digest();

      // Derive key using scrypt
      const salt = Buffer.from('de-connect-secrets-v1');
      const key = await scryptAsync(machineHash, salt, 32) as Buffer;

      return key;
    })();

    return this.keyPromise;
  }

  /**
   * Store secrets for a profile
   */
  async storeSecrets(profileId: string, secrets: ConnectionSecrets): Promise<string> {
    await this.init();

    const secretsRef = `${profileId}.enc`;
    const filePath = join(this.secretsDir, secretsRef);

    const plaintext = JSON.stringify(secrets);
    const encrypted = await this.encrypt(plaintext);

    await writeFile(filePath, JSON.stringify(encrypted), { mode: 0o600 });

    return secretsRef;
  }

  /**
   * Retrieve secrets for a profile
   */
  async getSecrets(secretsRef: string): Promise<ConnectionSecrets | null> {
    await this.init();

    const filePath = join(this.secretsDir, secretsRef);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const encrypted = JSON.parse(content) as EncryptedData;
      const plaintext = await this.decrypt(encrypted);
      return JSON.parse(plaintext) as ConnectionSecrets;
    } catch (error) {
      console.error('Failed to decrypt secrets:', error);
      return null;
    }
  }

  /**
   * Get secrets as flat key-value map (for adapter interface)
   */
  async getSecretsMap(secretsRef: string): Promise<Record<string, string>> {
    const secrets = await this.getSecrets(secretsRef);
    if (!secrets) return {};

    const map: Record<string, string> = {};

    if (secrets.username) map.username = secrets.username;
    if (secrets.password) map.password = secrets.password;
    if (secrets.apiKey) map.apiKey = secrets.apiKey;
    if (secrets.apiSecret) map.apiSecret = secrets.apiSecret;
    if (secrets.accessToken) map.accessToken = secrets.accessToken;
    if (secrets.refreshToken) map.refreshToken = secrets.refreshToken;
    if (secrets.sessionData) map.sessionData = secrets.sessionData;
    if (secrets.cookies) map.cookies = secrets.cookies;

    if (secrets.custom) {
      for (const [key, value] of Object.entries(secrets.custom)) {
        map[key] = value;
      }
    }

    return map;
  }

  /**
   * Delete secrets for a profile
   */
  async deleteSecrets(secretsRef: string): Promise<void> {
    const filePath = join(this.secretsDir, secretsRef);

    if (existsSync(filePath)) {
      await rm(filePath);
    }
  }

  /**
   * Update secrets for a profile
   */
  async updateSecrets(
    secretsRef: string,
    updates: Partial<ConnectionSecrets>
  ): Promise<void> {
    const current = await this.getSecrets(secretsRef);
    const updated: ConnectionSecrets = {
      ...current,
      ...updates,
      custom: {
        ...current?.custom,
        ...updates.custom,
      },
    };

    const plaintext = JSON.stringify(updated);
    const encrypted = await this.encrypt(plaintext);
    const filePath = join(this.secretsDir, secretsRef);

    await writeFile(filePath, JSON.stringify(encrypted), { mode: 0o600 });
  }

  /**
   * Encrypt data
   */
  private async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    const salt = randomBytes(16);
    const iv = randomBytes(12);

    // Derive encryption key from master key + salt
    const key = await scryptAsync(this.masterKey, salt, 32) as Buffer;

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  /**
   * Decrypt data
   */
  private async decrypt(encrypted: EncryptedData): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    if (encrypted.version !== 1 || encrypted.algorithm !== 'aes-256-gcm') {
      throw new Error('Unsupported encryption format');
    }

    const salt = Buffer.from(encrypted.salt, 'hex');
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const data = Buffer.from(encrypted.data, 'hex');

    // Derive decryption key from master key + salt
    const key = await scryptAsync(this.masterKey, salt, 32) as Buffer;

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
