import { test, expect } from "@playwright/test";

const BOARD_TILE_SELECTOR = "[data-testid=\"board-tile\"]";
const ERROR_SELECTOR = "[data-testid=\"swap-error\"]";

async function getTileLetters(page: import("@playwright/test").Page, indices: number[]) {
  const tiles = page.locator(BOARD_TILE_SELECTOR);
  return Promise.all(
    indices.map(async (index) => {
      const raw = await tiles.nth(index).textContent();
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

    await expect(page.locator(ERROR_SELECTOR)).toBeHidden({ timeout: 5000 });

    await expect
      .poll(async () => getTileLetters(page, [0, 1]))
      .toEqual([secondBefore, firstBefore]);
  });

  test("shows an error and keeps the board unchanged on invalid swaps", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    const firstTile = page.locator(BOARD_TILE_SELECTOR).first();
    const letterBeforeRaw = await firstTile.textContent();
    const letterBefore = letterBeforeRaw?.trim();
    if (!letterBefore) {
      throw new Error("Failed to read tile text before invalid swap");
    }

    await firstTile.click();
    await firstTile.click();

    const errorBanner = page.locator(ERROR_SELECTOR);
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/invalid swap/i);

    const letterAfter = (await firstTile.textContent())?.trim();
    expect(letterAfter).toBe(letterBefore);
  });
});


