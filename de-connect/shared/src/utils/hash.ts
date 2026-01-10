/**
 * Hashing utilities for file integrity verification
 */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function sha256String(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verify file integrity against expected hash
 */
export async function verifyFileHash(
  filePath: string,
  expectedHash: string
): Promise<{ valid: boolean; actualHash: string }> {
  const actualHash = await sha256File(filePath);
  return {
    valid: actualHash.toLowerCase() === expectedHash.toLowerCase(),
    actualHash,
  };
}

/**
 * Generate a unique machine fingerprint
 * In production, this would include hardware IDs, but for portability
 * we use a combination of available system info
 */
export async function generateMachineFingerprint(): Promise<string> {
  const os = await import('os');

  const components = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model ?? 'unknown-cpu',
    os.totalmem().toString(),
  ];

  return sha256String(components.join('|'));
}
