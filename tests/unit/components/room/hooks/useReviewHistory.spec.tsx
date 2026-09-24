import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewHistory } from "@/components/room/hooks/useReviewHistory";

describe("useReviewHistory (spec 071 FR-030, R4)", () => {
  let push: ReturnType<typeof vi.spyOn>;
  let replace: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    window.history.replaceState({ kind: "result" }, "", "/en/match/m1");
    push = vi.spyOn(window.history, "pushState");
    replace = vi.spyOn(window.history, "replaceState");
    back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enters review in one new entry, and each step replaces it", () => {
    const { result } = renderHook(() => useReviewHistory());
    act(() => result.current.enter(20));
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: "review" }), "", "/en/match/m1?review=20");
    act(() => result.current.stepTo(7));
    expect(replace).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "review" }), "", "/en/match/m1?review=7");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("leaves by going back when review was entered from the result", () => {
    const { result } = renderHook(() => useReviewHistory());
    act(() => result.current.enter(20));
    act(() => result.current.leave());
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("leaves in place when review was opened directly", () => {
    window.history.replaceState(null, "", "/en/match/m1?review=5");
    const { result } = renderHook(() => useReviewHistory());
    act(() => result.current.leave());
    expect(back).not.toHaveBeenCalled();
    expect(replace).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "result" }), "", "/en/match/m1");
  });

  it("writes a corrected parameter back in place", () => {
    window.history.replaceState(null, "", "/en/match/m1?review=abc");
    const { result } = renderHook(() => useReviewHistory());
    act(() => result.current.correct("20"));
    expect(replace).toHaveBeenLastCalledWith(expect.anything(), "", "/en/match/m1?review=20");
    act(() => result.current.drop());
    expect(replace).toHaveBeenLastCalledWith(expect.anything(), "", "/en/match/m1");
  });
});
