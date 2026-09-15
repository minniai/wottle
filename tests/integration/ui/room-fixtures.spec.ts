import { expect, test } from "@playwright/test";

/**
 * The visual suite (spec 045 US1, FR-004). Every room state, from static
 * fixtures, with no Supabase running — this is the check whose absence let the
 * paint defects of spec 044 ship.
 *
 * One test per phase; the viewport comes from the project (`visual-1440x900`,
 * `visual-1280x800`, `visual-390x844`), so Playwright resolves a separate
 * baseline per viewport and a failure names the one that broke.
 *
 * Baselines are not committed until US7 — they would enshrine defects A1–A4.
 * Until then, run with `--update-snapshots` and compare by eye against the
 * figures. `pnpm test:visual --update-snapshots` is the only way to change one.
 */
const PHASES = [
  "landing",
  "lobby",
  "queue",
  "found",
  "match",
  "reveal",
  "final",
  "disconnect",
  "profile",
] as const;

test.describe("@visual the room, from fixtures", () => {
  for (const phase of PHASES) {
    test(`${phase} matches its baseline`, async ({ page }) => {
      await page.goto(`/dev/room?phase=${phase}`);

      // Application state, not font state: Playwright already awaits
      // document.fonts.ready before every screenshot.
      if (phase === "profile") await expect(page.getByTestId("profile-page")).toBeVisible();
      else await expect(page.getByTestId("field")).toBeVisible();

      await expect(page).toHaveScreenshot(`${phase}.png`);
    });
  }
});

test.describe("@visual the room renders without a database", () => {
  test("no request reaches Supabase", async ({ page }) => {
    const supabaseCalls: string[] = [];
    page.on("request", (request) => {
      if (/supabase|\/api\/match|\/api\/lobby/.test(request.url())) supabaseCalls.push(request.url());
    });

    await page.goto("/dev/room?phase=match");
    await expect(page.getByTestId("field")).toBeVisible();
    await expect(page.getByTestId("field").getByRole("gridcell")).toHaveCount(100);

    expect(supabaseCalls, "the fixture route must reach no backend").toEqual([]);
  });
});

/**
 * Computed styles, not just pixels (spec 045 US2). A screenshot diff says
 * "something changed"; these say which value is wrong, and they are what
 * fixture B of the implementation review specifies.
 */
test.describe("@visual the field is painted to the design", () => {
  test("paper ground, 1px rules inside a 1.5px frame, type that follows the cell", async ({ page }) => {
    await page.goto("/dev/room?phase=match");
    const field = page.getByTestId("field");
    await expect(field).toBeVisible();

    const paint = await field.evaluate((el) => {
      const cells = [...el.querySelectorAll<HTMLElement>('[data-testid="field-cell"]')];
      const style = (n: Element) => getComputedStyle(n);
      const interior = cells[11]; // x 1, y 1 — not on any outer edge
      const lastColumn = cells[9]; // x 9, y 0
      const lastRow = cells[90]; // x 0, y 9
      const box = interior.getBoundingClientRect();
      const numeral = interior.querySelector(".field__value");
      return {
        fieldBackground: style(el).backgroundColor,
        fieldBorderColor: style(el).borderTopColor,
        cellBackground: style(interior).backgroundColor,
        ruleWidth: style(interior).borderRightWidth,
        ruleColor: style(interior).borderRightColor,
        lastColumnRight: style(lastColumn).borderRightWidth,
        lastRowBottom: style(lastRow).borderBottomWidth,
        cellWidth: box.width,
        letterSize: Number.parseFloat(style(interior).fontSize),
        numeralSize: numeral ? Number.parseFloat(style(numeral).fontSize) : null,
        chevronStroke: el.querySelector("path")?.getAttribute("stroke-width"),
      };
    });

    expect(paint.fieldBackground, "the field is paper, not the rule grey (A1)").toBe("rgb(255, 253, 247)");
    expect(paint.cellBackground, "cells are transparent so the bands show through").toBe("rgba(0, 0, 0, 0)");
    expect(paint.ruleWidth).toBe("1px");
    expect(paint.ruleColor).toBe("rgb(230, 226, 214)");
    // The frame's declared 1.5px is pinned in room-css.test.ts; the browser
    // rounds border widths to device pixels, so assert the colour here — an ink
    // frame around rule-grey divisions is what distinguishes it.
    expect(paint.fieldBorderColor).toBe("rgb(15, 26, 36)");
    expect(paint.lastColumnRight, "no rule outside the frame").toBe("0px");
    expect(paint.lastRowBottom, "no rule outside the frame").toBe("0px");

    // A2: the letter follows the cell at every size, within a rounding pixel.
    expect(paint.letterSize).toBeCloseTo(paint.cellWidth * 0.55, 0);
    expect(paint.numeralSize).toBeCloseTo(Math.max(9, paint.cellWidth * 0.18), 0);

    // A3: 1.5 device pixels, not 0.15.
    expect(paint.chevronStroke).toBe("1.5");
  });
});
