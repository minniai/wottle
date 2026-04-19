import { test, expect } from "@playwright/test";

test.describe("@theme-flip Warm Editorial theme", () => {
  test("lobby body background resolves to the paper token", async ({
    page,
  }) => {
    await page.goto("/lobby");
    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor,
    );
    // OKLCH may serialize as an rgb(…) or oklch(…) depending on browser.
    // Either way, lightness should be high — not the old #0B1220 navy.
    expect(bodyBg).not.toMatch(/^rgb\(\s*11,\s*18,\s*32\s*\)$/);
    expect(bodyBg).not.toBe("rgb(11, 18, 32)");
    // Parse the colour, assert lightness > 0.8 via a simple heuristic:
    const [, r = "0", g = "0", b = "0"] =
      bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/) ?? [];
    const luminance = 0.2126 * +r + 0.7152 * +g + 0.0722 * +b;
    expect(luminance).toBeGreaterThan(200);
  });

  test("TopBar renders on lobby", async ({ page }) => {
    await page.goto("/lobby");
    const topbar = page.getByTestId("topbar");
    await expect(topbar).toBeVisible();
    await expect(topbar.getByText("Wottle")).toBeVisible();
    await expect(topbar.getByText("word · battle")).toBeVisible();
  });

  test("TopBar is position: sticky", async ({ page }) => {
    await page.goto("/lobby");
    const position = await page
      .getByTestId("topbar")
      .evaluate((el) => window.getComputedStyle(el).position);
    expect(position).toBe("sticky");
  });
});
