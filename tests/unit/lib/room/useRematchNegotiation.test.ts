import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/match/cancelRematch", () => ({ cancelRematchAction: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/app/actions/match/requestRematch", () => ({ requestRematchAction: vi.fn() }));
vi.mock("@/app/actions/match/respondToRematch", () => ({ acceptRematchAction: vi.fn(), declineRematchAction: vi.fn() }));

import { acceptRematchAction } from "@/app/actions/match/respondToRematch";
import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { useRematchNegotiation } from "@/lib/room/useRematchNegotiation";

function negotiate() {
  const onNewMatch = vi.fn();
  const hook = renderHook(() => useRematchNegotiation({ matchId: "m1", currentPlayerId: "birna", onNewMatch }));
  return { hook, onNewMatch };
}

describe("useRematchNegotiation (spec 067: a rematch is refused while either player is busy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should say the other player is busy when accepting is refused, and open nothing", async () => {
    vi.mocked(acceptRematchAction).mockResolvedValue({ status: "busy" });
    const { hook, onNewMatch } = negotiate();
    act(() => hook.result.current.handleEvent({ type: "rematch-request", matchId: "m1", requesterId: "kari", status: "pending" }));
    await act(async () => {
      await hook.result.current.accept();
    });
    expect(hook.result.current.phase).toBe("busy");
    expect(onNewMatch).not.toHaveBeenCalled();
  });

  it("should say the other player is busy when crossed requests are refused, instead of waiting", async () => {
    vi.mocked(requestRematchAction).mockResolvedValue({ status: "busy" });
    const { hook } = negotiate();
    await act(async () => {
      await hook.result.current.request();
    });
    expect(hook.result.current.phase).toBe("busy");
  });

  it("should open the new match when accepting succeeds", async () => {
    vi.mocked(acceptRematchAction).mockResolvedValue({ status: "accepted", matchId: "m2" });
    const { hook, onNewMatch } = negotiate();
    act(() => hook.result.current.handleEvent({ type: "rematch-request", matchId: "m1", requesterId: "kari", status: "pending" }));
    await act(async () => {
      await hook.result.current.accept();
    });
    expect(onNewMatch).toHaveBeenCalledWith("m2");
  });
});

describe("useRematchNegotiation (spec 070 US9: the rematch is a poke, the id comes from a read)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("an accepted event carries no id: it reads the match state route and goes to the id from that response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ rematchMatchId: "m9" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { hook, onNewMatch } = negotiate();
    await act(async () => {
      hook.result.current.handleEvent({ type: "rematch-accepted", matchId: "m1", requesterId: "kari", status: "accepted" });
    });
    await vi.waitFor(() => expect(onNewMatch).toHaveBeenCalledWith("m9"));
    expect(fetchMock).toHaveBeenCalledWith("/api/match/m1/state", expect.objectContaining({ cache: "no-store" }));
    expect(hook.result.current.phase).toBe("accepted");
    vi.unstubAllGlobals();
  });

  it("a rematch poke with nothing to go to changes nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rematchMatchId: null }), { status: 200 })));
    const { hook, onNewMatch } = negotiate();
    await act(async () => {
      await hook.result.current.check();
    });
    expect(onNewMatch).not.toHaveBeenCalled();
    expect(hook.result.current.phase).toBe("idle");
    vi.unstubAllGlobals();
  });
});
