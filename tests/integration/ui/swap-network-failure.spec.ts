import { test, expect } from "@playwright/test";

const BOARD_TILE_SELECTOR = "[data-testid=\"board-tile\"]";
const FEEDBACK_SELECTOR = "[data-testid=\"move-feedback-toast\"]";

test("restores the previous board state when the swap request fails", async ({ page }) => {
  await page.route("**/api/swap", async (route) => {
    await route.abort("failed");
    await page.unroute("**/api/swap");
  });

  await page.goto("/");
  await page.waitForSelector(BOARD_TILE_SELECTOR);

  const tiles = page.locator(BOARD_TILE_SELECTOR);
  const [firstBeforeRaw, secondBeforeRaw] = await Promise.all([
    tiles.nth(0).locator('[aria-hidden="true"]').textContent(),
    tiles.nth(1).locator('[aria-hidden="true"]').textContent(),
  ]);

  const firstBefore = firstBeforeRaw?.trim();
  const secondBefore = secondBeforeRaw?.trim();
  if (!firstBefore || !secondBefore) {
    throw new Error("Could not read board tiles before swap");
  }

  await tiles.nth(0).click();
  await tiles.nth(1).click();

  const feedbackToast = page.locator(FEEDBACK_SELECTOR);
  await expect(feedbackToast).toBeVisible();
  await expect(feedbackToast).toHaveAttribute("data-variant", "error");
  await expect(feedbackToast).toContainText(/network/i);

  const [firstAfter, secondAfter] = await Promise.all([
    tiles.nth(0).locator('[aria-hidden="true"]').textContent(),
    tiles.nth(1).locator('[aria-hidden="true"]').textContent(),
  ]);

  expect(firstAfter?.trim()).toBe(firstBefore);
  expect(secondAfter?.trim()).toBe(secondBefore);
});


