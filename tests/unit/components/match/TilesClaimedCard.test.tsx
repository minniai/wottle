import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TilesClaimedCard } from "@/components/match/TilesClaimedCard";
import type { FrozenTileMap } from "@/lib/types/match";

function frozen(ownerByKey: Record<string, "player_a" | "player_b">): FrozenTileMap {
  return Object.fromEntries(
    Object.entries(ownerByKey).map(([k, owner]) => [k, { owner }]),
  );
}

describe("TilesClaimedCard", () => {
  test("counts the current player's frozen tiles", () => {
    const tiles = frozen({ "0,0": "player_a", "1,0": "player_a", "2,0": "player_b" });
    render(
      <TilesClaimedCard
        frozenTiles={tiles}
        currentPlayerSlot="player_a"
      />,
    );
    const youBlock = screen.getByTestId("tiles-claimed-you");
    const oppBlock = screen.getByTestId("tiles-claimed-opponent");
    expect(youBlock).toHaveTextContent("2");
    expect(oppBlock).toHaveTextContent("1");
  });

  test("swaps the perspective when current slot is player_b", () => {
    const tiles = frozen({ "0,0": "player_a", "1,0": "player_a", "2,0": "player_b" });
    render(
      <TilesClaimedCard
        frozenTiles={tiles}
        currentPlayerSlot="player_b"
      />,
    );
    expect(screen.getByTestId("tiles-claimed-you")).toHaveTextContent("1");
    expect(screen.getByTestId("tiles-claimed-opponent")).toHaveTextContent("2");
  });

  test("renders three progress segments sized by count", () => {
    const tiles = frozen({ "0,0": "player_a", "1,0": "player_a", "2,0": "player_b" });
    render(
      <TilesClaimedCard
        frozenTiles={tiles}
        currentPlayerSlot="player_a"
        boardSize={100}
      />,
    );
    const bar = screen.getByTestId("tiles-claimed-bar");
    const segs = bar.querySelectorAll("[data-testid='tiles-claimed-segment']");
    expect(segs).toHaveLength(3);
    expect(segs[0].getAttribute("data-count")).toBe("2");
    expect(segs[1].getAttribute("data-count")).toBe("1");
    expect(segs[2].getAttribute("data-count")).toBe("97");
  });

  test("handles empty frozenTiles", () => {
    render(
      <TilesClaimedCard
        frozenTiles={{}}
        currentPlayerSlot="player_a"
      />,
    );
    expect(screen.getByTestId("tiles-claimed-you")).toHaveTextContent("0");
    expect(screen.getByTestId("tiles-claimed-opponent")).toHaveTextContent("0");
  });
});
