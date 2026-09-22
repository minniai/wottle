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
  test("the root is Icelandic: lang, title, wordmark and the sign-in slip", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "is");
    await expect(page).toHaveTitle("orðusta");
    await expect(page.getByTestId("slip")).toContainText("orðusta");
    await expect(page.getByTestId("player-bar-name-input")).toHaveAttribute("placeholder", "nafnið þitt");
  });

  test("/is redirects to the unprefixed address, keeping the path", async ({ page }) => {
    await page.goto("/is/rules");
    await expect(page).toHaveURL(/\/rules$/);
    expect(new URL(page.url()).pathname).toBe("/rules");
    await expect(page.locator("html")).toHaveAttribute("lang", "is");
  });

  test("English lives under /en and is called wottle", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("wottle");
    await expect(page.getByTestId("slip")).toContainText("wottle");
  });

  test("signed in at /, the lobby is Icelandic and shows no English line", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("isl"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("slip")).toHaveCount(0, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/lobby");
    await expect(page.getByTestId("player-bar-action-find")).toHaveText("finna andstæðing ▸");
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
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("axe"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page).toHaveURL(/\/en\/lobby$/, { timeout: 20_000 });
    await expect(page.getByTestId("ledger-here-now")).toBeVisible();
    // The room is checked against WCAG 2.1 AA, as in room-fixtures.spec.ts (it has no h1 by design).
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, "/en/lobby").toEqual([]);
  });
});
