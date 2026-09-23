import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldCell } from "@/components/room/FieldCell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

/** Spec 068 FR-027: a 2px tick in the mover's colour on the bottom edge of their last swap. */
describe("FieldCell: the last-moved tick", () => {
  it("draws the tick in the mover's seat colour and names the move for AT", () => {
    render(<FieldCell x={2} y={3} letter="S" value={1} state="free" seat={null} lastMove={{ seat: "opp", name: "Kári" }} />);
    const cell = screen.getByTestId("field-cell");
    const tick = cell.querySelector(".field__tick") as HTMLElement;
    expect(tick).not.toBeNull();
    expect(tick).toHaveAttribute("aria-hidden");
    expect(tick.style.getPropertyValue("--tick-ink")).toBe("var(--opp)");
    expect(cell).toHaveAttribute("data-last-move", "opp");
    expect(cell.getAttribute("aria-label")).toMatch(/, Kári's last move$/);
  });

  it("no tick, no suffix", () => {
    render(<FieldCell x={2} y={3} letter="S" value={1} state="free" seat={null} />);
    expect(screen.getByTestId("field-cell").querySelector(".field__tick")).toBeNull();
    expect(screen.getByTestId("field-cell").getAttribute("aria-label")).not.toMatch(/last move/);
  });

  it("in Icelandic the name stays in the nominative: `síðasti leikur · Kári`", () => {
    render(
      <LocaleProvider locale="is">
        <FieldCell x={2} y={3} letter="S" value={1} state="free" seat={null} lastMove={{ seat: "opp", name: "Kári" }} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("field-cell").getAttribute("aria-label")).toMatch(/, síðasti leikur · Kári$/);
  });
});
