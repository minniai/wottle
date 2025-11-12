import { test, expect } from "@playwright/test";

const BOARD_TILE_SELECTOR = "[data-testid=\"board-tile\"]";
const FEEDBACK_SELECTOR = "[data-testid=\"move-feedback-toast\"]";

async function getTileLetters(page: import("@playwright/test").Page, indices: number[]) {
  const tiles = page.locator(BOARD_TILE_SELECTOR);
  return Promise.all(
    indices.map(async (index) => {
      const raw = await tiles
        .nth(index)
        .locator("[aria-hidden=\"true\"]")
        .textContent();
      return raw?.trim() ?? null;
    })
  );
}

test.describe("Swap flow", () => {
  test("performs a successful swap and updates the grid", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    const [firstBeforeRaw, secondBeforeRaw] = await getTileLetters(page, [0, 1]);
    if (!firstBeforeRaw || !secondBeforeRaw) {
      throw new Error("Failed to read initial board tile letters for swap test");
    }
    const firstBefore = firstBeforeRaw;
    const secondBefore = secondBeforeRaw;

    await page.click(`${BOARD_TILE_SELECTOR}:nth-of-type(1)`);
    await page.click(`${BOARD_TILE_SELECTOR}:nth-of-type(2)`);

    const feedbackToast = page.locator(FEEDBACK_SELECTOR);
    await expect(feedbackToast).toBeVisible({ timeout: 5000 });
    await expect(feedbackToast).toHaveAttribute("data-variant", "success");
    await expect(feedbackToast).toContainText(/move accepted/i);

    await expect
      .poll(async () => getTileLetters(page, [0, 1]))
      .toEqual([secondBefore, firstBefore]);
  });

  test("shows an error and keeps the board unchanged on invalid swaps", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    const firstTile = page.locator(BOARD_TILE_SELECTOR).first();
    const letterBeforeRaw = await firstTile.locator("[aria-hidden=\"true\"]").textContent();
    const letterBefore = letterBeforeRaw?.trim();
    if (!letterBefore) {
      throw new Error("Failed to read tile text before invalid swap");
    }

    await firstTile.click();
    await firstTile.click();

    const feedbackToast = page.locator(FEEDBACK_SELECTOR);
    await expect(feedbackToast).toBeVisible();
    await expect(feedbackToast).toHaveAttribute("data-variant", "error");
    await expect(feedbackToast).toContainText(/invalid swap/i);

    const letterAfter = (await firstTile.locator("[aria-hidden=\"true\"]").textContent())?.trim();
    expect(letterAfter).toBe(letterBefore);
  });
});


