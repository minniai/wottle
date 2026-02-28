import { test, expect } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

async function loginPlayer(
  page: import("@playwright/test").Page,
  username: string,
) {
  await page.goto("/");
  await page.getByTestId("lobby-username-input").fill(username);
  await page.getByTestId("lobby-login-submit").click();
  await page.waitForTimeout(1500);
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
  await expect(page.getByTestId("matchmaker-controls")).toBeVisible({
    timeout: 10_000,
  });
}

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
  userA: string,
  userB: string,
) {
  await loginPlayer(pageA, userA);
  await loginPlayer(pageB, userB);
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

test.describe("word discovery highlights", () => {
  /**
   * Verifies the post-round visual sequence:
   * scored tiles glow → RoundSummaryPanel deferred → panel appears after glow.
   *
   * Note: scoring requires the word engine to find a valid Icelandic word.
   * If no word is scored in this round, the highlight phase is skipped entirely,
   * and we verify only that the summary panel eventually appears.
   */
  test(
    "scored tile glow precedes round summary panel @two-player-playtest",
    async ({ browser }) => {
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      try {
        const userA = generateTestUsername("highlight-alpha");
        const userB = generateTestUsername("highlight-beta");
        await loginAndStartMatch(pageA, pageB, userA, userB);

        await submitSwap(pageA);
        await submitSwap(pageB);

        // Wait for round to resolve (may take up to 15s in slow CI)
        // We detect resolution by waiting for either scored tiles OR the summary panel
        const scoredTileLocator = pageA.locator(".board-grid__cell--scored");
        const summaryPanelLocator = pageA.getByTestId("round-summary-panel");

        // Poll for up to 15s: either scored tiles appear (highlighting) or panel directly
        let scoringOccurred = false;
        try {
          await expect(scoredTileLocator.first()).toBeAttached({ timeout: 15_000 });
          scoringOccurred = true;
        } catch {
          // No word scored in this round — highlight phase is skipped (expected behavior)
          scoringOccurred = false;
        }

        if (scoringOccurred) {
          // Scored tiles are visible: panel must NOT be visible yet (800ms gate)
          await expect(summaryPanelLocator).not.toBeVisible({ timeout: 200 });

          // Verify --highlight-color CSS custom property is set on a scored tile
          const firstScoredTile = scoredTileLocator.first();
          const highlightColor = await firstScoredTile.evaluate((el) =>
            getComputedStyle(el).getPropertyValue("--highlight-color").trim(),
          );
          expect(highlightColor).toMatch(/rgba?\(/);

          // After glow: summary panel appears (generous timeout for slow CI)
          await expect(summaryPanelLocator).toBeVisible({ timeout: 5_000 });

          // Confirm the scored class is removed once panel shows
          await expect(scoredTileLocator.first()).not.toBeAttached({
            timeout: 2_000,
          });
        } else {
          // No scoring: panel appears immediately (no highlight phase)
          await expect(summaryPanelLocator).toBeVisible({ timeout: 20_000 });
        }
      } finally {
        await pageA.close();
        await pageB.close();
        await contextA.close();
        await contextB.close();
      }
    },
  );
});
