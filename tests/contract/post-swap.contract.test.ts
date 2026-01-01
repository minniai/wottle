import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/swapTiles", () => ({
  swapTiles: vi.fn(),
}));

import type { MoveResult } from "@/lib/types/board";
import { swapTiles } from "@/app/actions/swapTiles";
import { POST } from "@/app/api/swap/route";
import { BOARD_SIZE } from "@/lib/constants/board";

function createRequest(payload: unknown) {
  return new Request("http://localhost/api/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function createGrid(): string[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => "A")
  );
}

describe("POST /api/swap", () => {
  beforeEach(() => {
    vi.mocked(swapTiles).mockReset();
  });

  it("returns 200 with the move result when the swap succeeds", async () => {
    const moveResult: MoveResult = {
      status: "accepted",
      grid: createGrid(),
    };
    vi.mocked(swapTiles).mockResolvedValue(moveResult);

    const response = await POST(
      createRequest({
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(moveResult);
    expect(swapTiles).toHaveBeenCalledWith({
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    });
  });

  it("returns 400 when the server action rejects the swap", async () => {
    const moveResult: MoveResult = {
      status: "rejected",
      grid: createGrid(),
      error: "Cannot swap a tile with itself",
    };
    vi.mocked(swapTiles).mockResolvedValue(moveResult);

    const response = await POST(
      createRequest({
        from: { x: 2, y: 2 },
        to: { x: 2, y: 2 },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(moveResult);
  });

  it("returns 500 when the swap action throws", async () => {
    vi.mocked(swapTiles).mockRejectedValue(new Error("database down"));

    const response = await POST(
      createRequest({
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
      })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/database down/i);
  });
});


