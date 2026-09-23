import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ROOM_PHASES } from "../../../app/[locale]/dev/room/fixtures";
import { copyEn } from "../../../lib/i18n/copy/en";
import { copyIs } from "../../../lib/i18n/copy/is";
import type { Copy } from "../../../lib/i18n/copy/types";

/**
 * The visual suite (spec 045 US1, FR-004). Every room state, from static
 * fixtures, with no Supabase running — this is the check whose absence let the
 * paint defects of spec 044 ship.
 *
 * One test per phase; the viewport comes from the project (`visual-1440x900`,
 * `visual-1280x800`, `visual-390x844`), so Playwright resolves a separate
 * baseline per viewport and a failure names the one that broke.
 *
 * Baselines are committed (spec 045 US7, spec 047 R5). Refresh darwin with
 * `pnpm test:visual --update-snapshots`; refresh linux from the production CI
 * job's reviewed `*-actual.png` artifacts, as documented in the snapshots
 * README. A local refresh does not update Linux baselines. Compare both sets
 * with the design before committing an intentional visual change.
 *
 * Spec 047 amendment P2: one phase per asymmetric signal. `phone-sheet` is the
 * picking phase with the sheet open, so it exists only at 390×844; `last-seconds`
 * is also captured under reduced motion, where time still steps (spec 068).
 */
