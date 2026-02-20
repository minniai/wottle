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

  // Click submit - the Server Action sets a cookie, calls revalidatePath("/"),
  // and the form component calls router.refresh() on success.
  await page.getByTestId("lobby-login-submit").click();

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

async function submitSwap(page: import("@playwright/test").Page, firstIndex: number) {
  const board = page.getByTestId("board-grid");
  await board.locator(`[data-tile-index="${firstIndex}"]`).click();
  await board.locator(`[data-tile-index="${firstIndex + 1}"]`).click();
}

/**
 * Returns (firstIndexA, firstIndexB) for a round so that no tile is reused across rounds.
 * Frozen tiles from previous rounds would block clicks; disjoint pairs avoid that.
 */
function getSwapIndicesForRound(round: number): { firstA: number; firstB: number } {
  const r = round - 1;
  if (r < 5) {
    return { firstA: r * 2, firstB: 20 + r * 2 };
  }
  const s = r - 5;
  return { firstA: 40 + s * 2, firstB: 50 + s * 2 };
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
        const { firstA, firstB } = getSwapIndicesForRound(round);
        await submitSwap(pageA, firstA);
        await submitSwap(pageB, firstB);
      }

      const summaryView = pageA.getByTestId("final-summary-view");
      await expect(summaryView).toBeVisible({ timeout: 30_000 });

      await expect(pageA.getByTestId("final-summary-scoreboard")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-word-history")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-timers")).toBeVisible();
      await expect(pageA.getByTestId("final-summary-ended-reason")).toContainText(/round/i);

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
