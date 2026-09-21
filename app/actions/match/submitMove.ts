"use server";

import { after } from "next/server";

import { moveRequestSchema } from "@/lib/match/schemas";
import { resolvePendingMoves } from "@/lib/match/moveResolver";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MoveResult } from "@/lib/types/board";
import type { MoveRefusalReason } from "@/lib/types/match";

/**
 * Receive a move (spec 050, contracts/receive-move.md). The database stamps
 * it under the match row's lock: a gap-free receipt sequence and a server
 * timestamp. Every refusal returns without recording anything. Resolution
 * runs after the response so a cold dictionary never sits on the request.
 */
const REFUSAL_MESSAGES: Record<Exclude<MoveRefusalReason, "not_found" | "not_participant">, string> = {
  ended: "Match has ended",
  not_started: "The match has not started yet",
  deadline: "The clock has run out",
  cap: "You have made all your moves",
  in_flight: "Your previous move is still being scored",
};

interface ReceiveRow {
  status: "accepted" | "rejected";
  reason?: MoveRefusalReason;
  moveId?: string;
  globalSeq?: number;
  receivedAt?: string;
}

function toMoveResult(row: ReceiveRow): MoveResult | { error: string } {
  if (row.status === "accepted" && row.moveId && row.globalSeq !== undefined && row.receivedAt) {
    return { status: "accepted", moveId: row.moveId, globalSeq: row.globalSeq, receivedAt: row.receivedAt };
  }
  const reason = row.reason ?? "ended";
  if (reason === "not_found") return { error: "Match not found" };
  if (reason === "not_participant") return { error: "You are not a player in this match" };
  return { status: "rejected", reason, error: REFUSAL_MESSAGES[reason] };
}

export async function submitMove(matchId: string, input: unknown): Promise<MoveResult | { error: string }> {
  const session = await readLobbySession();
  if (!session) {
    return { error: "Unauthorized" };
  }
  const user = session.player;

  assertWithinRateLimit({
    identifier: user.id,
    scope: "match:submit-move",
    limit: 30,
    windowMs: 60_000,
    errorMessage: "Too many move submissions. Please slow down before trying again.",
  });

  const parsed = moveRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid move" };
  }
  const move = parsed.data;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("receive_move", {
    p_match_id: matchId,
    p_player_id: user.id,
    p_from_x: move.fromX,
    p_from_y: move.fromY,
    p_to_x: move.toX,
    p_to_y: move.toY,
    p_from_letter: move.fromLetter.normalize("NFC"),
    p_to_letter: move.toLetter.normalize("NFC"),
  });
  if (error) {
    console.error("[submitMove] receive_move failed:", error.message);
    return { error: "Failed to submit move" };
  }

  const result = toMoveResult((data as ReceiveRow | null) ?? { status: "rejected", reason: "not_found" });
  if ("status" in result && result.status === "accepted") {
    after(async () => {
      try {
        await resolvePendingMoves(matchId);
      } catch (e) {
        console.error("[submitMove] resolution failed:", e);
      }
    });
  }
  return result;
}
