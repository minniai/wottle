import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ROOM_PHASES } from "../../../app/dev/room/fixtures";

/**
 * The visual suite (spec 045 US1, FR-004). Every room state, from static
 * fixtures, with no Supabase running — this is the check whose absence let the
 * paint defects of spec 044 ship.
 *
 * One test per phase; the viewport comes from the project (`visual-1440x900`,
 * `visual-1280x800`, `visual-390x844`), so Playwright resolves a separate
 * baseline per viewport and a failure names the one that broke.
 *
 * Baselines are committed (spec 045 US7, spec 047 R5); darwin ones come from a
 * local run, linux ones from the CI job's artifact. `pnpm test:visual
 * --update-snapshots` is the only way to change one, and a human compares the
 * result with the figures before it is committed.
 *
 * Spec 047 amendment P2: one phase per asymmetric signal. `phone-sheet` is the
 * picking phase with the sheet open, so it exists only at 390×844; `low-clock`
 * is also captured under reduced motion, where the lane holds solid.
 */
test.describe("@visual the room, from fixtures", () => {
  for (const phase of ROOM_PHASES) {
    test(`${phase} matches its baseline`, async ({ page }, testInfo) => {
      test.skip(phase === "phone-sheet" && testInfo.project.name !== "visual-390x844", "the open sheet exists only on a phone");
      await page.goto(`/dev/room?phase=${phase}`);

      // Application state, not font state: Playwright already awaits
      // document.fonts.ready before every screenshot.
      if (phase === "profile") await expect(page.getByTestId("profile-page")).toBeVisible();
      else if (phase === "rules") await expect(page.getByTestId("rules-page")).toBeVisible();
      else await expect(page.getByTestId("field")).toBeVisible();

      if (phase === "phone-sheet") {
        await page.getByTestId("ledger-live-trigger").click();
        await expect(page.getByTestId("ledger-sheet")).toBeVisible();
      }

      await expect(page).toHaveScreenshot(`${phase}.png`, { fullPage: phase === "rules" });
    });
  }

  test("low-clock under reduced motion: the lane holds solid", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: testInfo.project.use.viewport!, reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      await page.goto("/dev/room?phase=low-clock");
      await expect(page.getByTestId("field")).toBeVisible();
      const lane = page.getByTestId("player-bar-bottom").locator(".player-bar__lane--low");
      await expect(lane).toHaveCount(1);
      const animation = await lane.locator(".player-bar__lane-fill").evaluate((el) => getComputedStyle(el).animationDuration);
      expect(animation, "0ms under prefers-reduced-motion (design system §6)").toBe("0s");
      await expect(page).toHaveScreenshot("low-clock-reduced-motion.png");
    } finally {
      await context.close();
    }
  });
});

