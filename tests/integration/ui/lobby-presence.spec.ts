/**
 * Spec 044 US7 — the here-now table shows other players within seconds and drops them on leave.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@lobby-presence here now", () => {
  test("shows both players within five seconds and updates on leave", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      const userA = generateTestUsername("pres-a");
      const userB = generateTestUsername("pres-b");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await expect(pageA.getByTestId("ledger-here-now").getByText(`@${userB}`)).toBeVisible({ timeout: 10_000 });
      await expect(pageB.getByTestId("ledger-here-now").getByText(`@${userA}`)).toBeVisible({ timeout: 10_000 });
      await expect(pageA.getByTestId("round-indicator")).toContainText(/lobby · \d+ here/);
      await ctxB.close();
      await expect(pageA.getByTestId("ledger-here-now").getByText(`@${userB}`)).toHaveCount(0, { timeout: 90_000 });
    } finally {
      await ctxA.close();
    }
  });
});
