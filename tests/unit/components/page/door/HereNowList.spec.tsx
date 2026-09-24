import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { HereNowList } from "@/components/page/door/HereNowList";

const row = (displayName: string, rating: number, state: "here" | "searching" = "here") => ({ displayName, rating, state });

/** Spec 070 US1.3 (Q2): at most eight names, then a count; never links. */
describe("HereNowList", () => {
  it("lists names, ratings and presence words, and says how to challenge", () => {
    render(
      <LocaleProvider locale="is">
        <HereNowList here={[row("Embla", 1242), row("Ragnar", 1096, "searching")]} more={0} />
      </LocaleProvider>,
    );
    // The ratings are this lobby's: the caption names its language (US7.5).
    expect(screen.getByText("hér núna · 2 · elo · íslenska")).toBeTruthy();
    expect(screen.getByText("Embla")).toBeTruthy();
    expect(screen.getByText("leitar")).toBeTruthy();
    expect(screen.getByText("þú finnur mótspilara í lobbíinu")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the rest as a plain count, not a link", () => {
    const eight = Array.from({ length: 8 }, (_, i) => row(`P${i}`, 1200 + i));
    render(
      <LocaleProvider locale="en">
        <HereNowList here={eight} more={22} />
      </LocaleProvider>,
    );
    expect(screen.getByText("here now · 30 · rating · english")).toBeTruthy();
    expect(screen.getAllByTestId("door-here-row")).toHaveLength(8);
    expect(screen.getByText("+ 22 more").tagName).not.toBe("A");
  });

  it("says nobody is here yet", () => {
    render(
      <LocaleProvider locale="en">
        <HereNowList here={[]} more={0} />
      </LocaleProvider>,
    );
    expect(screen.getByText("No one here yet.")).toBeTruthy();
  });
});
