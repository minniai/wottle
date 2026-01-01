import { test, expect } from "@playwright/test";

import {
  BOARD_DIMENSIONS_LABEL,
  BOARD_TILE_COUNT,
} from "@/lib/constants/board";

const BOARD_GRID_SELECTOR = '[data-testid="board-grid"]';
const BOARD_TILE_SELECTOR = '[data-testid="board-tile"]';

test.describe("Board grid rendering", () => {
  test.skip(`renders a ${BOARD_DIMENSIONS_LABEL} grid on desktop`, async ({ page }) => {
    // SKIP: Board moved to /match/[matchId] in Phase 3
    await page.goto("/");
    await page.waitForSelector(BOARD_GRID_SELECTOR);

    const tiles = page.locator(BOARD_TILE_SELECTOR);
    await expect(tiles).toHaveCount(BOARD_TILE_COUNT);
    await expect(page.locator(BOARD_GRID_SELECTOR)).toBeVisible();
  });

  test.skip(`renders a ${BOARD_DIMENSIONS_LABEL} grid on mobile viewports`, async ({ page }) => {
    // SKIP: Board moved to /match/[matchId] in Phase 3
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector(BOARD_GRID_SELECTOR);

    const tiles = page.locator(BOARD_TILE_SELECTOR);
    await expect(tiles).toHaveCount(BOARD_TILE_COUNT);
    await expect(page.locator(BOARD_GRID_SELECTOR)).toBeVisible();
  });

  test.skip("meets the 2s time-to-interactive target on cold load", async ({ page }) => {
    // SKIP: Board moved to /match/[matchId] in Phase 3
    await page.goto("/");
    await page.waitForSelector(BOARD_GRID_SELECTOR);

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const hydrationMark = performance
        .getEntriesByName("board-grid:hydrated")
        .at(-1) as PerformanceEntry | undefined;

      return {
        navigationStart: navigation?.startTime ?? 0,
        hydrationMark: hydrationMark?.startTime ?? null,
      };
    });

    expect(metrics.hydrationMark).not.toBeNull();
    expect((metrics.hydrationMark ?? Infinity) - metrics.navigationStart).toBeLessThanOrEqual(2000);
  });
});


