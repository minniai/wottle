import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

/**
 * Regression test for the silent-decay bug where `lobby_presence.expires_at`
 * was never refreshed after login, causing players to vanish from every other
 * client's `/api/lobby/players` response after 5 minutes (PRESENCE_TTL).
 *
 * The fix adds a 60s heartbeat on the client that POSTs to
 * `/api/lobby/presence`; this test asserts the heartbeat is scheduled on
 * `connect()` and cleared on `disconnect()`.
 */
describe("presenceStore heartbeat", () => {
  const self: PlayerIdentity = {
    id: "self-player-id",
    username: "self",
    displayName: "Self",
    avatarUrl: null,
    status: "available",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    eloRating: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        ),
      ),
    );

    vi.mock("@/lib/supabase/browser", () => ({
      getBrowserSupabaseClient: () => ({
        channel: () => ({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
          unsubscribe: vi.fn(),
          track: vi.fn(),
          presenceState: () => ({}),
        }),
      }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("connect() fires an immediate heartbeat and schedules a 60s interval", async () => {
    const { useLobbyPresenceStore } = await import(
      "@/lib/matchmaking/presenceStore"
    );

    await useLobbyPresenceStore.getState().connect({
      self,
      initialPlayers: [self],
    });

    await vi.advanceTimersByTimeAsync(0);

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c[0] === "/api/lobby/presence")
      .filter((c) => c[1]?.method === "POST");

    expect(calls.length).toBeGreaterThanOrEqual(1);

    // Advance through two full intervals → expect two more heartbeats (total ≥ 3).
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);

    const afterCalls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c[0] === "/api/lobby/presence")
      .filter((c) => c[1]?.method === "POST");

    expect(afterCalls.length).toBeGreaterThanOrEqual(3);
  });

  test("disconnect() stops the heartbeat interval", async () => {
    const { useLobbyPresenceStore } = await import(
      "@/lib/matchmaking/presenceStore"
    );

    await useLobbyPresenceStore.getState().connect({
      self,
      initialPlayers: [self],
    });

    await vi.advanceTimersByTimeAsync(0);

    const postsBeforeDisconnect = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c[0] === "/api/lobby/presence" && c[1]?.method === "POST").length;

    useLobbyPresenceStore.getState().disconnect();

    // No more heartbeat posts should happen after disconnect.
    await vi.advanceTimersByTimeAsync(120_000);

    const postsAfterDisconnect = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c[0] === "/api/lobby/presence" && c[1]?.method === "POST").length;

    expect(postsAfterDisconnect).toBe(postsBeforeDisconnect);
  });
});
