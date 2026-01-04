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

  // Click submit - the Server Action will set a cookie and redirect
  await page.getByTestId("lobby-login-submit").click();

  // Wait for lobby list to appear (indicates page re-rendered with session)
  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 15_000,
  });

  // Then check for matchmaker controls
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
  // Login players sequentially to avoid race conditions
  await loginPlayer(pageA, userA);
  await loginPlayer(pageB, userB);

  // Use direct invite for reliable matchmaking (avoids queue race conditions)
  const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, {
    timeoutMs: 30_000,
  });

  expect(matchIdA).toBeTruthy();
  expect(matchIdA).toEqual(matchIdB);

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
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
      const userA = generateTestUsername("recap-alpha");
      const userB = generateTestUsername("recap-beta");
      await loginAndStartMatch(pageA, pageB, userA, userB);

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
