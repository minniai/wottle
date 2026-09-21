/**
 * Spec 050 FR-012 / §2a: the clock never pauses and a disconnect decides
 * nothing by itself. After the 90s window the absent player is not handed a
 * loss by a server timer; the record stays so the player with ten moves can
 * end the match early, and otherwise the deadline settles it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/logWriter", () => ({ writeMatchLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/stateLoader", () => ({ loadMatchState: vi.fn().mockResolvedValue({ matchId: "m" }) }));
vi.mock("@/app/actions/match/completeMatch", () => ({ completeMatchInternal: vi.fn() }));

import { handlePlayerDisconnect } from "@/app/actions/match/handleDisconnect";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { __resetDisconnectStoreForTests, getDisconnectedAt, RECONNECT_WINDOW_MS } from "@/lib/match/disconnectStore";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH = "m";
const A = "player-a";
const B = "player-b";

beforeEach(() => {
  vi.useFakeTimers();
  __resetDisconnectStoreForTests();
  vi.mocked(readLobbySession).mockResolvedValue({ player: { id: B } } as never);
  const single = vi.fn().mockResolvedValue({ data: { player_a_id: A, player_b_id: B, state: "in_progress" } });
  vi.mocked(getServiceRoleClient).mockReturnValue({
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) })),
    channel: vi.fn(() => ({ send: vi.fn().mockResolvedValue("ok") })),
  } as never);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("handlePlayerDisconnect (spec 050)", () => {
  it("records the disconnect and schedules no completion when the window is spent", async () => {
    await handlePlayerDisconnect(MATCH, B);
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS + 5_000);
    expect(completeMatchInternal).not.toHaveBeenCalled();
    expect(getDisconnectedAt(MATCH, B)).not.toBeNull();
  });
});
