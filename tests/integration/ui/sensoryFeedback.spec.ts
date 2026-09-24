/**
 * Spec 015 (kept) via spec 044 and spec 070 — the sound toggle lives in the page's ⋯ menu and persists.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe("@sensory preferences in the ⋯ menu", () => {
  test("sound toggle persists to localStorage and survives navigation; there is no preview toggle", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("door-name").fill(generateTestUsername("sens"));
    await page.getByTestId("door-enter").click();
    await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 20_000 });

    const menu = page.getByTestId("page-menu");
    const sound = menu.getByRole("menuitem", { name: /^sound ·/ });
    await menu.getByRole("button", { name: "menu" }).click();
    await expect(sound).toContainText("sound · on");
    await expect(menu.getByRole("menuitem", { name: /preview/ })).toHaveCount(0);
    await sound.click();
    await expect(sound).toContainText("sound · off");

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("wottle-sensory-prefs") ?? "{}"));
    expect(stored.soundEnabled).toBe(false);

    await page.reload();
    await menu.getByRole("button", { name: "menu" }).click();
    await expect(sound).toContainText("sound · off");
  });
});
