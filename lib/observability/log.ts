import type { MatchEndedReason, ScoreTotals } from "@/lib/types/match";

type LogLevel = "info" | "error";

interface PlaytestLogPayload {
  matchId?: string;
  roundNumber?: number;
  playerId?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

type AnalyticsEvent =
  | {
      name: "matchmaking.invite.accepted";
      matchId: string;
      playerId: string;
      metadata?: Record<string, unknown>;
    }
  | {
      name: "round.completed";
      matchId: string;
      roundNumber: number;
      acceptedMoves: number;
      rejectedMoves: number;
      durationMs?: number;
      isGameOver?: boolean;
    }
  | {
      name: "match.completed";
      matchId: string;
      winnerId: string | null;
      loserId: string | null;
      endedReason: MatchEndedReason;
      isDraw: boolean;
      totalRounds?: number;
      scores: ScoreTotals;
    };

type AnalyticsHook = (event: AnalyticsEvent) => void;

const analyticsHooks = new Set<AnalyticsHook>();

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

function emitAnalyticsEvent(event: AnalyticsEvent) {
  analyticsHooks.forEach((hook) => {
    try {
      hook(event);
    } catch (error) {
      console.error("[analytics] hook_failed", error);
    }
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("playtest:analytics", { detail: event }));
    } catch (error) {
      console.error("[analytics] dispatch_failed", error);
    }
  }
}

export function registerAnalyticsHook(hook: AnalyticsHook): () => void {
  analyticsHooks.add(hook);
  return () => analyticsHooks.delete(hook);
}

export function logPlaytestInfo(event: string, payload: PlaytestLogPayload = {}): void {
  console.log(JSON.stringify(buildPayload("info", event, payload)));
}

export function logPlaytestError(event: string, payload: PlaytestLogPayload = {}): void {
  console.error(JSON.stringify(buildPayload("error", event, payload)));
}

export function trackInviteAccepted(payload: {
  matchId: string;
  playerId: string;
  inviteId: string;
  opponentId: string;
}): void {
  logPlaytestInfo("matchmaking.invite.accepted", {
    matchId: payload.matchId,
    playerId: payload.playerId,
    metadata: { inviteId: payload.inviteId, opponentId: payload.opponentId },
  });
  emitAnalyticsEvent({
    name: "matchmaking.invite.accepted",
    matchId: payload.matchId,
    playerId: payload.playerId,
    metadata: { inviteId: payload.inviteId, opponentId: payload.opponentId },
  });
}

export function trackRoundCompleted(payload: {
  matchId: string;
  roundNumber: number;
  acceptedMoves: number;
  rejectedMoves: number;
  durationMs?: number;
  isGameOver?: boolean;
}): void {
  logPlaytestInfo("round.completed", {
    matchId: payload.matchId,
    roundNumber: payload.roundNumber,
    metadata: {
      acceptedMoves: payload.acceptedMoves,
      rejectedMoves: payload.rejectedMoves,
      durationMs: payload.durationMs,
      isGameOver: payload.isGameOver ?? false,
    },
  });
  emitAnalyticsEvent({
    name: "round.completed",
    matchId: payload.matchId,
    roundNumber: payload.roundNumber,
    acceptedMoves: payload.acceptedMoves,
    rejectedMoves: payload.rejectedMoves,
    durationMs: payload.durationMs,
    isGameOver: payload.isGameOver,
  });
}

export function trackMatchResult(payload: {
  matchId: string;
  winnerId: string | null;
  loserId: string | null;
  endedReason: MatchEndedReason;
  isDraw: boolean;
  scores: ScoreTotals;
  totalRounds?: number;
}): void {
  logPlaytestInfo("match.completed", {
    matchId: payload.matchId,
    metadata: {
      winnerId: payload.winnerId,
      loserId: payload.loserId,
      endedReason: payload.endedReason,
      isDraw: payload.isDraw,
      totalRounds: payload.totalRounds,
      scores: payload.scores,
    },
  });
  emitAnalyticsEvent({
    name: "match.completed",
    matchId: payload.matchId,
    winnerId: payload.winnerId,
    loserId: payload.loserId,
    endedReason: payload.endedReason,
    isDraw: payload.isDraw,
    totalRounds: payload.totalRounds,
    scores: payload.scores,
  });
}

