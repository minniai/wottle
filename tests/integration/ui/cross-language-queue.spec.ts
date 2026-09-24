/**
 * Spec 060 US2, SC-003: a player queueing at / (Icelandic) and one at /en
 * (English) are never paired; each keeps searching in their own lobby.
 * Spec 070: the search runs in the line slot; the URL never changes.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.skip(({ browserName }) => browserName !== "chromium", "two-context queue flow runs on chromium only");

async function signIn(page: import("@playwright/test").Page, home: "/" | "/en", prefix: string) {
  await page.goto(home);
  await page.getByTestId("door-name").fill(generateTestUsername(prefix));
  await page.getByTestId("door-enter").click();
  await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 20_000 });
}

/** Leave the queue: a player left searching is paired with the next spec's player (CI 2026-09-23). */
async function cancelSearch(page: import("@playwright/test").Page) {
  const cancel = page.locator("[data-testid=slot-cancelSearch]:visible").first();
  if (!(await cancel.isVisible().catch(() => false))) return;
  await cancel.click();
  await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 15_000 });
}

test.describe("@locale the queue by language", () => {
  test("an Icelandic and an English player searching together are not paired", async ({ browser }) => {
    const [isCtx, enCtx] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [isPage, enPage] = await Promise.all([isCtx.newPage(), enCtx.newPage()]);
    try {
      await signIn(isPage, "/", "xl-is");
      await signIn(enPage, "/en", "xl-en");

      // Neither sees the other in "here now".
      await expect(isPage.getByRole("main")).not.toContainText("xl-en");
      await expect(enPage.getByRole("main")).not.toContainText("xl-is");

      await isPage.getByTestId("lobby-find").click();
      await enPage.getByTestId("lobby-find").click();
      const isLine = isPage.getByTestId("line-slot-line1").first();
      const enLine = enPage.getByTestId("line-slot-line1").first();
      await expect(isLine).toContainText("Leitar að mótspilara", { timeout: 15_000 });
      await expect(enLine).toContainText("Searching for an opponent", { timeout: 15_000 });

      // Several queue polls (3s apart) later, both are still searching, in place.
      await isPage.waitForTimeout(12_000);
      await expect(isLine).toContainText("Leitar að mótspilara");
      await expect(enLine).toContainText("Searching for an opponent");
      expect(new URL(isPage.url()).pathname).toBe("/");
      expect(new URL(enPage.url()).pathname).toBe("/en");
    } finally {
      await Promise.all([cancelSearch(isPage), cancelSearch(enPage)]);
      await Promise.all([isCtx.close(), enCtx.close()]);
    }
  });
});
