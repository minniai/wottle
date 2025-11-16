type LogLevel = "info" | "error";

interface PlaytestLogPayload {
  matchId?: string;
  roundNumber?: number;
  playerId?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

function buildPayload(
  level: LogLevel,
  event: string,
  payload: PlaytestLogPayload
): Record<string, unknown> {
  const base = {
    level,
    event,
    timestamp: new Date().toISOString(),
    playtest: true,
  };

  const result: Record<string, unknown> = { ...base };
  if (payload.matchId) result.matchId = payload.matchId;
  if (payload.roundNumber !== undefined) result.roundNumber = payload.roundNumber;
  if (payload.playerId) result.playerId = payload.playerId;

  if (payload.metadata) {
    Object.assign(result, payload.metadata);
  }

  if (payload.error) {
    const err = payload.error;
    if (err instanceof Error) {
      result.error = err.message;
      result.stack = err.stack;
    } else {
      result.error = String(err);
    }
  }

  return result;
}

export function logPlaytestInfo(event: string, payload: PlaytestLogPayload = {}): void {
  console.log(JSON.stringify(buildPayload("info", event, payload)));
}

export function logPlaytestError(event: string, payload: PlaytestLogPayload = {}): void {
  console.error(JSON.stringify(buildPayload("error", event, payload)));
}

