/**
 * Spec 060 US2, SC-003: a player queueing at / (Icelandic) and one at /en
 * (English) are never paired; each keeps searching in their own lobby.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.skip(({ browserName }) => browserName !== "chromium", "two-context queue flow runs on chromium only");

async function signIn(page: import("@playwright/test").Page, home: "/" | "/en", prefix: string) {
  await page.goto(home);
  await page.getByTestId("player-bar-name-input").fill(generateTestUsername(prefix));
  await page.getByTestId("player-bar-action-play").click();
  await expect(page.getByTestId("slip")).toHaveCount(0, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 20_000 });
  await expect(page.getByTestId("player-bar-action-find")).toBeEnabled({ timeout: 10_000 });
}

/** Leave the queue: a player left searching is paired with the next spec's player (CI 2026-09-23). */
async function cancelSearch(page: import("@playwright/test").Page) {
  const cancel = page.getByTestId("ledger-cancel-queue");
  if (!(await cancel.isVisible().catch(() => false))) return;
  await cancel.click();
  await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby", { timeout: 15_000 });
}

test.describe("@locale the queue by language", () => {
  test("an Icelandic and an English player searching together are not paired", async ({ browser }) => {
    const [isCtx, enCtx] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [isPage, enPage] = await Promise.all([isCtx.newPage(), enCtx.newPage()]);
    try {
      await signIn(isPage, "/", "xl-is");
      await signIn(enPage, "/en", "xl-en");

      // Neither sees the other in "here now".
      await expect(isPage.getByTestId("ledger-here-now")).not.toContainText("xl-en");
      await expect(enPage.getByTestId("ledger-here-now")).not.toContainText("xl-is");

      await isPage.getByTestId("player-bar-action-find").click();
      await enPage.getByTestId("player-bar-action-find").click();
      await expect(isPage.getByTestId("room")).toHaveAttribute("data-phase", "queue", { timeout: 15_000 });
      await expect(enPage.getByTestId("room")).toHaveAttribute("data-phase", "queue", { timeout: 15_000 });

      // Several queue polls (3s apart) later, both are still searching.
      await isPage.waitForTimeout(12_000);
      await expect(isPage.getByTestId("room")).toHaveAttribute("data-phase", "queue");
      await expect(enPage.getByTestId("room")).toHaveAttribute("data-phase", "queue");
      expect(new URL(isPage.url()).pathname).toBe("/matchmaking");
      expect(new URL(enPage.url()).pathname).toBe("/en/matchmaking");
    } finally {
      await Promise.all([cancelSearch(isPage), cancelSearch(enPage)]);
      await Promise.all([isCtx.close(), enCtx.close()]);
    }
  });
});
