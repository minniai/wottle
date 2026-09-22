import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/moveResolver", () => ({ resolvePendingMoves: vi.fn().mockResolvedValue({ resolved: 1, bothDone: false }) }));
vi.mock("@/lib/match/matchSettlement", () => ({ settleMatchIfDue: vi.fn().mockResolvedValue("completed") }));

import { resolveReceivedMove, submitMove } from "@/app/actions/match/submitMove";
import { resolvePendingMoves } from "@/lib/match/moveResolver";
import { settleMatchIfDue } from "@/lib/match/matchSettlement";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Spec 050 contracts/receive-move.md: the action validates, hands the move to
 * `receive_move`, maps its answer, and only an accepted move starts resolution.
 */
const PLAYER_ID = "11111111-1111-4111-8111-111111111111";
const MATCH_ID = "33333333-3333-4333-8333-333333333333";
const MOVE = { fromX: 0, fromY: 0, toX: 1, toY: 1, fromLetter: "A", toLetter: "B" };

function withRpc(row: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: row, error });
  vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readLobbySession).mockResolvedValue({
    player: { id: PLAYER_ID, username: "birna", displayName: "Birna" },
  } as never);
});

describe("submitMove", () => {
  it("returns Unauthorized without a session and calls nothing", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);
    const rpc = withRpc(null);
    expect(await submitMove(MATCH_ID, MOVE)).toEqual({ error: "Unauthorized" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an invalid body before touching the database", async () => {
    const rpc = withRpc(null);
    const result = await submitMove(MATCH_ID, { ...MOVE, toX: 0, toY: 0 });
    expect(result).toEqual({ error: "Cannot swap a tile with itself" });
    expect(await submitMove(MATCH_ID, { fromX: 0, fromY: 0, toX: 1, toY: 1 })).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hands the swap and the two letters to receive_move and returns the receipt", async () => {
    const rpc = withRpc({ status: "accepted", moveId: "m-1", globalSeq: 7, receivedAt: "2026-09-21T12:00:00.000Z" });
    const result = await submitMove(MATCH_ID, MOVE);
    expect(rpc).toHaveBeenCalledWith("receive_move", {
      p_match_id: MATCH_ID,
      p_player_id: PLAYER_ID,
      p_from_x: 0,
      p_from_y: 0,
      p_to_x: 1,
      p_to_y: 1,
      p_from_letter: "A",
      p_to_letter: "B",
    });
    expect(result).toEqual({ status: "accepted", moveId: "m-1", globalSeq: 7, receivedAt: "2026-09-21T12:00:00.000Z" });
    expect(resolvePendingMoves).not.toHaveBeenCalled();
  });

  it.each([
    ["ended", "Match has ended"],
    ["not_started", "The match has not started yet"],
    ["deadline", "The clock has run out"],
    ["cap", "You have made all your moves"],
    ["in_flight", "Your previous move is still being scored"],
  ])("maps the refusal `%s` to a rejected result and starts no resolution", async (reason, message) => {
    withRpc({ status: "rejected", reason });
    expect(await submitMove(MATCH_ID, MOVE)).toEqual({ status: "rejected", reason, error: message });
    expect(resolvePendingMoves).not.toHaveBeenCalled();
  });

  it("answers not_found and not_participant as plain errors", async () => {
    withRpc({ status: "rejected", reason: "not_found" });
    expect(await submitMove(MATCH_ID, MOVE)).toEqual({ error: "Match not found" });
    withRpc({ status: "rejected", reason: "not_participant" });
    expect(await submitMove(MATCH_ID, MOVE)).toEqual({ error: "You are not a player in this match" });
  });

  it("reports a database failure without throwing", async () => {
    withRpc(null, { message: "connection reset" });
    expect(await submitMove(MATCH_ID, MOVE)).toEqual({ error: "Failed to submit move" });
    expect(resolvePendingMoves).not.toHaveBeenCalled();
  });

  it("resolves an accepted receipt and settles once it brought both players to ten (contracts/move-resolver.md)", async () => {
    vi.mocked(resolvePendingMoves).mockResolvedValueOnce({ resolved: 1, bothDone: true });
    await resolveReceivedMove(MATCH_ID);
    expect(resolvePendingMoves).toHaveBeenCalledWith(MATCH_ID);
    expect(settleMatchIfDue).toHaveBeenCalledWith(MATCH_ID);
  });

  it("does not settle while either player is short of ten", async () => {
    await resolveReceivedMove(MATCH_ID);
    expect(resolvePendingMoves).toHaveBeenCalledWith(MATCH_ID);
    expect(settleMatchIfDue).not.toHaveBeenCalled();
  });
});
