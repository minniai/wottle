import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LandingTileVignette } from "@/components/landing/LandingTileVignette";

describe("LandingTileVignette", () => {
  test("renders six letter tiles spelling WOTTLE in order", () => {
    render(<LandingTileVignette />);
    const tiles = screen.getAllByTestId("landing-tile");
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.textContent?.trim())).toEqual([
      "W",
      "O",
      "T",
      "T",
      "L",
      "E",
    ]);
  });

  test("renders the mono eyebrow caption", () => {
    render(<LandingTileVignette />);
    expect(screen.getByText(/WO-rd · ba-TTLE/i)).toBeInTheDocument();
  });
});
