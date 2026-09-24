import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useArrivalWatch } from "@/components/standing/hooks/useArrivalWatch";
import type { LobbyRow } from "@/lib/types/standing";

const row = (n: number, name: string): LobbyRow => ({ playerId: `00000000-0000-4000-8000-00000000000${n}`, displayName: name, handle: name.toLowerCase(), rating: 1200, state: "here", movesPlayed: null, record: null });

/** Spec 070 US2.6, clarification Q4 (T085a): the first arrival tells you, once. */
describe("useArrivalWatch", () => {
  it("does nothing until armed; armed, the first player to arrive is announced once, and the watch ends", () => {
    const onArrive = vi.fn();
    const { result, rerender } = renderHook(({ rows }) => useArrivalWatch(rows, onArrive), { initialProps: { rows: [] as LobbyRow[] } });
    rerender({ rows: [row(1, "Embla")] });
    expect(onArrive).not.toHaveBeenCalled();
    rerender({ rows: [] });
    act(() => result.current.arm());
    expect(result.current.armed).toBe(true);
    rerender({ rows: [row(1, "Embla")] });
    expect(onArrive).toHaveBeenCalledWith("Embla");
    expect(result.current.armed).toBe(false);
    rerender({ rows: [row(1, "Embla"), row(2, "Kári")] });
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled, and armed again later", () => {
    const onArrive = vi.fn();
    const { result, rerender } = renderHook(({ rows }) => useArrivalWatch(rows, onArrive), { initialProps: { rows: [] as LobbyRow[] } });
    act(() => result.current.arm());
    act(() => result.current.cancel());
    rerender({ rows: [row(1, "Embla")] });
    expect(onArrive).not.toHaveBeenCalled();
    rerender({ rows: [] });
    act(() => result.current.arm());
    rerender({ rows: [row(2, "Kári")] });
    expect(onArrive).toHaveBeenCalledWith("Kári");
  });
});
