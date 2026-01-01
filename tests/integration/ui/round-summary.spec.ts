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

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
) {
  const userA = generateTestUsername("summary-alpha");
  const userB = generateTestUsername("summary-beta");

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

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
}

async function submitSwap(page: import("@playwright/test").Page, startIndex: number) {
  const board = page.getByTestId("board-grid");
  await board.locator(`[data-tile-index="${startIndex}"]`).click();
  await board.locator(`[data-tile-index="${startIndex + 1}"]`).click();
}

test.describe("Round summary panel", () => {
  test("shows scoring deltas, highlights, and aria feedback @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndStartMatch(pageA, pageB);

      // Complete a single round to trigger scoring summary
      await submitSwap(pageA, 0);
      await submitSwap(pageB, 10);

      const summaryPanel = pageA.getByTestId("round-summary-panel");
      await expect(summaryPanel).toBeVisible({ timeout: 12000 });
      await expect(summaryPanel).toHaveAttribute("role", "dialog");

      const wordRows = summaryPanel.getByTestId("round-summary-word");
      await expect(wordRows.first()).toBeVisible();
      await expect(summaryPanel.getByTestId("round-summary-totals")).toContainText(
        /your score/i,
      );

      const overlay = pageA.getByTestId("word-highlight-overlay");
      await expect(overlay).toBeVisible();

      // Dismiss summary and ensure overlay clears
      await pageA.getByTestId("round-summary-dismiss").click();
      await expect(summaryPanel).toBeHidden({ timeout: 5000 });
      await expect(pageA.getByTestId("word-highlight-overlay")).toBeHidden({
        timeout: 5000,
      });

      // Ensure other player sees same totals (SC-004 parity)
      const summaryPanelB = pageB.getByTestId("round-summary-panel");
      await expect(summaryPanelB).toBeVisible({ timeout: 12000 });
      await expect(summaryPanelB.getByTestId("round-summary-totals")).toContainText(
        /opponent/i,
      );
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});

