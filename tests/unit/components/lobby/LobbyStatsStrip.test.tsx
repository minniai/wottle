import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

const mockStoreState: {
  players: PlayerIdentity[];
  connectionMode: "realtime" | "polling";
} = {
  players: [],
  connectionMode: "realtime",
};

vi.mock("@/lib/matchmaking/presenceStore", () => ({
  useLobbyPresenceStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

import { LobbyStatsStrip } from "@/components/lobby/LobbyStatsStrip";

function makePlayers(n: number): PlayerIdentity[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    username: `p${i}`,
    displayName: `P${i}`,
    status: "available",
    lastSeenAt: new Date().toISOString(),
    eloRating: 1200,
  }));
}

beforeEach(() => {
  mockStoreState.players = [];
  mockStoreState.connectionMode = "realtime";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("LobbyStatsStrip", () => {
  test("renders the online count derived from presence store", () => {
    mockStoreState.players = makePlayers(3);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ matchesInProgress: 0 })),
    );
    render(<LobbyStatsStrip />);
    expect(screen.getByTestId("lobby-stats-online").textContent).toContain("3");
  });

  test("renders matches-in-progress count from the fetched payload", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ matchesInProgress: 7 })),
    );
    render(<LobbyStatsStrip />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId("lobby-stats-matches").textContent).toContain(
      "7",
    );
  });

  test("falls back to last-known value when poll fails", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ matchesInProgress: 4 })),
      )
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));
    render(<LobbyStatsStrip />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId("lobby-stats-matches").textContent).toContain(
      "4",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("lobby-stats-matches").textContent).toContain(
      "4",
    );
  });

  test("shows Realtime connection chip when store reports realtime mode", () => {
    mockStoreState.connectionMode = "realtime";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ matchesInProgress: 0 })),
    );
    render(<LobbyStatsStrip />);
    expect(screen.getByTestId("lobby-connection-mode").textContent).toMatch(
      /realtime/i,
    );
  });

  test("shows Polling connection chip when store reports polling mode", () => {
    mockStoreState.connectionMode = "polling";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ matchesInProgress: 0 })),
    );
    render(<LobbyStatsStrip />);
    expect(screen.getByTestId("lobby-connection-mode").textContent).toMatch(
      /polling/i,
    );
  });
});
