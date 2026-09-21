/**
 * Spec 048 US4 — no field before a name. Signed out, the room shows an empty
 * ruled frame under the sign-in slip; signing in lifts the slip and lands the
 * letters in place (no separate landing page; spec 044 US7 still holds).
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe("@landing the lobby room, signed out", () => {
  test("signed-out visitor sees the empty frame under the sign-in slip; no letters, no find-an-opponent action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby");
    await expect(page.getByTestId("player-bar-top")).toContainText("No opponent yet");
    await expect(page.getByTestId("player-bar-action-find")).toHaveCount(0);
    await expect(page.getByTestId("player-bar-bottom")).toContainText("sign in to set the field");
    await expect(page.getByTestId("slip")).toHaveAttribute("data-kind", "signIn");
    await expect(page.getByTestId("slip").getByTestId("player-bar-name-input")).toBeVisible();
    await expect(page.getByTestId("field-cell")).toHaveCount(100);
    expect(await page.getByTestId("field-cell").filter({ hasText: /\S/ }).count()).toBe(0);
    await expect(page.getByTestId("topbar")).toHaveCount(0);
  });

  test("a direct link to a match without a session shows the same slip", async ({ page }) => {
    await page.goto("/match/00000000-0000-0000-0000-000000000000");
    await expect(page.getByTestId("slip")).toHaveAttribute("data-kind", "signIn", { timeout: 15_000 });
    expect(await page.getByTestId("field-cell").filter({ hasText: /\S/ }).count()).toBe(0);
  });

  test("submitting a name lifts the slip, lands the letters and lands on /lobby without a fresh page", async ({ page }) => {
    await page.goto("/");
    const fieldHandle = await page.getByTestId("field").elementHandle();
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("landing"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("slip")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("player-bar-bottom").getByTestId("player-bar-subline")).toContainText(/· you/i, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await expect(page.getByTestId("player-bar-action-find")).toBeEnabled();
    await expect(page.getByTestId("field-cell").filter({ hasText: /\S/ })).toHaveCount(100, { timeout: 20_000 });
    // The same field element is still mounted (no route flash).
    expect(await fieldHandle?.evaluate((el) => el.isConnected)).toBe(true);
  });

  test("warm-up field swaps locally once signed in, without any move request", async ({ page }) => {
    const moves: string[] = [];
    page.on("request", (r) => /\/api\/match\/[^/]+\/move(?:\?|$)/.test(r.url()) && moves.push(r.url()));
    await page.goto("/");
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("warmup"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page.getByTestId("field-cell").filter({ hasText: /\S/ })).toHaveCount(100, { timeout: 20_000 });
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

  test("authenticated visit to / continues to /lobby", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("player-bar-name-input").fill(generateTestUsername("redir"));
    await page.getByTestId("player-bar-action-play").click();
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await page.goto("/");
    await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
  });
});
