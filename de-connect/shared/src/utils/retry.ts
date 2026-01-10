/**
 * Retry utilities with exponential backoff
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 4,
  initialDelayMs: 2000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNetworkError(error: Error): boolean {
  const networkCodes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
  const errnoError = error as NodeJS.ErrnoException;
  if (errnoError.code && networkCodes.includes(errnoError.code)) {
    return true;
  }
  // Check for fetch/HTTP errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true;
  }
  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = opts.retryableErrors
        ? opts.retryableErrors(lastError)
        : isNetworkError(lastError);

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Notify about retry
      opts.onRetry?.(attempt, lastError, delay);

      // Wait before next attempt
      await sleep(delay);

      // Increase delay for next attempt
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for HTTP fetch operations
 */
export function createRetryFetch(
  options: Partial<RetryOptions> = {}
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return withRetry(
      async () => {
        const response = await fetch(input, init);
        // Retry on 5xx errors
        if (response.status >= 500) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
      },
      {
        ...options,
        retryableErrors: (error) => {
          if (isNetworkError(error)) return true;
          // Also retry on 5xx errors
          if (error.message.startsWith('HTTP 5')) return true;
          return false;
        },
      }
    );
  };
}
