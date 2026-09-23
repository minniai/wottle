import { expect, test } from "@playwright/test";

// No database: exercise the same final ledger through the room fixtures.
for (const height of [844, 780]) {
  test(`completed game history scrolls to every move at 390×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    await page.goto("/dev/room?phase=final");
    await page.evaluate(() => document.fonts.ready);
    const trigger = page.getByTestId("ledger-live-trigger");
    await trigger.click();
    const sheet = page.getByTestId("ledger-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveCSS("overflow-y", "auto");

    const geometry = await sheet.evaluate((el) => ({
      bottom: el.getBoundingClientRect().bottom,
      top: el.getBoundingClientRect().top,
      // Spec 068 FR-017: the sheet lies below the field, never over the scoreboard.
      barBottom: document.querySelector('[data-testid="room-slot-field"]')!.getBoundingClientRect().bottom,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      pageHeight: document.scrollingElement!.scrollHeight,
    }));
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.barBottom);
    expect(geometry.bottom).toBeLessThanOrEqual(height);
    expect(geometry.clientHeight).toBeGreaterThan(44);
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
    expect(geometry.pageHeight).toBeLessThanOrEqual(height);

    // Scroll only the history, so locator auto-scrolling cannot mask clipping.
    const moves = Array.from({ length: 10 }, (_, i) => `ledger-row-${i + 1}`);
    for (const id of [...moves, "ledger-totals", "ledger-foot"]) {
      await sheet.evaluate((el, testId) => {
        const target = el.querySelector(`[data-testid="${testId}"]`)!;
        el.scrollTop += target.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
      }, id);
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 0.9 });
    }

    await sheet.evaluate((el) => { el.scrollTop = 0; });
    await page.getByTestId("ledger-sheet-close").click();
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
