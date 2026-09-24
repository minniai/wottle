/**
 * Spec 072 T091 (FR-071): the invite door, the link states, both profiles and
 * the rules are axe clean at 1440×900 and 390×844 in both languages.
 * Fixtures only; no database.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { FIXED_NOW } from "../../../app/[locale]/dev/page/fixtures";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PHASES = ["invite-door", "invite-door-expired", "invite-door-returning", "lobby-link-out", "lobby-link-call", "profile-own", "profile-own-new", "profile-public", "profile-public-signed-out"];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`spec 072 pages at ${viewport.width} are axe clean`, () => {
    test.use({ viewport });
    for (const phase of PHASES) {
      for (const prefix of ["", "/en"]) {
        test(`${phase} ${prefix ? "en" : "is"}`, async ({ page }) => {
          await page.clock.setFixedTime(FIXED_NOW);
          await page.goto(`${prefix}/dev/page?phase=${phase}`);
          await expect(page.getByRole("main")).toBeVisible();
          const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
          expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
        });
      }
    }
    test("the rules", async ({ page }) => {
      await page.goto("/en/rules");
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  });
}
