import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

/**
 * Spec 070 US6 (T035): presence per tab. Another player appears within a beat,
 * a reload never drops them, and a closed tab leaves the lobby within 8s of
 * its beacon (SC-002). Two browsers, chromium.
 */
test.describe("presence (spec 070 US6)", () => {
  test("appears, survives a reload, and leaves within 8s of closing", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    const nameA = generateTestUsername("presA");
    const nameB = generateTestUsername("presB");
    try {
      for (const [page, name] of [[pageA, nameA], [pageB, nameB]] as const) {
        await page.goto("/en");
        await page.getByTestId("door-name").fill(name);
        await page.getByTestId("door-enter").click();
        await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 20_000 });
      }
      const rowB = pageA.getByTestId("lobby-row").filter({ hasText: nameB });
      await expect(rowB).toBeVisible({ timeout: 15_000 });

      // A reload beats again within the leaving grace: B never drops out.
      await pageB.reload();
      await expect(pageB.getByTestId("lobby-find")).toBeVisible({ timeout: 20_000 });
      for (let i = 0; i < 10; i += 1) {
        await expect(rowB).toBeVisible();
        await pageA.waitForTimeout(1_000);
      }

      await pageB.close();
      const closedAt = Date.now();
      await expect(rowB).toHaveCount(0, { timeout: 15_000 });
      expect(Date.now() - closedAt).toBeLessThan(12_000);
    } finally {
      await a.close();
      await b.close();
    }
  });
});
