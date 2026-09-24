import { expect, test } from "@playwright/test";

import { FIXED_NOW, PAGE_PHASES } from "../../../app/[locale]/dev/page/fixtures";

/**
 * Spec 070 T112, SC-007: every fixed slot fits its longest string in both
 * languages. Each page fixture is rendered with every name at the 24-character
 * limit, in Icelandic and in English, at 1440 and 390, and no slot may clip its
 * text or reach past its box. No database.
 */
const SLOTS = [
  ".line-slot__line1",
  ".line-slot__line2",
  ".line-slot__primary",
  ".line-slot__secondary",
  ".lobby-row__status",
  ".lobby-row__action",
  ".composer-row__terms",
  ".composer-row__lines .page-label",
  ".composer-row__actions",
  ".lobby-block__sub-line",
  ".lobby-block__primary",
  // Spec 072: the invite band, the link's slot, the invite control and the profile's fixed lines.
  ".invite-band .line-slot__line1",
  ".lobby-invite",
  ".profile-presence",
  ".profile-stakes",
  ".profile-sent",
  ".profile-head__sub .page-label",
  ".profile-primary",
];

const VIEWPORTS = [
  { width: 1440, height: 900 },
  // The middle band (design system §4: 900-1100): reported 2026-09-24, pages overflowed here.
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`slots at ${viewport.width}`, () => {
    test.use({ viewport });
    for (const phase of PAGE_PHASES as readonly string[]) {
      for (const prefix of ["", "/en"]) {
        test(`${phase} ${prefix ? "en" : "is"} fits the longest names`, async ({ page }) => {
          await page.clock.setFixedTime(FIXED_NOW);
          await page.goto(`${prefix}/dev/page?phase=${phase}&long=1`);
          await expect(page.getByRole("main")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const clipped = await page.evaluate((selectors) => {
            const out: string[] = [];
            for (const selector of selectors) {
              for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
                const box = el.getBoundingClientRect();
                if (box.width === 0 || getComputedStyle(el).visibility === "hidden") continue;
                const text = (el.textContent ?? "").trim().slice(0, 60);
                if (el.scrollWidth > el.clientWidth + 1) out.push(`${selector} clips "${text}" (${el.scrollWidth} > ${el.clientWidth})`);
                if (box.right > document.documentElement.clientWidth + 1) out.push(`${selector} passes the page edge: "${text}"`);
              }
            }
            // No page is wider than the window.
            const page = document.scrollingElement!;
            if (page.scrollWidth > page.clientWidth + 1) out.push(`the page is wider than the window (${page.scrollWidth} > ${page.clientWidth})`);
            // The phone bottom slot has a fixed height: nothing in it may run past its bottom edge.
            const bottom = document.querySelector<HTMLElement>(".page-bottom .line-slot");
            if (bottom && bottom.getBoundingClientRect().height > 0 && bottom.scrollHeight > bottom.clientHeight + 1) {
              out.push(`the phone bottom slot runs past its height (${bottom.scrollHeight} > ${bottom.clientHeight})`);
            }
            return out;
          }, SLOTS);
          expect(clipped).toEqual([]);
        });
      }
    }
  });
}

/**
 * Spec 071 T076: the result, rematch and review lines fit their slots in both languages, at 1440
 * and 390: the detail line, the negotiation line, the cursor lines, the scrubber's label and the
 * controls. No database.
 */
const ROOM_SLOTS = [
  ".slip__label",
  ".slip__actions",
  ".scoreboard__label",
  ".scoreboard__detail",
  ".ledger__live-line1",
  ".ledger__live-line2",
  ".review-controls",
  ".ledger__call-text",
];
const ROOM_PHASES_071 = ["result-moves", "result-incomplete", "result-both", "result-forfeit", "result-early", "rematch-sent", "rematch-in", "rematch-declined", "review", "review-refused", "review-time", "rematch-in-review"];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`room slots at ${viewport.width} (spec 071)`, () => {
    test.use({ viewport });
    for (const phase of ROOM_PHASES_071) {
      for (const prefix of ["", "/en"]) {
        test(`${phase} ${prefix ? "en" : "is"} fits`, async ({ page }) => {
          await page.goto(`${prefix}/dev/room?phase=${phase}`);
          await expect(page.getByTestId("room")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const clipped = await page.evaluate((selectors) => {
            const out: string[] = [];
            for (const selector of selectors) {
              for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
                const box = el.getBoundingClientRect();
                if (box.width === 0 || getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).textOverflow === "ellipsis") continue;
                if (el.scrollWidth > el.clientWidth + 1) out.push(`${selector} clips "${(el.textContent ?? "").trim().slice(0, 60)}"`);
              }
            }
            const page = document.scrollingElement!;
            if (page.scrollWidth > page.clientWidth + 1) out.push(`the page is wider than the window (${page.scrollWidth} > ${page.clientWidth})`);
            return out;
          }, ROOM_SLOTS);
          expect(clipped).toEqual([]);
        });
      }
    }
  });
}
