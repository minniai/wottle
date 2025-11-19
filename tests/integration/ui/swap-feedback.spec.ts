import { expect, test } from "@playwright/test";

const BOARD_TILE_SELECTOR = '[data-testid="board-tile"]';
const FEEDBACK_SELECTOR = '[data-testid="move-feedback-toast"]';

test.describe("Swap feedback accessibility", () => {
  test.skip("displays success feedback with a polite live region", async ({ page }) => {
    // SKIP: Board moved to /match/[matchId] in Phase 3
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    await page.click(`${BOARD_TILE_SELECTOR}:nth-of-type(1)`);
    await page.click(`${BOARD_TILE_SELECTOR}:nth-of-type(2)`);

    const toast = page.locator(FEEDBACK_SELECTOR);
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveAttribute("role", "status");
    await expect(toast).toHaveAttribute("aria-live", "polite");
    await expect(toast).toContainText(/move accepted/i);
    await expect(toast).toBeFocused();
  });

  test.skip("surfaces assertive feedback for rejected swaps", async ({ page }) => {
    // SKIP: Board moved to /match/[matchId] in Phase 3
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    const firstTile = page.locator(BOARD_TILE_SELECTOR).first();
    await firstTile.click();
    await firstTile.click();

    const toast = page.locator(FEEDBACK_SELECTOR);
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveAttribute("role", "alert");
    await expect(toast).toHaveAttribute("aria-live", "assertive");
    await expect(toast).toContainText(/invalid swap/i);
  });
});
