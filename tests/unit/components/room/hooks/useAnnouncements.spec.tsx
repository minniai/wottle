import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAnnouncements, type AnnouncementsInput } from "@/components/room/hooks/useAnnouncements";
import { copyEn } from "@/lib/i18n/copy/en";
import type { MoveResolution } from "@/lib/types/match";

/** Spec 068 FR-010, FR-033, research R10: one polite line per opponent move, live only, and the 1:00 / 0:15 marks. */
function theirs(over: Partial<MoveResolution> = {}): MoveResolution {
  return {
    matchId: "m1", moveId: "mv", playerId: "kari", globalSeq: 9, seq: 5, status: "resolved",
    swap: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, board: [], delta: 11,
    words: [{ playerId: "kari", word: "skó", length: 3, lettersPoints: 6, bonusPoints: 5, totalPoints: 11, coordinates: [] }],
    totals: { playerA: 51, playerB: 29 }, frozenTiles: {}, movesPlayed: { playerA: 3, playerB: 5 }, resolvedAt: "",
    ...over,
  };
}

const base: AnnouncementsInput = { liveResolution: null, opponentId: "kari", opponentName: "Kári", opponentSlot: "playerB", revealingOwn: false, clockMs: 192_000, copy: copyEn };

describe("useAnnouncements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces the opponent's move once, live, after the viewer's own reveal", () => {
    const { result, rerender } = renderHook((props: AnnouncementsInput) => useAnnouncements(props), { initialProps: base });
    rerender({ ...base, liveResolution: theirs(), revealingOwn: true });
    expect(result.current).toBe("");
    rerender({ ...base, liveResolution: theirs(), revealingOwn: false });
    expect(result.current).toBe("Kári SKÓ +11 · 5 of 10");
    rerender({ ...base, liveResolution: { ...theirs() } });
    expect(result.current).toBe("Kári SKÓ +11 · 5 of 10");
  });

  it("a move with no word says so", () => {
    const { result, rerender } = renderHook((props: AnnouncementsInput) => useAnnouncements(props), { initialProps: base });
    rerender({ ...base, liveResolution: theirs({ words: [], delta: -5, movesPlayed: { playerA: 3, playerB: 6 } }) });
    expect(result.current).toBe("Kári no word −5 · 6 of 10");
  });

  it("never announces the viewer's own move, a refusal, or a move already on the board at mount", () => {
    const { result, rerender } = renderHook((props: AnnouncementsInput) => useAnnouncements(props), { initialProps: { ...base, liveResolution: theirs({ globalSeq: 9 }) } });
    expect(result.current).toBe("");
    rerender({ ...base, liveResolution: theirs({ globalSeq: 10, playerId: "birna" }) });
    rerender({ ...base, liveResolution: theirs({ globalSeq: 11, status: "rejected" }) });
    expect(result.current).toBe("");
  });

  it("two moves within 1.5s: the newest is said, the other dropped", () => {
    const { result, rerender } = renderHook((props: AnnouncementsInput) => useAnnouncements(props), { initialProps: base });
    rerender({ ...base, liveResolution: theirs({ globalSeq: 10 }) });
    expect(result.current).toBe("Kári SKÓ +11 · 5 of 10");
    rerender({ ...base, liveResolution: theirs({ globalSeq: 11, words: [], delta: -5, movesPlayed: { playerA: 3, playerB: 6 } }) });
    expect(result.current).toBe("Kári SKÓ +11 · 5 of 10");
    act(() => vi.advanceTimersByTime(1_500));
    expect(result.current).toBe("Kári no word −5 · 6 of 10");
  });

  it("says 1:00 and 0:15 once each as the clock crosses them, never on a load past them", () => {
    const { result, rerender } = renderHook((props: AnnouncementsInput) => useAnnouncements(props), { initialProps: base });
    rerender({ ...base, clockMs: 59_000 });
    expect(result.current).toBe("1:00 left");
    rerender({ ...base, clockMs: 14_000 });
    act(() => vi.advanceTimersByTime(1_500));
    expect(result.current).toBe("0:15 left");
    const late = renderHook((props: AnnouncementsInput) => useAnnouncements(props), { initialProps: { ...base, clockMs: 40_000 } });
    late.rerender({ ...base, clockMs: 39_000 });
    expect(late.result.current).toBe("");
  });
});
