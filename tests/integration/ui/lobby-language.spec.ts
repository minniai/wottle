import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

/**
 * Spec 070 US7 (T100): one lobby language per player. Reading a page in the
 * other locale never moves you; opening the other lobby with a search out asks
 * first, and confirming stops the search and moves you.
 */
async function enter(page: Page, path: "/" | "/en", name: string): Promise<void> {
  await page.goto(path);
  await page.getByTestId("door-name").fill(name);
  await page.getByTestId("door-enter").click();
  await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 20_000 });
}

test.describe("one lobby language (spec 070 US7)", () => {
  test("/en/rules keeps you in the Icelandic lobby; /en with a search out asks before switching", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    const nameA = generateTestUsername("lla");
    try {
      await enter(pageA, "/", nameA);
      await enter(pageB, "/", generateTestUsername("llb"));
      const rowA = pageB.getByTestId("lobby-row").filter({ hasText: nameA });
      await expect(rowA).toBeVisible({ timeout: 15_000 });

      await pageA.goto("/en/rules");
      await pageA.waitForTimeout(12_000);
      await pageB.reload();
      await expect(rowA).toBeVisible({ timeout: 15_000 });

      await pageA.goto("/");
      await pageA.getByTestId("lobby-find").click();
      await expect(pageA.getByTestId("line-slot-line1").first()).toContainText("Leitar að mótspilara", { timeout: 10_000 });

      await pageA.goto("/en");
      const slot = pageA.getByTestId("line-slot-desktop");
      await expect(slot.getByTestId("line-slot-line1")).toHaveText("you are in the Icelandic lobby", { timeout: 15_000 });
      await expect(slot.getByTestId("line-slot-line2")).toHaveText("switching cancels your search");
      await expect(pageA.getByTestId("lobby-find")).toHaveCount(0);

      await pageA.waitForTimeout(600);
      await slot.getByTestId("slot-switch").click();
      await expect(pageA.getByTestId("lobby-find")).toBeVisible({ timeout: 15_000 });
      await expect(rowA).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await a.close();
      await b.close();
    }
  });
});
