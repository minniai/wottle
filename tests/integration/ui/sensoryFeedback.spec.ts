/**
 * Spec 015 (kept) via spec 044 — sound and preview toggles live in the ⋯ menu and persist.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe("@sensory preferences in the ⋯ menu", () => {
  test("sound toggle persists to localStorage and survives navigation; preview defaults off", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("sens"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("ledger-here-now")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("ledger-menu-trigger").click();
    await expect(page.getByTestId("ledger-menu-item-sound")).toContainText("sound · on");
    await expect(page.getByTestId("ledger-menu-item-preview")).toContainText("preview · off");
    await page.getByTestId("ledger-menu-item-sound").click();
    await expect(page.getByTestId("ledger-menu-item-sound")).toContainText("sound · off");

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("wottle-sensory-prefs") ?? "{}"));
    expect(stored.soundEnabled).toBe(false);
    expect(stored.previewEnabled ?? false).toBe(false);

    await page.reload();
    await page.getByTestId("ledger-menu-trigger").click();
    await expect(page.getByTestId("ledger-menu-item-sound")).toContainText("sound · off");
  });
});
