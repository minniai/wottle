/**
 * Spec 044 US7 — landing is the lobby room with an empty bottom seat; signing in
 * converts the bar in place (no separate landing page).
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe("@landing the lobby room, signed out", () => {
  test("signed-out visitor sees the room: empty top bar, warm-up field, name input; play ranked is disabled", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby");
    await expect(page.getByTestId("player-bar-top")).toContainText("No opponent yet");
    await expect(page.getByTestId("player-bar-action-ranked")).toBeDisabled();
    await expect(page.getByTestId("player-bar-name-input")).toBeVisible();
    await expect(page.getByTestId("field-cell")).toHaveCount(100);
    await expect(page.getByTestId("topbar")).toHaveCount(0);
  });

  test("warm-up field swaps locally without any move request", async ({ page }) => {
    const moves: string[] = [];
    page.on("request", (r) => r.url().includes("/api/match/") && moves.push(r.url()));
    await page.goto("/");
    const a = page.locator('[data-testid="field-cell"][data-x="0"][data-y="0"]');
    const b = page.locator('[data-testid="field-cell"][data-x="1"][data-y="0"]');
    const [ta, tb] = [await a.textContent(), await b.textContent()];
    await a.click();
    await expect(a).toHaveAttribute("data-state", "picked");
    await b.click();
    await expect(a).toHaveText(tb ?? "");
    await expect(b).toHaveText(ta ?? "");
    expect(moves).toEqual([]);
  });

  test("submitting a name converts the bottom bar in place and lands on /lobby without a fresh page", async ({ page }) => {
    await page.goto("/");
    const fieldHandle = await page.getByTestId("field").elementHandle();
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("landing"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("player-bar-bottom").getByTestId("player-bar-subline")).toContainText(/· you/i, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await expect(page.getByTestId("player-bar-action-ranked")).toBeEnabled();
    // The same field element is still mounted (no route flash).
    expect(await fieldHandle?.evaluate((el) => el.isConnected)).toBe(true);
  });

  test("authenticated visit to / continues to /lobby", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("redir"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await page.goto("/");
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
  });
});
