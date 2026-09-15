import AxeBuilder from "@axe-core/playwright";
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

/**
 * Design system §4 and spec 045 FR-014. The gutter is the measurement the
 * review made to find B1: centring the stack in its own column put the slack
 * between field and ledger, about 168px at 1440x900 instead of 56.
 */
test.describe("@visual the room is one composition", () => {
  test("one gutter between field and ledger, the pair centred", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "visual-390x844", "one column below 900px");
    const expected = testInfo.project.use.viewport!.width >= 1100 ? 56 : 40;

    await page.goto("/dev/room?phase=match");
    await expect(page.getByTestId("field")).toBeVisible();

    const { gutter, leftMargin, rightMargin } = await page.evaluate(() => {
      const room = document.querySelector('[data-testid="room"]')!.getBoundingClientRect();
      const field = document.querySelector('[data-testid="room-slot-field"]')!.getBoundingClientRect();
      const ledger = document.querySelector('[data-testid="room-slot-ledger"]')!.getBoundingClientRect();
      return {
        gutter: ledger.left - field.right,
        // Measured inside the room, not the viewport: `scrollbar-gutter: stable`
        // reserves space that both innerWidth and clientWidth still count, so a
        // classic-scrollbar platform (Linux CI) would report a centred pair as
        // 15px off. Centred in its own box is what the design asks for.
        leftMargin: field.left - room.left,
        rightMargin: room.right - ledger.right,
      };
    });

    expect(Math.round(gutter)).toBeCloseTo(expected, 0);
    // Centred as a unit: the slack is outside the pair, not between them.
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1);
  });
});

/**
 * Spec 045 US4 (FR-018 to FR-023), Fig. 5. The page never scrolls and nothing
 * is ever placed over the field: the sheet opens in flow beneath the live row.
 */
test.describe("@visual the room fits a phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "visual-390x844", "the phone layout, at the phone viewport");
  });

  test("bar / field / bar / live row, and the page does not scroll", async ({ page }) => {
    await page.goto("/dev/room?phase=match");
    await expect(page.getByTestId("field")).toBeVisible();

    // Collapsed: the glance only.
    await expect(page.getByTestId("ledger-live-trigger")).toBeVisible();
    await expect(page.getByTestId("ledger-territory")).toBeVisible();
    await expect(page.getByTestId("ledger-rows")).toHaveCount(0);
    await expect(page.getByTestId("ledger-foot")).toHaveCount(0);

    const closed = await page.evaluate(() => ({
      scrollHeight: document.scrollingElement!.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(closed.scrollHeight).toBeLessThanOrEqual(closed.innerHeight);

    // Cells stay comfortably tappable at the design's own floor.
    const cell = await page.getByTestId("field-cell").first().boundingBox();
    expect(cell!.width).toBeGreaterThanOrEqual(35);
  });

  test("the sheet opens in flow, below the bottom bar, and still does not scroll the page", async ({ page }) => {
    await page.goto("/dev/room?phase=match");
    await page.getByTestId("ledger-live-trigger").click();

    const sheet = page.getByTestId("ledger-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("ledger-rows")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const rect = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return {
        sheetTop: rect("ledger-sheet").top,
        bottomBar: rect("player-bar-bottom").bottom,
        fieldBottom: rect("field").bottom,
        scrollHeight: document.scrollingElement!.scrollHeight,
        innerHeight: window.innerHeight,
      };
    });

    // Never over the field or the bars — the design's central rule.
    expect(geometry.sheetTop).toBeGreaterThanOrEqual(geometry.bottomBar);
    expect(geometry.sheetTop).toBeGreaterThanOrEqual(geometry.fieldBottom);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.innerHeight);
  });

  test("Escape closes the sheet and returns focus to the live row", async ({ page }) => {
    await page.goto("/dev/room?phase=match");
    const trigger = page.getByTestId("ledger-live-trigger");
    await trigger.click();
    await expect(page.getByTestId("ledger-sheet")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ledger-sheet")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("every control in the sheet meets the 44px touch minimum", async ({ page }) => {
    await page.goto("/dev/room?phase=match");
    await page.getByTestId("ledger-live-trigger").click();
    const sheet = page.getByTestId("ledger-sheet");

    const small = await sheet.evaluate((el) =>
      [...el.querySelectorAll("button, a[href], [role=\"button\"]")]
        .map((n) => ({ label: n.textContent?.trim() ?? "", rect: n.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.width < 44 || rect.height < 44))
        .map(({ label, rect }) => `${label}: ${Math.round(rect.width)}x${Math.round(rect.height)}`),
    );
    expect(small, "controls below the 44px touch minimum").toEqual([]);
  });

  test("axe is clean with the sheet open", async ({ page }) => {
    await page.goto("/dev/room?phase=match");
    await page.getByTestId("ledger-live-trigger").click();
    await expect(page.getByTestId("ledger-sheet")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The design system's one grey exception: future-round numerals, aria-hidden,
      // with the round carried by the caption (spec 045 FR-033).
      .exclude(".ledger__row--future .ledger__round")
      .analyze();

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});
