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
