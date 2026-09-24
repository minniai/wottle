import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReviewMoves } from "@/components/room/hooks/useReviewMoves";

import { bothFinished } from "../../../lib/review/reviewFixtures";

describe("useReviewMoves (spec 071 FR-043)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads a completed match's moves once and builds its steps", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(bothFinished()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ enabled }) => useReviewMoves("m1", enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.steps).toHaveLength(20));
    rerender({ enabled: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/match/m1/moves", expect.anything());
  });

  it("loads nothing until review is wanted", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useReviewMoves("m1", false));
    expect(result.current.steps).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
