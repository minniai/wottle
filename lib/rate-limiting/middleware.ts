type HeaderAccessor = {
  get(name: string): string | null | undefined;
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

type RateLimitStore = Map<string, RateLimitEntry>;

const GLOBAL_STORE_KEY = "__wottleRateLimitStore__";

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_STORE_KEY]?: RateLimitStore;
};

const globalWithStore = globalThis as GlobalWithStore;

function getStore(): RateLimitStore {
  if (!globalWithStore[GLOBAL_STORE_KEY]) {
    globalWithStore[GLOBAL_STORE_KEY] = new Map<string, RateLimitEntry>();
  }

  return globalWithStore[GLOBAL_STORE_KEY]!;
}

export interface RateLimitOptions {
  identifier: string;
  scope: string;
  limit: number;
  windowMs: number;
  errorMessage?: string;
}

export interface RateLimitSnapshot {
  remaining: number;
  resetAt: number;
}

export class RateLimitExceededError extends Error {
  readonly scope: string;
  readonly retryAfterSeconds: number;
  readonly statusCode = 429;

  constructor(scope: string, retryAfterSeconds: number, message: string) {
    super(message);
    this.scope = scope;
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "RateLimitExceededError";
  }
}

export function isRateLimitError(
  error: unknown,
): error is RateLimitExceededError {
  return error instanceof RateLimitExceededError;
}

function buildCompositeKey(scope: string, identifier: string) {
  const sanitized = identifier && identifier.trim().length > 0
    ? identifier.trim().toLowerCase()
    : "anonymous";
  return `${scope}:${sanitized}`;
}

export function assertWithinRateLimit(
  options: RateLimitOptions,
): RateLimitSnapshot {
  const { identifier, scope, limit, windowMs, errorMessage } = options;
  if (limit <= 0 || windowMs <= 0) {
    throw new Error(
      `Invalid rate limit configuration for scope "${scope}". limit and windowMs must be positive.`,
    );
  }

  const store = getStore();
  const now = Date.now();
  const key = buildCompositeKey(scope, identifier);
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { remaining: Math.max(0, limit - 1), resetAt };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.resetAt - now) / 1000),
    );
    throw new RateLimitExceededError(
      scope,
      retryAfterSeconds,
      errorMessage ??
        "Too many requests. Please wait a moment and try again.",
    );
  }

  entry.count += 1;
  store.set(key, entry);
  return { remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

const IP_HEADER_KEYS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "fastly-client-ip",
  "x-cluster-client-ip",
];

export function resolveClientIp(headers?: HeaderAccessor | null): string {
  if (!headers) {
    return "unknown";
  }

  for (const key of IP_HEADER_KEYS) {
    const value = headers.get(key);
    if (typeof value === "string" && value.trim().length > 0) {
      const first = value.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }
  }

  return "unknown";
}

export function resetRateLimitStoreForTests() {
  if (process.env.NODE_ENV !== "test") {
    return;
  }

  getStore().clear();
}

