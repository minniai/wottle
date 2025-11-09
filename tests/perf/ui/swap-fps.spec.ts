import { test, expect } from "@playwright/test";

const BOARD_TILE_SELECTOR = "[data-testid=\"board-tile\"]";

function percentile(values: number[], percentileRank: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((percentileRank / 100) * sorted.length)
  );
  return sorted[index];
}

test.describe("Swap animation performance", () => {
  test("maintains 60 FPS during a tile swap", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    await page.exposeFunction("__collectFrames", () => {
      return new Promise<number[]>((resolve) => {
        const frames: number[] = [];
        let last = performance.now();
        let count = 0;

        function step(now: number) {
          if (count > 0) {
            frames.push(now - last);
          }
          last = now;
          count += 1;

          if (count >= 121) {
            resolve(frames);
            return;
          }

          requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      });
    });

    const measurementPromise = page.evaluate(() => {
      return (window as typeof window & { __collectFrames: () => Promise<number[]> }).__collectFrames();
    });

    const tiles = page.locator(BOARD_TILE_SELECTOR);
    await tiles.nth(0).click();
    await tiles.nth(1).click();

    const frameDurations = await measurementPromise;
    expect(frameDurations.length).toBeGreaterThan(0);

    const p95 = percentile(frameDurations, 95);
    expect(p95).toBeLessThanOrEqual(16.7);
  });
});