test.describe("@visual the room, from fixtures", () => {
  for (const phase of ROOM_PHASES) {
    test(`${phase} matches its baseline`, async ({ page }, testInfo) => {
      test.skip(phase === "phone-sheet" && testInfo.project.name !== "visual-390x844", "the open sheet exists only on a phone");
      await page.goto(`/en/dev/room?phase=${phase}`);

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

  test("last-seconds under reduced motion: time is not motion, the clock row still reads the seconds (spec 068)", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: testInfo.project.use.viewport!, reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      await page.goto("/en/dev/room?phase=last-seconds");
      await expect(page.getByTestId("field")).toBeVisible();
      const clock = page.getByTestId("scoreboard-clock");
      await expect(clock).toHaveAttribute("data-phase", "lastSeconds");
      await expect(clock).toContainText("0:12");
      await expect(clock.locator('[data-tick="on"], [data-block]').first()).toBeVisible();
      await expect(page).toHaveScreenshot("last-seconds-reduced-motion.png");
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

    await page.goto("/en/dev/room?phase=picking");
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
    await page.goto("/en/dev/room?phase=picking");
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

    await page.goto("/en/dev/room?phase=picking");
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
 * Spec 068 FR-011–FR-013, SC-001: one grid. The ledger's first three rows are
 * level with the scoreboard's, and each move row with a row of the board, to
 * within 1px, at the reference viewports; at 1000px wide nothing overflows.
 */
test.describe("@visual one grid for the board and the ledger", () => {
  test("ledger rows are level with the scoreboard's rows and the board's rows", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "visual-390x844", "one column below 900px");
    for (const viewport of [testInfo.project.use.viewport!, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/en/dev/room?phase=idle");
      await expect(page.getByTestId("field")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const edges = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect();
        const byId = (id: string) => rect(document.querySelector(`[data-testid="${id}"]`)!);
        const cells = Array.from(document.querySelectorAll('[data-testid="field-cell"]')).filter((_, i) => i % 10 === 0).map((c) => rect(c).bottom);
        return {
          // The header's ink rule is level with the box's bottom border, not the last row inside it.
          scoreboard: [byId("scoreboard-clock").bottom, byId("scoreboard-row-opp").bottom, byId("scoreboard").bottom],
          head: ["ledger-caption", "ledger-state-line", "ledger-header"].map((id) => byId(id).bottom),
          boxTop: byId("scoreboard").top,
          ledgerTop: byId("ledger").top,
          cells,
          rows: Array.from({ length: 10 }, (_, i) => byId(`ledger-row-${i + 1}`).bottom),
        };
      });
      const at = `${viewport.width}×${viewport.height}`;
      expect(Math.abs(edges.ledgerTop - edges.boxTop), `top at ${at}`).toBeLessThanOrEqual(1);
      edges.head.forEach((y, i) => expect(Math.abs(y - edges.scoreboard[i]), `head row ${i + 1} at ${at}`).toBeLessThanOrEqual(1));
      edges.rows.forEach((y, i) => expect(Math.abs(y - edges.cells[i]), `move row ${i + 1} at ${at}`).toBeLessThanOrEqual(1));
    }
  });

  test("at 1000px wide the room does not overflow sideways (the 901–1100px fix)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "visual-1440x900", "one width check is enough");
    for (const phase of ["idle", "lobby"]) {
      await page.setViewportSize({ width: 1000, height: 900 });
      await page.goto(`/en/dev/room?phase=${phase}`);
      await expect(page.getByTestId("field")).toBeVisible();
      const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
      expect(overflow, `${phase} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
});

/** Spec 068 FR-019–FR-021, SC-003: terracotta for the opponent, crimson for the number of points lost only. */
test.describe("@visual the opponent's colour and the penalty red", () => {
  test("sampled colours: terracotta seat, crimson loss, muted label", async ({ page }, testInfo) => {
    for (const phase of ["idle", "low-clock"]) {
      await page.goto(`/en/dev/room?phase=${phase}`);
      await expect(page.getByTestId("field")).toBeVisible();
      const colours = await page.evaluate(() => {
        const style = (el: Element | null) => (el ? getComputedStyle(el) : null);
        const opp = document.querySelector('[data-testid="scoreboard-row-opp"]')!;
        const loss = document.querySelector(".points-lost");
        return {
          square: style(opp.querySelector(".scoreboard__seat"))!.backgroundColor,
          total: style(opp.querySelector('[data-testid="scoreboard-total"]'))!.color,
          loss: style(loss)?.color ?? null,
          label: style(loss?.parentElement?.querySelector(".ledger__miss") ?? null)?.color ?? null,
          crimson: Array.from(document.querySelectorAll("body *")).filter((el) => getComputedStyle(el).color === "rgb(173, 31, 61)").every((el) => el.classList.contains("points-lost")),
        };
      });
      expect(colours.square).toBe("rgb(181, 106, 79)");
      // Desktop totals are large text in --opp; the phone's 20px total takes --opp-text.
      expect(colours.total).toBe(testInfo.project.name === "visual-390x844" ? "rgb(161, 88, 61)" : "rgb(181, 106, 79)");
      expect(colours.crimson, "crimson only on a points-lost number").toBe(true);
      if (testInfo.project.name !== "visual-390x844") {
        expect(colours.loss).toBe("rgb(173, 31, 61)");
        expect(colours.label).toBe("rgb(90, 101, 114)");
      }
    }
  });
});

/** Every string that can be the live row's second line, at its longest, in one language (spec 068 FR-032, SC-006). */
function line2Strings(copy: Copy): string[] {
  const name = "Kári";
  return [
    `${copy.picking("Þ", 10)} · ${copy.TAP_SECOND_LETTER}`,
    copy.frozenWord("HESTAR", name),
    copy.frozenJustNow(name),
    copy.movedJustNow(name),
    copy.pickClearedMoved(name),
    copy.OFFLINE_RECONNECTING,
    copy.backAway("1:34"),
    `${copy.endEarlyOfferLead(name)}${copy.END_THE_MATCH}`,
    `−5 · ${copy.moveOpens(10)}`,
    `−3 · ${copy.TOTAL_NEVER_BELOW_ZERO}`,
    `${copy.movesLeftShort(10)} · −50 ${copy.IF_UNPLAYED}`,
    `${copy.movesLeftShort(10)} · ${copy.NOTHING_TO_LOSE}`,
    copy.doneFact(name, 8, "1:12"),
    copy.scoredDelta(113, 10),
    ...Object.values(copy.errors),
  ];
}

test.describe("@visual the live row's second line fits one line at 1440", () => {
  for (const [lang, path, copy] of [["en", "/en/dev/room?phase=idle", copyEn], ["is", "/dev/room?phase=idle", copyIs]] as const) {
    test(`every line 2 string (${lang})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "visual-1440x900", "the fit is specified at 1440");
      await page.goto(path);
      await expect(page.getByTestId("ledger-live-row")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const wrapped = await page.evaluate((strings) => {
        const line = document.querySelector('[data-testid="ledger-live-row"] .ledger__live-line2') as HTMLElement;
        const lineHeight = Number.parseFloat(getComputedStyle(line).lineHeight) || 16;
        return strings.filter((text) => {
          line.textContent = text;
          return line.getBoundingClientRect().height > lineHeight * 1.5;
        });
      }, line2Strings(copy));
      expect(wrapped, "these wrap: shorten them in the copy (spec 068 FR-032)").toEqual([]);
    });
  }
});

/** Spec 068 FR-006, SC-002: urgency is weight only; nothing on the scoreboard or the ledger blinks. */
test.describe("@visual nothing blinks", () => {
  test("in the last seconds no scoreboard or ledger element animates, and a second later nothing has changed", async ({ page }) => {
    await page.goto("/en/dev/room?phase=last-seconds");
    await expect(page.getByTestId("scoreboard-clock")).toHaveAttribute("data-phase", "lastSeconds");
    await page.evaluate(() => document.fonts.ready);
    const animated = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="scoreboard"] *, [data-testid="scoreboard"], [data-testid="ledger"] *'))
        .filter((el) => getComputedStyle(el).animationName !== "none")
        .map((el) => el.getAttribute("data-testid") ?? el.className),
    );
    expect(animated).toEqual([]);
    const before = await page.getByTestId("scoreboard").screenshot();
    await page.waitForTimeout(1_000);
    expect(await page.getByTestId("scoreboard").screenshot()).toEqual(before);
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
    await page.goto("/en/dev/room?phase=picking");
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

    // The spine: a past row names its move between the two columns; the live row is one band.
    await expect(page.getByTestId("ledger-row-1").locator(".ledger__move")).toHaveText("1");
    await expect(page.getByTestId("ledger-row-4").locator(".ledger__move")).toHaveCount(0);

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

  test("scoreboard / field / live row, and the page does not scroll", async ({ page }) => {
    await page.goto("/en/dev/room?phase=picking");
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

  // Spec 068 FR-015, FR-016, SC-005 (artboards PhoneMatch, PhoneMatchShort): scoreboard, field,
  // live row, territory, then the foot pinned to the bottom; territory hides first as the height shrinks.
  for (const { width, height, name } of [
    { width: 390, height: 844, name: "phone-match" },
    { width: 390, height: 664, name: "phone-match-664" },
    { width: 360, height: 640, name: "phone-match-360" },
  ]) {
    test(`${name} (${width}×${height}): nothing scrolls and the foot stays on screen`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/en/dev/room?phase=idle");
      await expect(page.getByTestId("field")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const g = await page.evaluate(() => {
        const rect = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return {
          scoreboard: rect("scoreboard"),
          field: rect("field"),
          foot: rect("ledger-phone-foot"),
          live: rect("ledger-live-trigger"),
          scrollHeight: document.scrollingElement!.scrollHeight,
          scrollWidth: document.scrollingElement!.scrollWidth,
        };
      });
      expect(g.scrollHeight).toBeLessThanOrEqual(height);
      expect(g.scrollWidth).toBeLessThanOrEqual(width);
      expect(g.scoreboard.bottom).toBeLessThanOrEqual(g.field.top);
      expect(Math.abs(g.scoreboard.width - g.field.width)).toBeLessThanOrEqual(1);
      expect(g.field.bottom).toBeLessThanOrEqual(g.live.top);
      expect(g.live.bottom).toBeLessThanOrEqual(g.foot.top);
      expect(g.foot.bottom).toBeLessThanOrEqual(height);
      expect(g.field.width).toBe(Math.min(358, width - 32));
      await expect(page.getByTestId("ledger-territory")).toBeVisible({ visible: height >= 700 });
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });
    });
  }

  test("the sheet opens in flow, below the field, and still does not scroll the page", async ({ page }) => {
    await page.goto("/en/dev/room?phase=picking");
    await page.getByTestId("ledger-live-trigger").click();

    const sheet = page.getByTestId("ledger-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("ledger-rows")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const rect = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return {
        sheetTop: rect("ledger-sheet").top,
        scoreboardBottom: rect("scoreboard").bottom,
        fieldBottom: rect("field").bottom,
        scrollHeight: document.scrollingElement!.scrollHeight,
        innerHeight: window.innerHeight,
      };
    });

    // Never over the field or the scoreboard — the design's central rule.
    expect(geometry.sheetTop).toBeGreaterThanOrEqual(geometry.scoreboardBottom);
    expect(geometry.sheetTop).toBeGreaterThanOrEqual(geometry.fieldBottom);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.innerHeight);
  });

  test("Escape closes the sheet and returns focus to the live row", async ({ page }) => {
    await page.goto("/en/dev/room?phase=picking");
    const trigger = page.getByTestId("ledger-live-trigger");
    await trigger.click();
    await expect(page.getByTestId("ledger-sheet")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ledger-sheet")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("every control in the sheet meets the 44px touch minimum", async ({ page }) => {
    await page.goto("/en/dev/room?phase=picking");
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
    await page.goto("/en/dev/room?phase=picking");
    await page.getByTestId("ledger-live-trigger").click();
    await expect(page.getByTestId("ledger-sheet")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The design system's one grey exception: future-move numerals, aria-hidden,
      // with the count carried by the caption (spec 045 FR-033).
      .exclude(".ledger__row--future .ledger__move")
      .analyze();

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

/** Spec 049 US2: a scored letter has one owner and one colour; nothing is "shared". */
test.describe("@visual one owner, one colour", () => {
  test("reveal: the L where LEK crosses GILT is the opponent's; no phase has a shared cell", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "visual-1440x900", "one viewport is enough for an attribute");
    for (const phase of ROOM_PHASES) {
      if (phase === "rules" || phase === "profile") continue;
      await page.goto(`/en/dev/room?phase=${phase}`);
      await expect(page.getByTestId("field")).toBeVisible();
      await expect(page.locator('[data-testid="field-cell"][data-state="shared"]')).toHaveCount(0);
    }
    await page.goto("/en/dev/room?phase=reveal");
    const crossing = page.locator('[data-testid="field-cell"][data-x="7"][data-y="6"]');
    await expect(crossing).toHaveAttribute("data-seat", "opp");
    await expect(crossing).toHaveAttribute("data-state", "scored");
    await page.goto("/en/dev/room?phase=idle");
    await expect(page.locator('[data-testid="field-band"][data-word="LEK"]')).toHaveAttribute("data-cells", "7,6;8,6;9,6");
  });
});

test.describe("@visual room clarity", () => {
  test("each player's row is ten segments on the scoreboard's track, legible at every size", async ({ page }, testInfo) => {
    await page.goto("/en/dev/room?phase=idle");
    await expect(page.getByTestId("move-rail")).toHaveCount(0);
    const lane = (row: string) => page.getByTestId(row).getByTestId("scoreboard-track");
    await expect(lane("scoreboard-row-you")).toHaveAttribute("aria-valuenow", "7");
    await expect(lane("scoreboard-row-opp")).toHaveAttribute("aria-valuenow", "4");
    const segments = lane("scoreboard-row-you").locator(".scoreboard__segment");
    await expect(segments).toHaveCount(10);
    await expect(lane("scoreboard-row-you").locator('.scoreboard__segment[data-state="left"]')).toHaveCount(7);
    // Every segment stays a readable mark (spec 068 FR-008/009): 8px tall on desktop, 6px on a phone.
    const phone = testInfo.project.name === "visual-390x844";
    for (const box of await segments.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })))) {
      expect(box.w).toBeGreaterThanOrEqual(phone ? 12 : 24);
      expect(box.h).toBe(phone ? 6 : 8);
    }
  });

  for (const phase of ["landing-slip", "returning-slip", "resign", "end-early", "over-slip"]) {
    test(`${phase} is accessible with the slip open`, async ({ page }) => {
      await page.goto(`/en/dev/room?phase=${phase}`);
      await expect(page.getByRole("dialog")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // DS §2: decorative future numerals are the sole contrast exception.
        .exclude(".ledger__row--future .ledger__move")
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
});

/**
 * Spec 060: Orðusta, the Icelandic room at the unprefixed URL. A representative
 * set rather than every phase: the English set above pins the layout, this one
 * pins the Icelandic lines fitting it — the longest strings, the slips, the
 * final verdict, the profile and the rules.
 */
const ICELANDIC_PHASES = ["landing-slip", "returning-slip", "lobby", "picking", "reveal", "done-waiting", "final", "over-slip", "profile", "rules"] as const;

test.describe("@visual @is the room in Icelandic", () => {
  for (const phase of ICELANDIC_PHASES) {
    test(`${phase} (is) matches its baseline`, async ({ page }) => {
      await page.goto(`/dev/room?phase=${phase}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "is");
      if (phase === "profile") await expect(page.getByTestId("profile-page")).toBeVisible();
      else if (phase === "rules") await expect(page.getByTestId("rules-page")).toBeVisible();
      else await expect(page.getByTestId("field")).toBeVisible();
      await expect(page).toHaveScreenshot(`is-${phase}.png`, { fullPage: phase === "rules" });
    });
  }
});
