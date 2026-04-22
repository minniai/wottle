import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/stateLoader", () => ({
  loadMatchState: vi.fn().mockResolvedValue({
    matchId: "m1",
    board: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
    currentRound: 10,
    state: "completed",
    timers: {
      playerA: { playerId: "a", remainingMs: 120_000, status: "expired" },
      playerB: { playerId: "b", remainingMs: 110_000, status: "expired" },
    },
    scores: { playerA: 91, playerB: 124 },
    lastSummary: null,
    frozenTiles: {},
  }),
}));

import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";

type SubscribeCb = (status: string) => void;
interface MockChannel {
  subscribe: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function makeMockClient(opts: {
  /** Invoked with the subscribe callback — caller decides whether/when to fire it. */
  onSubscribe: (cb: SubscribeCb) => void;
  onSend?: () => Promise<"ok" | "error">;
}) {
  const removeChannel = vi.fn();
  const channel: MockChannel = {
    subscribe: vi.fn(),
    send: vi.fn().mockImplementation(opts.onSend ?? (async () => "ok")),
  };
  channel.subscribe.mockImplementation((cb: SubscribeCb) => {
    opts.onSubscribe(cb);
    return channel;
  });
  return {
    channel: vi.fn().mockReturnValue(channel),
    removeChannel,
  };
}

describe("statePublisher.publishMatchState", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("resolves within ~2s when channel.subscribe never reports SUBSCRIBED (hung channel)", async () => {
    vi.useFakeTimers();
    const mockClient = makeMockClient({
      onSubscribe: () => {
        // Intentionally do nothing — simulates a hung subscribe.
      },
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const pending = publishMatchState("m1");

    // Advance past the 2s timeout
    await vi.advanceTimersByTimeAsync(2_100);
    await pending;

    expect(mockClient.removeChannel).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Channel subscribe timed out"),
    );

    errorSpy.mockRestore();
  });

  it("resolves immediately on CHANNEL_ERROR", async () => {
    const mockClient = makeMockClient({
      onSubscribe: (cb) => cb("CHANNEL_ERROR"),
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await publishMatchState("m1");

    expect(mockClient.removeChannel).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Channel subscription failed: CHANNEL_ERROR"),
    );
    errorSpy.mockRestore();
  });

  it("sends the broadcast when subscribe reaches SUBSCRIBED", async () => {
    const mockClient = makeMockClient({
      onSubscribe: (cb) => cb("SUBSCRIBED"),
      onSend: async () => "ok",
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    await publishMatchState("m1");

    const ch = mockClient.channel.mock.results[0].value as { send: ReturnType<typeof vi.fn> };
    expect(ch.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "state",
      payload: expect.objectContaining({ matchId: "m1", state: "completed" }),
    });
    expect(mockClient.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("does not double-resolve if SUBSCRIBED fires after the timeout (late callback is a no-op)", async () => {
    vi.useFakeTimers();
    let storedCb: SubscribeCb | null = null;
    const mockClient = makeMockClient({
      onSubscribe: (cb) => {
        storedCb = cb;
      },
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const pending = publishMatchState("m1");
    await vi.advanceTimersByTimeAsync(2_100); // trigger timeout
    await pending;

    // Fire the (late) SUBSCRIBED — should not re-enter send or double-remove
    (storedCb as SubscribeCb | null)?.("SUBSCRIBED");

    const ch = mockClient.channel.mock.results[0].value as { send: ReturnType<typeof vi.fn> };
    expect(ch.send).not.toHaveBeenCalled();
    expect(mockClient.removeChannel).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
