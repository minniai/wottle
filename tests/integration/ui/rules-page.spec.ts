/**
 * Spec 048 US5 — the rules live on their own page, reached from the lobby and
 * final feet, the sign-in slip, and the match menu (new tab). Opening them from a
 * match never interrupts it.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

test.describe("@rules the how-to-play page", () => {
  test("renders without a session: six sections in order, three figures, the table, axe clean", async ({ page }) => {
    await page.goto("/en/rules");
    await expect(page.getByTestId("rules-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Swap two letters.",
      "Three letters or more, in a straight line.",
      "Scored letters freeze in your ink.",
      "Values and length.",
      "Five minutes for the whole match.",
      "Ten moves first, then most points.",
    ]);
    for (const kind of ["swap", "words", "crossing"]) await expect(page.getByTestId(`rules-figure-${kind}`)).toBeVisible();
    await expect(page.getByTestId("rules-scoring")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("is a single column with no horizontal scroll at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/rules");
    const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test("the sign-in slip and the lobby foot link to it in the same tab", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("slip-how-to-play")).toHaveAttribute("href", "/en/rules");
    await loginViaSlip(page, generateTestUsername("rules"));
    await page.getByTestId("ledger-how-to-play").click();
    await expect(page).toHaveURL(/\/rules$/);
    await page.getByTestId("rules-back-top").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  });

  test("opened from a live match's menu, the page comes up in a new tab and the match keeps running", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      const playerBUsername = generateTestUsername("rulesB");
      await loginViaSlip(pageA, generateTestUsername("rulesA"));
      await loginViaSlip(pageB, playerBUsername);
      await startMatchWithDirectInvite(pageA, pageB, { playerBUsername });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      const clockBefore = await pageA.getByTestId("match-clock").textContent();
      await pageA.getByTestId("ledger-menu-trigger").click();
      const [rulesTab] = await Promise.all([contextA.waitForEvent("page"), pageA.getByTestId("ledger-menu-item-howToPlay").click()]);
      await expect(rulesTab).toHaveURL(/\/rules$/);
      await expect(rulesTab.getByTestId("rules-page")).toBeVisible();
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match");
      await expect
        .poll(async () => pageA.getByTestId("match-clock").textContent(), { timeout: 5_000 })
        .not.toBe(clockBefore);
      await rulesTab.close();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
