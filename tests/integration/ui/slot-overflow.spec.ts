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
];

const VIEWPORTS = [
  { width: 1440, height: 900 },
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
