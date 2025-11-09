import { test, expect } from "@playwright/test";

const BOARD_TILE_SELECTOR = "[data-testid=\"board-tile\"]";
const ERROR_SELECTOR = "[data-testid=\"swap-error\"]";

test("restores the previous board state when the swap request fails", async ({ page }) => {
  await page.route("**/api/swap", async (route) => {
    await route.abort("failed");
    await page.unroute("**/api/swap");
  });

  await page.goto("/");
  await page.waitForSelector(BOARD_TILE_SELECTOR);

  const tiles = page.locator(BOARD_TILE_SELECTOR);
  const [firstBeforeRaw, secondBeforeRaw] = await Promise.all([
    tiles.nth(0).textContent(),
    tiles.nth(1).textContent(),
  ]);

  const firstBefore = firstBeforeRaw?.trim();
  const secondBefore = secondBeforeRaw?.trim();
  if (!firstBefore || !secondBefore) {
    throw new Error("Could not read board tiles before swap");
  }

  await tiles.nth(0).click();
  await tiles.nth(1).click();

  const errorBanner = page.locator(ERROR_SELECTOR);
  await expect(errorBanner).toBeVisible();
  await expect(errorBanner).toContainText(/network/i);

  const [firstAfter, secondAfter] = await Promise.all([
    tiles.nth(0).textContent(),
    tiles.nth(1).textContent(),
  ]);

  expect(firstAfter?.trim()).toBe(firstBefore);
  expect(secondAfter?.trim()).toBe(secondBefore);
});


