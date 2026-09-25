import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { copyEn } from "../../../lib/i18n/copy/en";
import { generateTestUsername } from "./helpers/matchmaking";

/**
 * Spec 060 US1: Orðusta at the plain address. The root is Icelandic, `/is`
 * redirects to it, English lives under `/en`, and no English line is shown
 * to an Icelandic player.
 */
test.describe("@locale Orðusta at the plain address", () => {
  test("the root is Icelandic: lang, title, welcome and the door", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "is");
    await expect(page).toHaveTitle("Orðusta · orðaeinvígi fyrir tvo");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Velkomin í Orðustu.");
    await expect(page.getByTestId("door-name")).toHaveAttribute("placeholder", "notandanafn");
  });

  test("/is redirects to the unprefixed address, keeping the path", async ({ page }) => {
    await page.goto("/is/rules");
    await expect(page).toHaveURL(/\/rules$/);
    expect(new URL(page.url()).pathname).toBe("/rules");
    await expect(page.locator("html")).toHaveAttribute("lang", "is");
  });

  test("English lives under /en and is called Wottle", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Wottle · a word duel for two");
    await expect(page.getByRole("img", { name: "Wottle, Orðusta in Icelandic" })).toBeVisible();
  });

  test("signed in at /, the lobby is Icelandic and shows no English line", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("door-name").fill(generateTestUsername("isl"));
    await page.getByTestId("door-enter").click();
    await expect(page.getByTestId("lobby-find")).toHaveText("finna mótspilara ▸", { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/");
    const text = await page.locator("body").innerText();
    const english = [copyEn.FIND_OPPONENT, copyEn.HERE_NOW, copyEn.HOW_TO_PLAY, copyEn.YOUR_LAST_MATCHES, copyEn.NO_OPPONENT];
    for (const line of english) expect(text.toLowerCase()).not.toContain(line.toLowerCase());
  });

  test("both languages are axe clean: the Icelandic landing, the English lobby and both rules pages, WCAG 2.1 AA (T066)", async ({ page }) => {
    for (const path of ["/", "/rules", "/en/rules"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations, path).toEqual([]);
    }
    await page.goto("/en");
    await page.getByTestId("door-name").fill(generateTestUsername("axe"));
    await page.getByTestId("door-enter").click();
    await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 20_000 });
    // The lobby is a page (spec 070): landmarks and one h1, checked against WCAG 2.1 AA.
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, "/en (the lobby)").toEqual([]);
  });
});
