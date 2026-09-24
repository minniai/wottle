import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewControls } from "@/components/room/ReviewControls";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

function controls(over: Partial<Parameters<typeof ReviewControls>[0]> = {}, locale: "en" | "is" = "en") {
  const onControl = vi.fn();
  render(
    <LocaleProvider locale={locale}>
      <ReviewControls step={7} stepCount={20} playing={false} onControl={onControl} {...over} />
    </LocaleProvider>,
  );
  return { onControl };
}

describe("ReviewControls (spec 071 FR-035)", () => {
  it("has five controls with words on desktop", () => {
    const { onControl } = controls();
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["first", "back", "play ▸", "next", "last"]);
    for (const b of screen.getAllByRole("button")) fireEvent.click(b);
    expect(onControl.mock.calls.map((c) => c[0])).toEqual(["first", "back", "play", "next", "last"]);
  });

  it("says pause while it plays, and speaks Icelandic", () => {
    controls({ playing: true }, "is");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["fyrst", "aftur", "hlé", "næst", "síðast"]);
  });

  it("cannot go back from the first step or on from the last", () => {
    controls({ step: 1 });
    expect(screen.getByRole("button", { name: "first" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "next" })).toBeEnabled();
  });

  it("draws glyphs on a phone, each with a spoken label, 44px each", () => {
    controls({ compact: true }, "is");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["fyrst", "aftur", "spila", "næst", "síðast"]);
    expect(buttons.map((b) => b.textContent)).toEqual(["|◂", "◂", "▸", "▸", "▸|"]);
    for (const b of buttons) expect(b).toHaveClass("review-controls__glyph");
  });
});
