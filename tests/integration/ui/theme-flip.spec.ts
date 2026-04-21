import { test, expect } from "@playwright/test";

test.describe("@theme-flip Warm Editorial theme", () => {
  test("lobby body background resolves to the paper token", async ({
    page,
  }) => {
    // `/lobby` redirects unauthenticated visitors to `/`; either page pulls
    // the body background from globals.css so the assertion is the same.
    await page.goto("/");
    // Sample the paint colour via canvas so we don't care whether
    // getComputedStyle serialises as rgb(…) or oklch(…) — canvas.fillStyle
    // resolves any CSS colour into an 8-bit pixel.
    const luminance = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return 0;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
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
