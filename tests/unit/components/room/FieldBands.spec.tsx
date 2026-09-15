import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldBands } from "@/components/room/FieldBands";
import type { WordBand } from "@/lib/room/bandGeometry";

const bands: WordBand[] = [
  { id: "a", seat: "you", cells: [{ x: 1, y: 2 }, { x: 2, y: 2 }], direction: "ltr", strength: "settled", round: 1, word: "ab" },
  { id: "b", seat: "opp", cells: [{ x: 5, y: 4 }, { x: 5, y: 3 }], direction: "btt", strength: "live", round: 2, word: "cd" },
];

describe("FieldBands (design system §5.2)", () => {
  it("renders a rect and a chevron per band with seat, direction and round", () => {
    render(<FieldBands bands={bands} highlightRound={null} />);
    const els = screen.getAllByTestId("field-band");
    expect(els).toHaveLength(2);
    expect(els[0]).toHaveAttribute("data-seat", "you");
    expect(els[0]).toHaveAttribute("data-direction", "ltr");
    expect(els[0].querySelector("rect")).toHaveAttribute("fill", "var(--you-band)");
    expect(els[0].querySelector("path")).toHaveAttribute("stroke", "var(--you)");
    expect(els[1]).toHaveAttribute("data-round", "2");
    expect(els[1].querySelector("rect")).toHaveAttribute("fill", "var(--opp-live)");
    expect(els[1]).toHaveClass("field__band--live");
  });

  it("draws the chevron at the design's 1.5px, not a hairline (spec 045 A3)", () => {
    // vector-effect="non-scaling-stroke" measures the width in device pixels,
    // so 0.15 rendered as a sixth of one pixel — invisible at every field size.
    const { container } = render(<FieldBands bands={bands} highlightRound={null} />);
    const paths = [...container.querySelectorAll("path")];
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toHaveAttribute("stroke-width", "1.5");
      expect(path).toHaveAttribute("vector-effect", "non-scaling-stroke");
    }
  });

  it("dims bands of other rounds while a ledger row is hovered", () => {
    render(<FieldBands bands={bands} highlightRound={2} />);
    const els = screen.getAllByTestId("field-band");
    expect(els[0]).toHaveClass("field__band--dimmed");
    expect(els[1]).not.toHaveClass("field__band--dimmed");
  });

  it("drawnCount limits how many bands are drawn (reveal)", () => {
    render(<FieldBands bands={bands} highlightRound={null} drawnCount={1} />);
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
  });
});
