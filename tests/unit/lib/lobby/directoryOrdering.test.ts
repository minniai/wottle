import { describe, expect, test } from "vitest";

import { orderDirectory } from "@/lib/lobby/directoryOrdering";
import type { PlayerIdentity } from "@/lib/types/match";

function player(
  id: string,
  overrides: Partial<PlayerIdentity> = {},
): PlayerIdentity {
  return {
    id,
    username: id,
    displayName: id,
    status: "available",
    lastSeenAt: "2026-04-16T10:00:00.000Z",
    eloRating: 1200,
    ...overrides,
  };
}

describe("orderDirectory", () => {
  test("empty input returns empty visible+hidden", () => {
    const result = orderDirectory({
      players: [],
      selfId: "me",
      viewerRating: 1200,
    });
    expect(result.visible).toEqual([]);
    expect(result.hidden).toEqual([]);
  });

  test("single-player input containing self returns [self]", () => {
    const self = player("me");
    const result = orderDirectory({
      players: [self],
      selfId: "me",
      viewerRating: 1200,
    });
    expect(result.visible).toEqual([self]);
    expect(result.hidden).toEqual([]);
  });

  test("respects the cap and pins self even outside the top N", () => {
    const others = Array.from({ length: 30 }, (_, i) =>
      player(`p${i}`, { eloRating: 1100 }),
    );
    const self = player("me", { eloRating: 1500, status: "offline" });
    const result = orderDirectory({
      players: [...others, self],
      selfId: "me",
      viewerRating: 1500,
      cap: 24,
    });
    expect(result.visible.length).toBe(24);
    expect(result.visible.some((p) => p.id === "me")).toBe(true);
    expect(result.hidden.length).toBe(30 - 23); // 7
  });

  test("available players rank above other statuses", () => {
    const avail = player("a", { status: "available" });
    const mm = player("b", { status: "matchmaking" });
    const inMatch = player("c", { status: "in_match" });
    const result = orderDirectory({
      players: [inMatch, mm, avail],
      selfId: "me",
      viewerRating: 1200,
    });
    expect(result.visible.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  test("closer absolute rating difference ranks higher within same status", () => {
    const close = player("close", { eloRating: 1210 });
    const far = player("far", { eloRating: 1500 });
    const result = orderDirectory({
      players: [far, close],
      selfId: "me",
      viewerRating: 1200,
    });
    expect(result.visible[0]!.id).toBe("close");
  });

  test("most-recently-seen wins ties on status + rating", () => {
    const recent = player("recent", {
      eloRating: 1200,
      lastSeenAt: "2026-04-16T10:05:00.000Z",
    });
    const older = player("older", {
      eloRating: 1200,
      lastSeenAt: "2026-04-16T09:00:00.000Z",
    });
    const result = orderDirectory({
      players: [older, recent],
      selfId: "me",
      viewerRating: 1200,
    });
    expect(result.visible[0]!.id).toBe("recent");
  });
});
