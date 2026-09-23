import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PointsLost } from "@/components/room/PointsLost";

/** Spec 068 FR-021: only the number of points lost is crimson; its label stays muted. */
describe("PointsLost", () => {
  it("draws a loss as a crimson number beside its muted label", () => {
    const { container } = render(<PointsLost value={-5} label="no word" labelFirst />);
    const number = container.querySelector(".points-lost");
    expect(number).toHaveTextContent("−5");
    expect(container.querySelector(".ledger__miss")).toHaveTextContent("no word");
    // Label first, then the number: `no word −5` (your column reads inward to the spine).
    expect(container.textContent).toBe("no word −5");
  });

  it("can put the number first: `−5 not played`, `−15 if unplayed`", () => {
    const { container } = render(<PointsLost value={-15} label="if unplayed" />);
    expect(container.textContent).toBe("−15 if unplayed");
    expect(container.querySelector(".points-lost")).toHaveTextContent("−15");
  });

  it("nothing lost is not crimson: a floored 0 stays muted", () => {
    const { container } = render(<PointsLost value={0} label="no word" labelFirst />);
    expect(container.querySelector(".points-lost")).toBeNull();
    expect(container.querySelector(".points-none")).toHaveTextContent("0");
  });
});
