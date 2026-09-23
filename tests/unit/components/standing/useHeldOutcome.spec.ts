import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHeldOutcome } from "@/components/standing/hooks/useHeldOutcome";
import type { OutgoingChallenge } from "@/lib/types/standing";

const ID = "00000000-0000-4000-8000-000000000001";
const outgoing = (status: OutgoingChallenge["status"], extra: Partial<OutgoingChallenge> = {}): OutgoingChallenge => ({
  inviteId: ID,
  to: { playerId: "00000000-0000-4000-8000-000000000002", displayName: "Embla", handle: "embla", rating: 1342, state: "here", movesPlayed: null, record: null },
  status,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  respondedAt: status === "pending" ? null : new Date().toISOString(),
  matchId: null,
  ...extra,
});

/** Spec 070 US3.4, US3.6 (T065): what became of your challenge stays 4s; accepted stays 400ms, then the table. */
describe("useHeldOutcome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds an outcome for 4s from when it was first seen", () => {
    const onAccepted = vi.fn();
    const { result, rerender } = renderHook(({ o }) => useHeldOutcome(o, onAccepted), { initialProps: { o: outgoing("pending") as OutgoingChallenge | null } });
    expect(result.current).toBeNull();
    rerender({ o: outgoing("declined") });
    expect(result.current).toMatchObject({ outcome: "declined", name: "Embla", playerId: "00000000-0000-4000-8000-000000000002" });
    act(() => void vi.advanceTimersByTime(3_900));
    rerender({ o: outgoing("declined") });
    expect(result.current?.outcome).toBe("declined");
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBeNull();
  });

  it("holds accepted for 400ms, then hands over the match", () => {
    const onAccepted = vi.fn();
    const { result, rerender } = renderHook(({ o }) => useHeldOutcome(o, onAccepted), { initialProps: { o: outgoing("pending") as OutgoingChallenge | null } });
    rerender({ o: outgoing("accepted", { matchId: "00000000-0000-4000-8000-000000000009" }) });
    expect(result.current?.outcome).toBe("accepted");
    act(() => void vi.advanceTimersByTime(400));
    expect(onAccepted).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000009");
  });

  it("does not hold an outcome it has already shown, however often the read repeats", () => {
    const { result, rerender } = renderHook(({ o }) => useHeldOutcome(o, vi.fn()), { initialProps: { o: outgoing("expired") as OutgoingChallenge | null } });
    expect(result.current?.outcome).toBe("no_answer");
    act(() => void vi.advanceTimersByTime(4_100));
    rerender({ o: outgoing("expired") });
    expect(result.current).toBeNull();
  });

  it("does not show an outcome older than its hold when first read (a reload)", () => {
    const { result } = renderHook(() => useHeldOutcome(outgoing("declined", { respondedAt: new Date(Date.now() - 10_000).toISOString() }), vi.fn()));
    expect(result.current).toBeNull();
  });
});
