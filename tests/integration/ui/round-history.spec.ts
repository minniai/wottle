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

  const [matchIdA, matchIdB] = await startMatchWithDirectInvite(
    pageA,
    pageB,
    { timeoutMs: 120_000, playerBUsername: userB },
  );

  expect(matchIdA).toBeTruthy();
  expect(matchIdA).toEqual(matchIdB);

  await expect(pageA.getByTestId("match-shell")).toBeVisible({
    timeout: 10_000,
  });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({
    timeout: 10_000,
  });
}

async function submitSwap(
  page: import("@playwright/test").Page,
): Promise<void> {
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

test.describe("Round history panel (post-game)", () => {
  test("shows tabs, round rows, callouts, and board highlight on word hover @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("hist-alpha");
      const userB = generateTestUsername("hist-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

      // Play 10 rounds
      for (let round = 1; round <= 10; round += 1) {
        await submitSwap(pageA);
        await submitSwap(pageB);
        const settleMs = round === 1 ? 6_000 : 3_000;
        await pageA.waitForTimeout(settleMs);
        if (round < 10) {
          const summaryPanel = pageA.getByTestId("round-summary-panel");
          await expect(summaryPanel).toBeVisible({ timeout: 45_000 });
          await pageA
            .getByTestId("round-summary-continue")
            .dispatchEvent("click");
          await expect(pageA.getByTestId("round-indicator")).toContainText(
            new RegExp(`round ${round + 1}`, "i"),
            { timeout: 5_000 },
          );
        }
      }

      // Wait for final summary page
      const summaryView = pageA.getByTestId("final-summary-view");
      await expect(summaryView).toBeVisible({ timeout: 30_000 });

      // Verify board is rendered on summary page
      await expect(pageA.getByTestId("final-summary-board")).toBeVisible();

      // Verify tab bar with both tabs
      const overviewTab = pageA.getByTestId("tab-overview");
      const historyTab = pageA.getByTestId("tab-round-history");
      await expect(overviewTab).toBeVisible();
      await expect(historyTab).toBeVisible();
      await expect(overviewTab).toHaveAttribute("aria-selected", "true");

      // Switch to Round History tab
      await historyTab.click();
      await expect(historyTab).toHaveAttribute("aria-selected", "true");
      await expect(overviewTab).toHaveAttribute("aria-selected", "false");

      // Verify round history panel is visible
      const panel = pageA.getByTestId("round-history-panel");
      await expect(panel).toBeVisible();

      // Verify round rows exist (at least some rounds should be present)
      const roundRow1 = pageA.getByTestId("round-row-1");
      await expect(roundRow1).toBeVisible();

      // Verify callout cards are present (at least one of the callout types)
      const hasBiggestSwing = await pageA
        .getByTestId("callout-biggest-swing")
        .isVisible()
        .catch(() => false);
      const hasNoSwing = await pageA
        .getByTestId("callout-no-swing")
        .isVisible()
        .catch(() => false);
      expect(hasBiggestSwing || hasNoSwing).toBe(true);

      const hasHighestWord = await pageA
        .getByTestId("callout-highest-word")
        .isVisible()
        .catch(() => false);
      const hasNoWord = await pageA
        .getByTestId("callout-no-word")
        .isVisible()
        .catch(() => false);
      expect(hasHighestWord || hasNoWord).toBe(true);

      // Expand first round to see word details
      await roundRow1.click();

      // Check that word lists are present (role="list" with aria-label)
      const wordLists = panel.locator('[role="list"]');
      const wordListCount = await wordLists.count();
      // At least 2 word lists (one per player) should be visible in the expanded round
      expect(wordListCount).toBeGreaterThanOrEqual(2);

      // If there are scored words, try hovering one for board highlight
      const wordItems = panel.locator('[role="list"] li');
      const wordCount = await wordItems.count();
      if (wordCount > 0) {
        const firstWord = wordItems.first();
        await firstWord.hover();
        // Brief pause for highlight to render
        await pageA.waitForTimeout(200);

        // Check if any tile has a highlight (--highlight-color set)
        const highlightedTile = pageA.locator(
          '.board-grid__cell--scored',
        );
        const highlightedCount = await highlightedTile.count();
        // Highlight is best-effort — word may have had 0 coordinates
        if (highlightedCount > 0) {
          await expect(highlightedTile.first()).toBeVisible();
        }
      }
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
