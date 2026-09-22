import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, refresh: vi.fn() }) }));
vi.mock("@/app/actions/auth/login", () => ({
  loginAction: vi.fn(async () => ({ status: "success", player: { id: "me", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204 } })),
}));
vi.mock("@/app/actions/auth/logout", () => ({ logoutAction: vi.fn().mockResolvedValue({ status: "ok" }) }));
vi.mock("@/app/actions/matchmaking/sendInvite", () => ({
  sendInviteAction: vi.fn().mockResolvedValue({ status: "sent", inviteId: "i1", expiresAt: "" }),
  respondInviteAction: vi.fn().mockResolvedValue({ status: "accepted", matchId: "m9" }),
}));
vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn().mockResolvedValue({ status: "ok", words: [], total: 0 }) }));
vi.mock("@/lib/matchmaking/presenceStore", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    players: [] as unknown[],
    status: "ready",
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
  }));
  return { useLobbyPresenceStore: store };
});

import { LobbyRoomController } from "@/components/room/LobbyRoomController";
import { previewSwap } from "@/app/actions/match/previewSwap";
import { sendInviteAction } from "@/app/actions/matchmaking/sendInvite";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import { usePreferencesStore } from "@/lib/preferences/preferencesStore";
import { useRoomStore } from "@/lib/room/roomStore";
import { OVER_SLIP } from "@/app/dev/room/fixtures";
import type { PlayerIdentity } from "@/lib/types/match";

const me: PlayerIdentity = { id: "me", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204 };
const kari: PlayerIdentity = { id: "k", username: "kari", displayName: "Kári", status: "available", lastSeenAt: "", eloRating: 1191 };
const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

