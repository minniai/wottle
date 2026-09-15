/**
 * Spec 044 US7 — sign out lives in the ledger's ⋯ menu; the room returns to the empty seat.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe("@lobby-logout sign out from the ⋯ menu", () => {
  test("user A signs out and user B signs in on the same page", async ({ page }) => {
    const userA = generateTestUsername("out-a");
    const userB = generateTestUsername("out-b");
    await page.goto("/");
    await page.getByTestId("player-bar-name-input").fill(userA);
    await page.getByTestId("player-bar-action-play").click();
    // The bar shows the display name (first letter capitalised by formatDisplayName); compare case-insensitively.
    await expect(page.getByTestId("player-bar-bottom")).toContainText(userA, { timeout: 15_000, ignoreCase: true });

    await page.getByTestId("ledger-menu-trigger").click();
    await page.getByTestId("ledger-menu-item-signout").click();
    await expect(page.getByTestId("player-bar-name-input")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("player-bar-name-input").fill(userB);
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("player-bar-bottom")).toContainText(userB, { timeout: 15_000, ignoreCase: true });
    await expect(page.getByTestId("player-bar-bottom")).not.toContainText(userA, { ignoreCase: true });
  });
});
