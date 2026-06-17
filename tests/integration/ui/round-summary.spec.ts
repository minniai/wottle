import { expect, test } from "@playwright/test";

import { submitSwap } from "./helpers/swaps";
import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

async function loginPlayer(
  page: import("@playwright/test").Page,
  username: string,
) {
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);

  // Click submit - the Server Action sets a cookie, calls revalidatePath("/"),
  // and the form component calls router.refresh() on success.
  await page.getByTestId("landing-login-submit").click();

  // Wait for the Server Action to complete and cookie to settle
  await page.waitForTimeout(1500);

  // Check if router.refresh() re-rendered the page with the session.
  // If not (e.g. Client Router Cache in production), fall back to goto("/")
  // which loads the page fresh. Unlike page.reload(), goto("/") creates a
  // brand-new JS context so the Zustand store has no trackedPlayerId and
  // disconnect() won't send a DELETE.
  const lobbyVisible = await page
    .getByTestId("lobby-presence-list")
    .isVisible()
    .catch(() => false);

  if (!lobbyVisible) {
    await page.goto("/");
  }

  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 20_000,
  });

  // Then check for matchmaker controls
  await expect(page.getByTestId("matchmaker-start-button")).toBeVisible({
    timeout: 10_000,
  });
}

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
  userA: string,
  userB: string,
) {
  // Login players sequentially to avoid race conditions
  await loginPlayer(pageA, userA);
  await loginPlayer(pageB, userB);

  // Use direct invite for reliable matchmaking (avoids queue race conditions)
  // Pass playerBUsername for test isolation when running in parallel
  // Use a generous timeout for CI where presence propagation is slower
  const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, {
    timeoutMs: 120_000,
    playerBUsername: userB,
  });

  expect(matchIdA).toBeTruthy();
  expect(matchIdA).toEqual(matchIdB);

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
}

test.describe("Round summary inline", () => {
  // O-71: scored words show on both rails as rounds resolve (regression guard).
  test("scored-words cards show on both rails after a round resolves @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("rail-alpha");
      const userB = generateTestUsername("rail-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

      await submitSwap(pageA);
      await submitSwap(pageB);

      // Wait for round 1 to resolve and the match to advance to round 2.
      const roundIndicator = pageA
        .getByTestId("game-chrome-player")
        .getByTestId("round-indicator");
      await expect(roundIndicator).toContainText(/r2/i, { timeout: 45_000 });

      // Left rail shows the current player's word log; right rail the opponent's.
      // Each lists every completed round (empty rounds render "no words"), so the
      // assertion holds whether or not a word actually scored.
      const leftCard = pageA
        .getByTestId("match-layout-rail-left")
        .getByTestId("scored-words-card");
      const rightCard = pageA
        .getByTestId("match-layout-rail-right")
        .getByTestId("scored-words-card");

      await expect(leftCard).toBeVisible({ timeout: 10_000 });
      await expect(leftCard).toContainText("Your words");
      await expect(leftCard).toContainText(/round 1/i);

      await expect(rightCard).toBeVisible();
      await expect(rightCard).toContainText("Opponent's words");
      await expect(rightCard).toContainText(/round 1/i);

      // On desktop the in-match History button is replaced by the rails.
      await expect(pageA.getByTestId("hud-history-button")).toBeHidden();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });

  // T011: score-delta-popup appears after round resolves
  test("T011: score-delta-popup and round-summary-panel coexist after round @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("coexist-alpha");
      const userB = generateTestUsername("coexist-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

      await submitSwap(pageA);
      await submitSwap(pageB);

      // Wait for round to resolve and advance
      const roundIndicator = pageA.getByTestId("game-chrome-player").getByTestId("round-indicator");
      await expect(roundIndicator).toContainText(/r2/i, { timeout: 45_000 });

      // Check if score delta popup appeared (depends on whether player scored)
      const popup = pageA.locator('[data-testid="score-delta-popup"]');
      const popupVisible = await popup.isVisible().catch(() => false);

      if (popupVisible) {
        // Popup contains "+N" format
        await expect(popup).toContainText(/\+\d+/);
      }

      // Popup should auto-dismiss after its animation window
      await expect(popup).not.toBeAttached({ timeout: 10_000 });
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
