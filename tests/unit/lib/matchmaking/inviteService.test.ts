import { describe, expect, it } from "vitest";

import {
  calculateInviteExpiry,
  isInviteExpired,
  selectQueueOpponent,
} from "../../../../lib/matchmaking/inviteService";

describe("inviteService helpers", () => {
  it("calculates expiry timestamps using the provided TTL", () => {
    const now = new Date("2025-11-17T12:00:00.000Z");
    const expiry = calculateInviteExpiry(now, 45);
    expect(expiry).toBe("2025-11-17T12:00:45.000Z");
  });

  it("detects expired invites based on creation time", () => {
    const now = new Date("2025-11-17T12:01:00.000Z");
    const createdAt = "2025-11-17T12:00:00.000Z";
    expect(isInviteExpired(createdAt, now, 30)).toBe(true);
    expect(isInviteExpired(createdAt, now, 90)).toBe(false);
  });

  it("prefers the oldest waiting opponent in queue arbitration", () => {
    const candidate = selectQueueOpponent(
      [
        { id: "a", lastSeenAt: "2025-11-17T12:00:00Z" },
        { id: "b", lastSeenAt: "2025-11-17T12:00:05Z" },
      ],
      "self"
    );
    expect(candidate?.id).toBe("a");
  });

  it("returns null when no valid opponents are found", () => {
    const candidate = selectQueueOpponent(
      [{ id: "self", lastSeenAt: "2025-11-17T12:00:00Z" }],
      "self"
    );
    expect(candidate).toBeNull();
  });
});


