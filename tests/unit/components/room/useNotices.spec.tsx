import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNotices } from "@/components/room/hooks/useNotices";
import { pickClearedNotice } from "@/lib/room/notices";

describe("useNotices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops a timed notice once it expires and keeps the untimed ones", () => {
    const { result } = renderHook(() => useNotices());
    act(() => {
      result.current.push({ kind: "text", text: "realtime lost" });
      result.current.push(pickClearedNotice("Kári", Date.now()));
    });
    expect(result.current.notices).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1_750));
    expect(result.current.notices).toHaveLength(2);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.notices).toEqual([{ kind: "text", text: "realtime lost" }]);
  });
});
