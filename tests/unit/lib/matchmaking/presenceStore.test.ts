import { describe, expect, it } from "vitest";

import type { PlayerIdentity } from "../../../../lib/types/match";
import { applyLobbyEvent } from "../../../../lib/matchmaking/presenceStore";

const alpha: PlayerIdentity = {
  id: "player-alpha",
  username: "alpha",
  displayName: "Alpha",
  avatarUrl: null,
  status: "available",
  lastSeenAt: "2025-11-15T12:00:00.000Z",
  eloRating: null,
};

const beta: PlayerIdentity = {
  id: "player-beta",
  username: "beta",
  displayName: "Beta",
  avatarUrl: null,
  status: "available",
  lastSeenAt: "2025-11-15T12:05:00.000Z",
  eloRating: null,
};

describe("applyLobbyEvent", () => {
  it("replaces players on sync while deduplicating and sorting", () => {
    const snapshot = applyLobbyEvent([alpha], {
      type: "sync",
      players: [beta, alpha, beta],
    });

    expect(snapshot).toEqual([alpha, beta]);
  });

  it("adds or replaces a player on join", () => {
    const joined = applyLobbyEvent([alpha], {
      type: "join",
      player: beta,
    });

    expect(joined).toEqual([alpha, beta]);

    const replaced = applyLobbyEvent(joined, {
      type: "join",
      player: { ...beta, status: "matchmaking" },
    });

    expect(replaced.map((player) => player.status)).toEqual([
      "available",
      "matchmaking",
    ]);
  });

  it("removes a player on leave events", () => {
    const afterLeave = applyLobbyEvent([alpha, beta], {
      type: "leave",
      playerId: beta.id,
    });

    expect(afterLeave).toEqual([alpha]);
  });

  it("keeps collection unchanged when leave target missing", () => {
    const afterLeave = applyLobbyEvent([alpha], {
      type: "leave",
      playerId: "unknown",
    });

    expect(afterLeave).toEqual([alpha]);
  });
});


