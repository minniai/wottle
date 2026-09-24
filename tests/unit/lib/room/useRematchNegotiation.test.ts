import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/match/requestRematch", () => ({ requestRematchAction: vi.fn() }));
vi.mock("@/app/actions/match/respondToRematch", () => ({ acceptRematchAction: vi.fn(), declineRematchAction: vi.fn() }));
vi.mock("@/app/actions/match/withdrawRematch", () => ({ withdrawRematchAction: vi.fn(async () => ({ status: "withdrawn" })) }));

import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { acceptRematchAction, declineRematchAction } from "@/app/actions/match/respondToRematch";
import { withdrawRematchAction } from "@/app/actions/match/withdrawRematch";
import { useRematchNegotiation } from "@/lib/room/useRematchNegotiation";
import type { RematchOffer } from "@/lib/types/match";

const OFFER: RematchOffer = { offered: true, reason: null, request: null, windowEndsAt: "2099-01-01T00:00:00.000Z", cooldownUntil: null, opponentOnMatch: true, opponentHere: true };
const PENDING_MINE = { id: "r1", requesterId: "birna", status: "pending" as const, createdAt: "2026-09-24T12:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z", newMatchId: null };

function stateResponse(rematch: RematchOffer) {
  return new Response(JSON.stringify({ matchId: "m1", rematch }), { status: 200 });
}

function negotiate(initialOffer: RematchOffer | null = OFFER, active = true) {
  const onNewMatch = vi.fn();
  const hook = renderHook(() => useRematchNegotiation({ matchId: "m1", viewerId: "birna", active, initialOffer, onNewMatch }));
  return { hook, onNewMatch };
}

/** Spec 071 (R9): the hook holds the server's offer and sends commands; it never decides. */
describe("useRematchNegotiation", () => {
  let fetchMock: ReturnType<typeof vi.fn<[], Promise<Response>>>;
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn<[], Promise<Response>>(async () => stateResponse(OFFER));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts from the offer the page was served", () => {
    const { hook } = negotiate();
    expect(hook.result.current.offer).toEqual(OFFER);
  });

  it("sends a request and reads the offer again", async () => {
    vi.mocked(requestRematchAction).mockResolvedValue({ status: "sent", expiresAt: PENDING_MINE.expiresAt });
    fetchMock.mockResolvedValue(stateResponse({ ...OFFER, offered: false, request: PENDING_MINE }));
    const { hook } = negotiate();
    await act(async () => {
      await hook.result.current.request();
    });
    expect(requestRematchAction).toHaveBeenCalledWith("m1");
    expect(hook.result.current.offer?.request?.status).toBe("pending");
  });

  it("goes to the new match when a press crossed the other player's", async () => {
    vi.mocked(requestRematchAction).mockResolvedValue({ status: "accepted", matchId: "m2" });
    const { hook, onNewMatch } = negotiate();
    await act(async () => {
      await hook.result.current.request();
    });
    expect(onNewMatch).toHaveBeenCalledWith("m2");
  });

  it("goes to the new match on accept, and reads the offer when the accept fails", async () => {
    vi.mocked(acceptRematchAction).mockResolvedValue({ status: "accepted", matchId: "m2" });
    const { hook, onNewMatch } = negotiate({ ...OFFER, offered: false, request: { ...PENDING_MINE, requesterId: "kari" } });
    await act(async () => {
      await hook.result.current.accept();
    });
    expect(onNewMatch).toHaveBeenCalledWith("m2");
    vi.mocked(acceptRematchAction).mockResolvedValue({ status: "busy" });
    await act(async () => {
      await hook.result.current.accept();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/match/m1/state", expect.anything());
  });

  it("declines and withdraws through their actions", async () => {
    vi.mocked(declineRematchAction).mockResolvedValue({ status: "declined" });
    const { hook } = negotiate();
    await act(async () => {
      await hook.result.current.decline();
      await hook.result.current.withdraw();
    });
    expect(declineRematchAction).toHaveBeenCalledWith("m1");
    expect(withdrawRematchAction).toHaveBeenCalledWith("m1");
  });

  it("on a rematch poke, reads the offer and follows an accepted request to its match (spec 070 FR-034)", async () => {
    fetchMock.mockResolvedValue(stateResponse({ ...OFFER, offered: false, request: { ...PENDING_MINE, status: "accepted", newMatchId: "m9" } }));
    const { hook, onNewMatch } = negotiate();
    await act(async () => {
      await hook.result.current.refresh();
    });
    expect(onNewMatch).toHaveBeenCalledWith("m9");
  });

  it("withdraws its own pending request when the room goes away", async () => {
    const { hook } = negotiate({ ...OFFER, offered: false, request: PENDING_MINE });
    hook.unmount();
    expect(withdrawRematchAction).toHaveBeenCalledWith("m1");
  });
});
