import type { PlayerSlot, RoundTracker, SubmissionRecord } from "@/lib/types/match";
import { buildMoveSignature } from "@/lib/types/match";

export interface SubmissionInput {
  round: RoundTracker;
  slot: PlayerSlot;
  playerId: string;
  move: { from: { x: number; y: number }; to: { x: number; y: number } };
  submittedAt: number;
}

export function registerSubmission(input: SubmissionInput): RoundTracker {
  const { round, slot, playerId, move, submittedAt } = input;
  const signature = buildMoveSignature(move);
  const submissions = { ...round.submissions };
  const existing = submissions[slot];

  if (existing && existing.status !== "pending") {
    return round;
  }

  const counterpartSlot: PlayerSlot = slot === "player_a" ? "player_b" : "player_a";
  const counterpart = submissions[counterpartSlot];

  let status: SubmissionRecord["status"] = "accepted";
  if (
    counterpart &&
    counterpart.status === "accepted" &&
    counterpart.signature === signature
  ) {
    status = "ignored_same_move";
  }

  submissions[slot] = {
    playerId,
    status,
    submittedAt: new Date(submittedAt).toISOString(),
    signature,
  };

  const shouldResolve =
    submissions.player_a?.status &&
    submissions.player_a.status !== "pending" &&
    submissions.player_b?.status &&
    submissions.player_b.status !== "pending";

  return {
    ...round,
    phase: shouldResolve ? "resolving" : round.phase,
    submissions,
  };
}

export function markRoundCompleted(round: RoundTracker): RoundTracker {
  return { ...round, phase: "completed" };
}

export function nextRoundNumber(round: RoundTracker, roundLimit = 10): number | null {
  if (round.roundNumber >= roundLimit) {
    return null;
  }
  return round.roundNumber + 1;
}

export function shouldAdvanceRound(round: RoundTracker): boolean {
  return round.phase === "completed";
}

