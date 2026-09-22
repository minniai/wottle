import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Spec 060 FR-015: a match opened under another language's address is sent to
 * the same match under its own, so the board and the words around it agree.
 */
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerReconnect: vi.fn() }));
vi.mock("@/lib/match/stateLoader", () => ({
  loadMatchState: vi.fn(),
  loadMatchPlayerProfiles: vi.fn(async () => ({})),
}));
vi.mock("@/components/room/MatchRoomController", () => ({ MatchRoomController: () => null }));

import MatchPage from "@/app/[locale]/(room)/match/[matchId]/page";
import { loadMatchState } from "@/lib/match/stateLoader";
import { readLobbySession } from "@/lib/matchmaking/profile";

const state = (language: "is" | "en") => ({
  matchId: "m1",
  language,
  state: "in_progress",
  players: { playerA: { playerId: "p1" }, playerB: { playerId: "p2" } },
});

describe("the match page follows the match's language", () => {
  beforeEach(() => {
    vi.mocked(readLobbySession).mockResolvedValue({ player: { id: "p1" } } as never);
  });

  test("an English match opened at /match/m1 goes to /en/match/m1", async () => {
    vi.mocked(loadMatchState).mockResolvedValue(state("en") as never);
    await expect(MatchPage({ params: { matchId: "m1", locale: "is" } })).rejects.toThrow("NEXT_REDIRECT:/en/match/m1");
  });

  test("an Icelandic match opened at /en/match/m1 goes to /match/m1", async () => {
    vi.mocked(loadMatchState).mockResolvedValue(state("is") as never);
    await expect(MatchPage({ params: { matchId: "m1", locale: "en" } })).rejects.toThrow("NEXT_REDIRECT:/match/m1");
  });

  test("a match in the page's language renders", async () => {
    vi.mocked(loadMatchState).mockResolvedValue(state("en") as never);
    await expect(MatchPage({ params: { matchId: "m1", locale: "en" } })).resolves.toBeTruthy();
  });
});
