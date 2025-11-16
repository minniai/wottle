export interface PerfTimer {
  start(): void;
  success(extra?: Record<string, unknown>): void;
  failure(error: unknown, extra?: Record<string, unknown>): void;
}

function ensureObject<T extends Record<string, unknown>>(value?: T): T {
  return (value ?? ({} as T));
}

type Clock = () => number;

function isPerformanceLike(value: unknown): value is { now: () => number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { now?: unknown }).now === "function"
  );
}

function getClock(): Clock {
  if (typeof globalThis !== "undefined") {
    const maybePerformance = (globalThis as {
      performance?: unknown;
    }).performance;

    if (isPerformanceLike(maybePerformance)) {
      return () => maybePerformance.now();
    }
  }

  return () => Date.now();
}

const clock = getClock();

export function createPerfTimer(
  event: string,
  metadata: Record<string, unknown> = {}
): PerfTimer {
  let started = false;
  let startedAt = 0;

  function ensureStarted() {
    if (!started) {
      started = true;
      startedAt = clock();
    }
  }

  function computeDurationMs(): number {
    if (!started) {
      return 0;
    }

    const elapsed = clock() - startedAt;
    return Math.max(0, Math.round(elapsed));
  }

  function finalise(
    status: "success" | "error",
    extra: Record<string, unknown>,
    error?: unknown
  ) {
    ensureStarted();

    const payload = {
      event,
      durationMs: computeDurationMs(),
      ...metadata,
      ...extra,
    };

    if (status === "success") {
      console.log(
        JSON.stringify({
          status: "success",
          ...payload,
        })
      );
      return;
    }

    const errorPayload =
      error instanceof Error
        ? { error: error.message, stack: error.stack }
        : { error: String(error) };

    console.error(
      JSON.stringify({
        status: "error",
        ...payload,
        ...errorPayload,
      })
    );
  }

  return {
    start() {
      ensureStarted();
    },
    success(extra) {
      finalise("success", ensureObject(extra));
    },
    failure(error, extra) {
      finalise("error", ensureObject(extra), error);
    },
  };
}

export function createPlaytestPerfTimer(
  event: string,
  context: Record<string, unknown> = {}
): PerfTimer {
  return createPerfTimer(event, { playtest: true, ...context });
}


