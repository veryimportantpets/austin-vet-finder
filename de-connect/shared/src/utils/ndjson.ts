/**
 * NDJSON (Newline Delimited JSON) utilities
 * Used for streaming canonical entities to sync packages
 */

import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

/**
 * Parse NDJSON file line by line
 */
export async function* parseNdjsonFile<T>(
  filePath: string
): AsyncGenerator<{ line: number; data: T; raw: string }> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (line.trim() === '') continue;

    try {
      const data = JSON.parse(line) as T;
      yield { line: lineNumber, data, raw: line };
    } catch (error) {
      throw new Error(
        `Failed to parse NDJSON at line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Write records to NDJSON file
 */
export async function writeNdjsonFile<T>(
  filePath: string,
  records: AsyncIterable<T> | Iterable<T>
): Promise<{ count: number; bytesWritten: number }> {
  const output = createWriteStream(filePath, { encoding: 'utf8' });

  let count = 0;
  let bytesWritten = 0;

  try {
    for await (const record of records) {
      const line = JSON.stringify(record) + '\n';
      output.write(line);
      count++;
      bytesWritten += Buffer.byteLength(line, 'utf8');
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      output.end((err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { count, bytesWritten };
}

/**
 * Serialize a single record to NDJSON line
 */
export function toNdjsonLine<T>(record: T): string {
  return JSON.stringify(record);
}

/**
 * Create a transform stream that converts objects to NDJSON lines
 */
export function createNdjsonTransform<T>(): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk: T, encoding, callback) {
      try {
        const line = JSON.stringify(chunk) + '\n';
        callback(null, line);
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    },
  });
}

/**
 * Count records in an NDJSON file without loading all into memory
 */
export async function countNdjsonRecords(filePath: string): Promise<number> {
  let count = 0;
  for await (const _ of parseNdjsonFile(filePath)) {
    count++;
  }
  return count;
}

/**
 * Validate NDJSON file structure
 */
export async function validateNdjsonFile(
  filePath: string,
  maxErrors: number = 10
): Promise<{ valid: boolean; errors: Array<{ line: number; message: string }> }> {
  const errors: Array<{ line: number; message: string }> = [];

  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (line.trim() === '') continue;

    try {
      JSON.parse(line);
    } catch (error) {
      errors.push({
        line: lineNumber,
        message: error instanceof Error ? error.message : String(error),
      });

      if (errors.length >= maxErrors) {
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
