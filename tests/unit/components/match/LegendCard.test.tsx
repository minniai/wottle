import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LegendCard } from "@/components/match/LegendCard";

describe("LegendCard", () => {
  test("renders the 'Legend' eyebrow", () => {
    render(<LegendCard />);
    expect(screen.getByText("Legend")).toBeInTheDocument();
  });

  test("renders three captions", () => {
    render(<LegendCard />);
    expect(screen.getByText("Your territory")).toBeInTheDocument();
    expect(screen.getByText("Opponent's territory")).toBeInTheDocument();
    expect(screen.getByText("Shared letter")).toBeInTheDocument();
  });

  test("renders three swatches", () => {
    render(<LegendCard />);
    expect(screen.getAllByTestId("legend-swatch")).toHaveLength(3);
  });

  test("your-territory swatch uses the p1 slot", () => {
    render(<LegendCard />);
    const swatches = screen.getAllByTestId("legend-swatch");
    expect(swatches[0].dataset.slot).toBe("p1");
    expect(swatches[1].dataset.slot).toBe("p2");
    expect(swatches[2].dataset.slot).toBe("both");
  });
});