test.describe("@visual the room renders without a database", () => {
  test("no request reaches Supabase", async ({ page }) => {
    const supabaseCalls: string[] = [];
    page.on("request", (request) => {
      if (/supabase|\/api\/match|\/api\/lobby/.test(request.url())) supabaseCalls.push(request.url());
    });

    await page.goto("/dev/room?phase=picking");
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
    await page.goto("/dev/room?phase=picking");
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

    await page.goto("/dev/room?phase=picking");
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
 * Spec 047 US2 (FR-007, review S1, amendment P3). The ledger's top rule sits on
 * the top bar's top and its foot on the bottom bar's bottom; the ten rows share
 * the stack's height. Asserted on the reference viewports and on a tall,
 * narrow one where the width binds the field and the old `align-self: stretch`
 * dropped the foot ~330px below the bar.
 */
test.describe("@visual the ledger is the height of the stack", () => {
  test("ledger edges meet the bars' outer edges; ten rows share one height", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "visual-390x844", "one column below 900px");
    const viewports = [testInfo.project.use.viewport!, { width: 1024, height: 1100 }];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/dev/room?phase=picking");
      await expect(page.getByTestId("field")).toBeVisible();

      const boxes = await page.evaluate(() => {
        const rect = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        const rows = Array.from({ length: 10 }, (_, i) => rect(`ledger-row-${i + 1}`).height);
        return { top: rect("player-bar-top"), bottom: rect("player-bar-bottom"), ledger: rect("ledger"), rows };
      });

      expect(Math.abs(boxes.ledger.top - boxes.top.top), `top at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes.ledger.bottom - boxes.bottom.bottom), `bottom at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(1);
      expect(Math.max(...boxes.rows) - Math.min(...boxes.rows)).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * Spec 047 US3 (FR-008, review S3, S6). One continuous rule per row, owned by
 * the row; the live row's label clears its 3px rule; the hint line is gone
 * during a match.
 */
test.describe("@visual the ledger rows", () => {
  test("each row draws one rule; the live label is clear of the live rule; no hint", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "visual-390x844", "the rows live in the sheet on a phone");
    await page.goto("/dev/room?phase=picking");
    await expect(page.getByTestId("field")).toBeVisible();

    const rows = await page.evaluate(() =>
      Array.from({ length: 10 }, (_, i) => {
        const row = document.querySelector(`[data-testid="ledger-row-${i + 1}"]`) as HTMLElement;
        const style = getComputedStyle(row);
        return {
          rule: style.borderBottomWidth,
          childRules: [...row.children].map((c) => getComputedStyle(c).borderBottomWidth),
          width: row.getBoundingClientRect().width,
          rowsWidth: row.parentElement!.getBoundingClientRect().width,
        };
      }),
    );
    for (const row of rows) {
      expect(row.rule).toBe("1px");
      expect(row.childRules.every((w) => w === "0px")).toBe(true);
      expect(Math.abs(row.width - row.rowsWidth)).toBeLessThanOrEqual(1);
    }

    const label = page.getByTestId("ledger-live-round");
    await expect(label).toHaveText("R4");
    // The label's box starts at the row's edge; the text is inset past the 3px rule.
    const inset = await label.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(inset).toBeGreaterThanOrEqual(6);

    await expect(page.getByTestId("ledger-hint")).toBeHidden();
    await expect(page.getByTestId("ledger-live-row")).toContainText("tap a second letter");
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
    await page.goto("/dev/room?phase=picking");
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
    await page.goto("/dev/room?phase=picking");
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
    await page.goto("/dev/room?phase=picking");
    const trigger = page.getByTestId("ledger-live-trigger");
    await trigger.click();
    await expect(page.getByTestId("ledger-sheet")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ledger-sheet")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("every control in the sheet meets the 44px touch minimum", async ({ page }) => {
    await page.goto("/dev/room?phase=picking");
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
    await page.goto("/dev/room?phase=picking");
    await page.getByTestId("ledger-live-trigger").click();
    await expect(page.getByTestId("ledger-sheet")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The design system's one grey exception: future-round numerals, aria-hidden,
      // with the round carried by the caption (spec 045 FR-033).
      .exclude(".ledger__row--future .ledger__round")
      .exclude('.rail__cell[data-state="future"]')
      .analyze();

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("@visual room clarity", () => {
  test("the round rail stays above the collapsed live row", async ({ page }, testInfo) => {
    await page.goto("/dev/room?phase=idle");
    const rail = page.getByTestId("round-rail");
    await expect(rail).toHaveAttribute("aria-label", "round 4 of 10");
    await expect(rail.locator('[data-state="past"]')).toHaveCount(3);
    await expect(rail.locator('[data-state="current"]')).toHaveCount(1);
    if (testInfo.project.name === "visual-390x844") {
      const railBox = await rail.boundingBox();
      const liveBox = await page.getByTestId("ledger-live-trigger").boundingBox();
      expect(railBox!.y + railBox!.height).toBeLessThanOrEqual(liveBox!.y);
    }
  });

  for (const phase of ["landing-slip", "resign", "claim-win", "over-slip"]) {
    test(`${phase} is accessible with the slip open`, async ({ page }) => {
      await page.goto(`/dev/room?phase=${phase}`);
      await expect(page.getByRole("dialog")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // DS §2: decorative future numerals are the sole contrast exception.
        .exclude(".ledger__row--future .ledger__round")
        .exclude('.rail__cell[data-state="future"]')
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
});
