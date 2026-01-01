import { expect, test } from "@playwright/test";

import { startMatchWithRetry } from "./helpers/matchmaking";

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
  userA: string,
  userB: string,
) {
  await Promise.all([pageA.goto("/"), pageB.goto("/")]);

  await pageA.getByTestId("lobby-username-input").fill(userA);
  await pageA.getByTestId("lobby-login-submit").click();

  await pageB.getByTestId("lobby-username-input").fill(userB);
  await pageB.getByTestId("lobby-login-submit").click();

  await expect(pageA.getByTestId("matchmaker-controls")).toBeVisible();
  await expect(pageB.getByTestId("matchmaker-controls")).toBeVisible();

  // Use retry logic to handle race conditions
  const [matchIdA, matchIdB] = await startMatchWithRetry(pageA, pageB, {
    maxRetries: 5,
    timeoutMs: 20_000,
  });

  expect(matchIdA).toBeTruthy();
  expect(matchIdA).toEqual(matchIdB);

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 5_000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 5_000 });
}

async function submitSwap(page: import("@playwright/test").Page, firstIndex: number) {
  const board = page.getByTestId("board-grid");
  await board.locator(`[data-tile-index="${firstIndex}"]`).click();
  await board.locator(`[data-tile-index="${firstIndex + 1}"]`).click();
}

test.describe("Final summary recap", () => {
  test("shows scores, word history, and rematch affordances @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndStartMatch(pageA, pageB, "recap-alpha", "recap-beta");

      for (let round = 1; round <= 10; round += 1) {
        await submitSwap(pageA, round - 1);
        await submitSwap(pageB, round + 9);
      }

      const summaryView = pageA.getByTestId("final-summary-view");
      await expect(summaryView).toBeVisible({ timeout: 20_000 });

      await expect(pageA.getByTestId("final-summary-scoreboard")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-word-history")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-timers")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-ended-reason")).toContainText(/round limit/i);

      await expect(pageA.getByTestId("final-summary-rematch")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-back-lobby")).toBeVisible();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});

