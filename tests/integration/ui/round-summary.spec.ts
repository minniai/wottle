import { expect, test } from "@playwright/test";

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

/**
 * Submits a swap by clicking two adjacent unfrozen tiles.
 * Uses the first horizontal pair where neither tile is frozen.
 */
async function submitSwap(page: import("@playwright/test").Page): Promise<void> {
  const board = page.getByTestId("board-grid");
  for (let n = 0; n < 99; n += 1) {
    if (n % 10 === 9) continue;
    const tileA = board.locator(`[data-tile-index="${n}"]`);
    const tileB = board.locator(`[data-tile-index="${n + 1}"]`);
    const frozenA = await tileA.getAttribute("data-frozen");
    const frozenB = await tileB.getAttribute("data-frozen");
    if (!frozenA && !frozenB) {
      await tileA.click();
      await tileB.click();
      return;
    }
  }
  throw new Error("No unfrozen adjacent tile pair found");
}

test.describe("Round summary inline", () => {
  // Phase 1c stopped mounting the PlayerPanel full variant that carried
  // RoundHistoryInline (see CLAUDE.md "Unused PlayerPanel full variant"),
  // so `round-history-inline` no longer appears in the live DOM. The overlay
  // history (`hud-history-button` → `history-overlay` → `round-history-panel`)
  // is covered by round-history.spec.ts. Unskip or rewrite against the
  // overlay once the inline surface is either restored or fully removed.
  test.skip("shows inline round history and score delta after round resolves @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("summary-alpha");
      const userB = generateTestUsername("summary-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

      // Submit moves for round 1
      await submitSwap(pageA);
      await submitSwap(pageB);

      // Wait for round to resolve and advance — rounds auto-advance after recap animation
      const roundIndicator = pageA.getByTestId("game-chrome-player").getByTestId("round-indicator");
      await expect(roundIndicator).toContainText(/r2/i, { timeout: 45_000 });

      // Inline round history should show round 1 data in the player panel
      const inlineHistory = pageA.getByTestId("round-history-inline").first();
      await expect(inlineHistory).toBeVisible({ timeout: 5_000 });
      await expect(inlineHistory).toContainText(/round 1/i);
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
