import { describe, expect, test, vi } from "vitest";

import { subscribeToMatchChannel } from "@/lib/realtime/matchChannel";

type Handler = (...args: unknown[]) => void;
interface CapturedHandler {
  type: string;
  opts: Record<string, unknown>;
  cb: Handler;
}

interface FakeChannel {
  on: (type: string, opts: Record<string, unknown>, cb: Handler) => FakeChannel;
  subscribe: (cb?: (status: string) => void) => FakeChannel;
  track: (...args: unknown[]) => unknown;
  unsubscribe: () => void;
  presenceState: () => Record<string, unknown>;
}

function createFakeClient() {
  const handlers: CapturedHandler[] = [];
  let subscribeCb: ((status: string) => void) | null = null;
  let lastTopic: string | null = null;
  let lastOpts: Record<string, unknown> | undefined;

  const trackMock = vi.fn();
  const unsubscribeMock = vi.fn();

  const channel: FakeChannel = {
    on(type, opts, cb) {
      handlers.push({ type, opts, cb });
      return channel;
    },
    subscribe(cb) {
      subscribeCb = cb ?? null;
      return channel;
    },
    track: trackMock,
    unsubscribe: unsubscribeMock,
    presenceState: () => ({}),
  };

  const client = {
    channel: vi.fn((topic: string, opts?: Record<string, unknown>) => {
      lastTopic = topic;
      lastOpts = opts;
      return channel;
    }),
  };

  return {
    client,
    channel,
    handlers,
    trackMock,
    triggerSubscribe: (status: string) => subscribeCb?.(status),
    getLastTopic: () => lastTopic,
    getLastOpts: () => lastOpts,
  };
}

describe("subscribeToMatchChannel — presence", () => {
  test("when no presenceKey provided, channel is created without presence config", () => {
    const fake = createFakeClient();

    subscribeToMatchChannel(fake.client as never, "match-1", {});

    expect(fake.getLastTopic()).toBe("match:match-1");
    expect(fake.getLastOpts()).toBeUndefined();
    expect(fake.trackMock).not.toHaveBeenCalled();
  });

  test("when presenceKey provided, channel is configured with presence and tracks self after SUBSCRIBED", () => {
    const fake = createFakeClient();

    subscribeToMatchChannel(fake.client as never, "match-1", {
      presenceKey: "player-a",
    });

    expect(fake.getLastOpts()).toEqual({
      config: { presence: { key: "player-a" } },
    });

    fake.triggerSubscribe("SUBSCRIBED");

    expect(fake.trackMock).toHaveBeenCalledWith({ playerId: "player-a" });
  });

  test("track is NOT called when status is anything other than SUBSCRIBED", () => {
    const fake = createFakeClient();

    subscribeToMatchChannel(fake.client as never, "match-1", {
      presenceKey: "player-a",
    });

    fake.triggerSubscribe("CHANNEL_ERROR");
    expect(fake.trackMock).not.toHaveBeenCalled();
  });

  test("onOpponentLeave fires for other players' presence leave events", () => {
    const fake = createFakeClient();
    const onOpponentLeave = vi.fn();

    subscribeToMatchChannel(fake.client as never, "match-1", {
      presenceKey: "player-a",
      onOpponentLeave,
    });

    const leaveHandler = fake.handlers.find(
      (h) => h.type === "presence" && h.opts.event === "leave",
    );
    expect(leaveHandler).toBeDefined();

    leaveHandler!.cb({ leftPresences: [{ playerId: "player-b" }] });

    expect(onOpponentLeave).toHaveBeenCalledWith({ playerId: "player-b" });
  });

  test("onOpponentLeave ignores own playerId (self-leave is not opponent-leave)", () => {
    const fake = createFakeClient();
    const onOpponentLeave = vi.fn();

    subscribeToMatchChannel(fake.client as never, "match-1", {
      presenceKey: "player-a",
      onOpponentLeave,
    });

    const leaveHandler = fake.handlers.find(
      (h) => h.type === "presence" && h.opts.event === "leave",
    );

    leaveHandler!.cb({ leftPresences: [{ playerId: "player-a" }] });

    expect(onOpponentLeave).not.toHaveBeenCalled();
  });

  test("onOpponentLeave handles multiple left presences and skips self-entries", () => {
    const fake = createFakeClient();
    const onOpponentLeave = vi.fn();

    subscribeToMatchChannel(fake.client as never, "match-1", {
      presenceKey: "player-a",
      onOpponentLeave,
    });

    const leaveHandler = fake.handlers.find(
      (h) => h.type === "presence" && h.opts.event === "leave",
    );

    leaveHandler!.cb({
      leftPresences: [{ playerId: "player-a" }, { playerId: "player-b" }],
    });

    expect(onOpponentLeave).toHaveBeenCalledTimes(1);
    expect(onOpponentLeave).toHaveBeenCalledWith({ playerId: "player-b" });
  });

  test("presence leave handler is NOT registered when presenceKey is absent", () => {
    const fake = createFakeClient();

    subscribeToMatchChannel(fake.client as never, "match-1", {});

    const leaveHandler = fake.handlers.find(
      (h) => h.type === "presence" && h.opts.event === "leave",
    );
    expect(leaveHandler).toBeUndefined();
  });
});
