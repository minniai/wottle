/**
 * Custom error thrown when the scoring pipeline exhausts all retry attempts.
 * Wraps the last error encountered with retry metadata.
 */
export class ScoringPipelineError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly attempts?: number,
  ) {
    super(message);
    this.name = "ScoringPipelineError";
    Object.setPrototypeOf(this, ScoringPipelineError.prototype);
  }
}

export interface RetryOptions {
  /** Maximum number of attempts (default: 3). */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff (default: 100). */
  baseDelayMs?: number;
  /** Called on each retry with the attempt number and error. */
  onRetry?: (attempt: number, error: Error) => void;
  /** Called when all retries are exhausted. */
  onExhausted?: (error: ScoringPipelineError) => void;
}

/**
 * Retry wrapper for the scoring pipeline (FR-026).
 *
 * Executes `fn` up to `maxAttempts` times with exponential backoff.
 * On success, returns the result. On exhaustion, throws ScoringPipelineError.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        options.onRetry?.(attempt, lastError);
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const pipelineError = new ScoringPipelineError(
    `Scoring pipeline failed after ${maxAttempts} attempts: ${lastError?.message}`,
    lastError,
    maxAttempts,
  );

  options.onExhausted?.(pipelineError);
  throw pipelineError;
}