describe("LobbyRoomController (spec 044 US7)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    useRoomStore.setState({ viewer: null, board: [] });
    usePreferencesStore.setState({ previewEnabled: false });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ pending: [], match: null }) });
    vi.stubGlobal("fetch", fetchMock);
    mockReplace.mockClear();
    vi.mocked(previewSwap).mockClear();
    (useLobbyPresenceStore as unknown as { setState: (s: object) => void }).setState({ players: [] });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Spec 048 US4: no field before a name — an empty frame under the sign-in slip.
  it("signed out: empty top bar without an action, the sign-in slip over an empty frame, no letters, no polling", () => {
    render(<LobbyRoomController viewer={null} initialPlayers={[]} recentGames={null} />);
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "lobby");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("No opponent yet");
    expect(screen.queryByTestId("player-bar-action-find")).toBeNull();
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("sign in to set the field");
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveAttribute("data-kind", "signIn");
    expect(slip).toContainElement(screen.getByTestId("player-bar-name-input"));
    expect(screen.getByTestId("slip-how-to-play")).toHaveAttribute("href", "/rules");
    expect(screen.getAllByRole("gridcell")).toHaveLength(100);
    expect(screen.getAllByRole("gridcell").every((c) => c.textContent === "")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signed out, the field takes no pick", () => {
    render(<LobbyRoomController viewer={null} initialPlayers={[]} recentGames={null} />);
    fireEvent.click(cell(0, 0));
    expect(cell(0, 0)).not.toHaveAttribute("data-state", "picked");
  });

  it("warm-up swap is local: letters exchange, nothing is posted, no pricing", () => {
    render(<LobbyRoomController viewer={{ id: "p1", username: "birna", displayName: "Birna", status: "available", lastSeenAt: "", eloRating: 1204 }} initialPlayers={[]} recentGames={null} />);
    const a = cell(0, 0).textContent;
    const b = cell(1, 0).textContent;
    fireEvent.click(cell(0, 0));
    fireEvent.click(cell(1, 0));
    expect(cell(0, 0).textContent).toBe(b);
    expect(cell(1, 0).textContent).toBe(a);
    expect(previewSwap).not.toHaveBeenCalled();
  });

  it("signing in converts the bottom bar in place and replaces the URL with /lobby", async () => {
    window.history.replaceState(null, "", "/");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
    render(<LobbyRoomController viewer={null} initialPlayers={[]} recentGames={null} />);
    const field = screen.getByTestId("field");
    fireEvent.change(screen.getByTestId("player-bar-name-input"), { target: { value: "birna" } });
    fireEvent.submit(screen.getByTestId("name-input-form"));
    await waitFor(() => expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("Birna"));
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("1204 · you");
    expect(screen.queryByTestId("player-bar-name-input")).toBeNull();
    expect(screen.queryByTestId("slip")).toBeNull();
    // The letters land after the name (spec 048 FR-014); the first is already on its way.
    await waitFor(() => expect(cell(0, 0).textContent).not.toBe(""));
    // Same page element: the URL is rewritten in place, never routed (a route swap would remount the field).
    expect(replaceState).toHaveBeenCalledWith(null, "", "/lobby");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("field")).toBe(field);
    replaceState.mockRestore();
  });

  it("signed-in render at / rewrites the URL to /lobby in place (the server never redirects /; the field must not remount)", () => {
    window.history.replaceState(null, "", "/");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
    render(<LobbyRoomController viewer={me} initialPlayers={[me]} recentGames={[]} />);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/lobby");
    expect(mockReplace).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  // Reported 2026-09-21: `lobby` on the match-over slip showed the lobby with the slip still over it.
  it("arriving from a finished match takes the match-over slip down", () => {
    useRoomStore.setState({ phase: "final", slip: OVER_SLIP });
    render(<LobbyRoomController viewer={me} initialPlayers={[me]} recentGames={[]} />);
    expect(useRoomStore.getState().slip).toBeNull();
    expect(screen.queryByTestId("slip")).toBeNull();
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "lobby");
  });

  it("signed in: here-now lists others with challenge ▸; challenging sends the invite; preview prices the warm-up", async () => {
    (useLobbyPresenceStore as unknown as { setState: (s: object) => void }).setState({ players: [me, kari] });
    usePreferencesStore.setState({ previewEnabled: true });
    render(<LobbyRoomController viewer={me} initialPlayers={[me, kari]} recentGames={[]} />);
    expect(screen.getByTestId("player-bar-action-find")).not.toBeDisabled();
    expect(screen.getByTestId("ledger-context")).toHaveTextContent("lobby · 1 here");
    fireEvent.click(screen.getByTestId("ledger-challenge-k"));
    expect(sendInviteAction).toHaveBeenCalledWith("k");
    fireEvent.click(cell(0, 0));
    fireEvent.click(cell(1, 0));
    expect(previewSwap).toHaveBeenCalledWith(expect.objectContaining({ kind: "warmup" }));
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/lobby") || String(url).startsWith("/api/match/active"))).toBe(true);
  });

  it("an incoming challenge is a ledger line; accepting navigates into the match", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith("/api/lobby/invite")
        ? { ok: true, json: async () => ({ pending: [{ id: "i1", sender: { id: "k", username: "kari", displayName: "Kári" }, expiresAt: "" }] }) }
        : { ok: true, json: async () => ({ match: null }) },
    );
    render(<LobbyRoomController viewer={me} initialPlayers={[me]} recentGames={[]} />);
    await waitFor(() => expect(screen.getByTestId("notice-accept-challenge")).toBeInTheDocument());
    expect(screen.getByTestId("ledger-notice")).toHaveTextContent("Kári challenges you");
    await act(async () => {
      fireEvent.click(screen.getByTestId("notice-accept-challenge"));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/match/m9"));
  });

  it("two challengers each get a line; an answered or expired challenge leaves the ledger", async () => {
    const nari = { id: "i1", sender: { id: "n", username: "nari", displayName: "Nari" }, expiresAt: "" };
    const silu = { id: "i2", sender: { id: "s", username: "silu", displayName: "Silú" }, expiresAt: "" };
    let pending = [nari];
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith("/api/lobby/invite") ? { ok: true, json: async () => ({ pending, outgoing: null }) } : { ok: true, json: async () => ({ match: null }) },
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<LobbyRoomController viewer={me} initialPlayers={[me]} recentGames={[]} />);
      await waitFor(() => expect(screen.getAllByTestId("ledger-notice")).toHaveLength(1));
      pending = [nari, silu];
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      await waitFor(() => expect(screen.getAllByTestId("ledger-notice").map((n) => n.textContent)).toEqual([
        expect.stringContaining("Nari challenges you"),
        expect.stringContaining("Silú challenges you"),
      ]));
      // Nari's challenge expires: her line goes, Silú's stays.
      pending = [silu];
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      await waitFor(() => expect(screen.getAllByTestId("ledger-notice").map((n) => n.textContent)).toEqual([expect.stringContaining("Silú challenges you")]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("the challenger sees the challenge wait, then what became of it", async () => {
    (useLobbyPresenceStore as unknown as { setState: (s: object) => void }).setState({ players: [me, kari] });
    let outgoing: object | null = null;
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith("/api/lobby/invite") ? { ok: true, json: async () => ({ pending: [], outgoing }) } : { ok: true, json: async () => ({ match: null }) },
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<LobbyRoomController viewer={me} initialPlayers={[me, kari]} recentGames={[]} />);
      await act(async () => {
        fireEvent.click(screen.getByTestId("ledger-challenge-k"));
      });
      await waitFor(() => expect(screen.getByTestId("ledger-notice")).toHaveTextContent("challenge sent · waiting for Kári"));
      outgoing = { id: "i1", status: "pending", recipientName: "Kári", recipientInMatch: false };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      expect(screen.getByTestId("ledger-notice")).toHaveTextContent("challenge sent · waiting for Kári");
      // Kári took Silú's challenge: this one was answered for him.
      outgoing = { id: "i1", status: "declined", recipientName: "Kári", recipientInMatch: true };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      await waitFor(() => expect(screen.getByTestId("ledger-notice")).toHaveTextContent("Kári took another challenge"));
      expect(screen.getAllByTestId("ledger-notice")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("find an opponent ▸ moves to the queue route; sign out clears the viewer", async () => {
    render(<LobbyRoomController viewer={me} initialPlayers={[me]} recentGames={[]} />);
    fireEvent.click(screen.getByTestId("player-bar-action-find"));
    expect(mockReplace).toHaveBeenCalledWith("/matchmaking");
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-signout"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(useRoomStore.getState().viewer).toBeNull();
  });

  it("never returns to a match it was bounced out of", async () => {
    // The match page redirects here when a match fails to load, and the invite
    // poll reports the same match as active. Without this the two bounce the
    // player between them forever (Vercel, 2026-09-15).
    window.history.replaceState(null, "", "/lobby?notice=no-match&match=m-broken");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ pending: [], match: { id: "m-broken" } }) });

    render(<LobbyRoomController viewer={me} initialPlayers={[]} recentGames={null} />);
    await waitFor(() => expect(screen.getByTestId("ledger-notice")).toHaveTextContent("that match does not exist"));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockReplace).not.toHaveBeenCalledWith("/match/m-broken");
  });

  it("still follows the poll to a different active match", async () => {
    window.history.replaceState(null, "", "/lobby?notice=no-match&match=m-broken");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ pending: [], match: { id: "m-other" } }) });

    render(<LobbyRoomController viewer={me} initialPlayers={[]} recentGames={null} />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/match/m-other"));
  });

  it("shows a notice when redirected from a match that does not exist", async () => {
    window.history.replaceState(null, "", "/lobby?notice=no-match");
    render(<LobbyRoomController viewer={me} initialPlayers={[]} recentGames={null} />);
    await waitFor(() => expect(screen.getByTestId("ledger-notice")).toHaveTextContent("that match does not exist"));
    // Cleared from the URL so a reload does not repeat it.
    await waitFor(() => expect(window.location.search).toBe(""));
  });
});
