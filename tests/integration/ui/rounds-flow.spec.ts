import { expect, test } from "@playwright/test";

import { startMatchWithRetry } from "./helpers/matchmaking";

/**
 * Generates a unique username for test isolation.
 */
function generateTestUsername(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}-${timestamp}-${random}`;
}

test.describe("Round flow", () => {
  test("completes 10 rounds with reconnect safety + late swap guards @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    async function loginAndStartMatch(userA: string, userB: string) {
      await Promise.all([pageA.goto("/"), pageB.goto("/")]);

      await pageA.getByTestId("lobby-username-input").fill(userA);
      await pageA.getByTestId("lobby-login-submit").click();
      await pageB.getByTestId("lobby-username-input").fill(userB);
      await pageB.getByTestId("lobby-login-submit").click();

      await expect(pageA.getByTestId("matchmaker-controls")).toBeVisible();
      await expect(pageB.getByTestId("matchmaker-controls")).toBeVisible();

      // Use retry logic to handle race conditions
      // Reduced retries and timeout to avoid hitting test timeout
      const [matchIdA, matchIdB] = await startMatchWithRetry(pageA, pageB, {
        maxRetries: 3,
        timeoutMs: 15_000,
      });

      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);

      await expect(pageA.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });
      await expect(pageB.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });
    }

    async function submitSwap(page: typeof pageA, firstIndex: number, secondIndex: number) {
      const board = page.getByTestId("board-grid");
      await board.locator(`[data-tile-index="${firstIndex}"]`).click();
      await board.locator(`[data-tile-index="${secondIndex}"]`).click();
    }

    try {
      const userA = generateTestUsername("round-alpha");
      const userB = generateTestUsername("round-beta");
      await loginAndStartMatch(userA, userB);

      const waitingOverlayA = pageA.getByTestId("round-waiting-overlay");
      const waitingOverlayB = pageB.getByTestId("round-waiting-overlay");
      const summaryPanelA = pageA.getByTestId("round-summary-panel");

      for (let round = 1; round <= 10; round += 1) {
        const indicatorA = pageA.getByTestId("round-indicator");
        const indicatorB = pageB.getByTestId("round-indicator");
        await expect(indicatorA).toHaveText(`Round ${round}`, { timeout: 10000 });
        await expect(indicatorB).toHaveText(`Round ${round}`);
        await expect(pageA.getByTestId("timer-display")).toBeVisible();
        await expect(pageB.getByTestId("timer-display")).toBeVisible();

        await submitSwap(pageA, round - 1, round);
        await expect(waitingOverlayA).toBeVisible();
        await expect(waitingOverlayB).not.toBeVisible();

        await submitSwap(pageB, round + 9, round + 10);
        await expect(waitingOverlayA).not.toBeVisible({ timeout: 12000 });
        await expect(waitingOverlayB).not.toBeVisible({ timeout: 12000 });

        await expect(summaryPanelA).toBeVisible({ timeout: 8000 });

        if (round === 5) {
          // Simulate reconnect: refresh player B mid-round between submissions
          await pageB.reload();
          await expect(pageA.getByTestId("reconnect-banner")).toBeVisible();
          await expect(pageB.getByTestId("reconnect-banner")).toBeVisible();
          await expect(pageA.getByTestId("reconnect-banner")).toBeHidden({ timeout: 10000 });
          await expect(pageB.getByTestId("round-indicator")).toHaveText("Round 5", {
            timeout: 10000,
          });
        }

        if (round < 10) {
          await expect(indicatorA).toHaveText(`Round ${round + 1}`, { timeout: 12000 });
        }
      }

      await expect(pageA.getByTestId("final-summary")).toBeVisible({ timeout: 12000 });
      await expect(pageB.getByTestId("final-summary")).toBeVisible({ timeout: 12000 });

      // Attempt a late swap after match completion, expect rejection toast/banner
      await submitSwap(pageA, 0, 1);
      await expect(pageA.getByTestId("round-alert")).toContainText(/round closed/i);
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
