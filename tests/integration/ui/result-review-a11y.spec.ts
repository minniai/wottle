/**
 * Spec 071 T078 (SC-009): the result, the rematch negotiation and review are axe clean at
 * 1440×900 and 390×844 in both languages. Fixtures only; no database.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
/** The one permitted grey for progression marks (room-layout.spec.ts). */
const CONTRAST_EXCLUSIONS = [".ledger__row--future .ledger__move"];
const PHASES = ["result-moves", "rematch-in", "rematch-declined", "review", "review-public", "rematch-in-review"];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`result and review at ${viewport.width} are axe clean`, () => {
    test.use({ viewport });
    for (const phase of PHASES) {
      for (const prefix of ["", "/en"]) {
        test(`${phase} ${prefix ? "en" : "is"}`, async ({ page }) => {
          await page.goto(`${prefix}/dev/room?phase=${phase}`);
          await expect(page.getByTestId("room")).toBeVisible();
          let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
          for (const selector of CONTRAST_EXCLUSIONS) builder = builder.exclude(selector);
          const results = await builder.analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
        });
      }
    }
  });
}
