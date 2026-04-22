import { afterEach, describe, expect, test, vi } from "vitest";

import {
  HEARTBEAT_STALE_THRESHOLD_MS,
  __resetHeartbeatStoreForTests,
  clearHeartbeat,
  getLastHeartbeat,
  isHeartbeatStale,
  recordHeartbeat,
} from "@/lib/match/heartbeatStore";

afterEach(() => {
  __resetHeartbeatStoreForTests();
  vi.useRealTimers();
});

describe("heartbeatStore", () => {
  test("recordHeartbeat stores a timestamp retrievable by getLastHeartbeat", () => {
    const before = Date.now();
    recordHeartbeat("match-1", "player-a");
    const after = Date.now();

    const ts = getLastHeartbeat("match-1", "player-a");
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before);
    expect(ts!).toBeLessThanOrEqual(after);
  });

  test("getLastHeartbeat returns null for an unrecorded player", () => {
    expect(getLastHeartbeat("match-1", "player-a")).toBeNull();
  });

  test("recordHeartbeat scopes by (matchId, playerId) — different players in same match are independent", () => {
    recordHeartbeat("match-1", "player-a");
    expect(getLastHeartbeat("match-1", "player-b")).toBeNull();
  });

  test("recordHeartbeat scopes by matchId — same player in different matches are independent", () => {
    recordHeartbeat("match-1", "player-a");
    expect(getLastHeartbeat("match-2", "player-a")).toBeNull();
  });

  test("isHeartbeatStale returns false when no heartbeat exists (player has never polled)", () => {
    expect(isHeartbeatStale("match-1", "player-a")).toBe(false);
  });

  test("isHeartbeatStale returns false immediately after recordHeartbeat", () => {
    recordHeartbeat("match-1", "player-a");
    expect(isHeartbeatStale("match-1", "player-a")).toBe(false);
  });

  test("isHeartbeatStale returns true when last heartbeat exceeds the threshold", () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-22T12:00:00Z").getTime();
    vi.setSystemTime(start);
    recordHeartbeat("match-1", "player-a");

    vi.setSystemTime(start + HEARTBEAT_STALE_THRESHOLD_MS + 1);
    expect(isHeartbeatStale("match-1", "player-a")).toBe(true);
  });

  test("isHeartbeatStale returns false when last heartbeat is exactly at the threshold", () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-22T12:00:00Z").getTime();
    vi.setSystemTime(start);
    recordHeartbeat("match-1", "player-a");

    vi.setSystemTime(start + HEARTBEAT_STALE_THRESHOLD_MS);
    expect(isHeartbeatStale("match-1", "player-a")).toBe(false);
  });

  test("recordHeartbeat refreshes a previously-stale entry", () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-22T12:00:00Z").getTime();
    vi.setSystemTime(start);
    recordHeartbeat("match-1", "player-a");

    vi.setSystemTime(start + HEARTBEAT_STALE_THRESHOLD_MS + 5_000);
    expect(isHeartbeatStale("match-1", "player-a")).toBe(true);

    recordHeartbeat("match-1", "player-a");
    expect(isHeartbeatStale("match-1", "player-a")).toBe(false);
  });

  test("clearHeartbeat removes the entry — subsequent isHeartbeatStale returns false (treated as never-polled)", () => {
    recordHeartbeat("match-1", "player-a");
    clearHeartbeat("match-1", "player-a");
    expect(getLastHeartbeat("match-1", "player-a")).toBeNull();
    expect(isHeartbeatStale("match-1", "player-a")).toBe(false);
  });

  test("isHeartbeatStale accepts a custom now value for deterministic checks", () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-22T12:00:00Z").getTime();
    vi.setSystemTime(start);
    recordHeartbeat("match-1", "player-a");

    expect(
      isHeartbeatStale(
        "match-1",
        "player-a",
        start + HEARTBEAT_STALE_THRESHOLD_MS + 1,
      ),
    ).toBe(true);
    expect(
      isHeartbeatStale("match-1", "player-a", start + 1_000),
    ).toBe(false);
  });
});
