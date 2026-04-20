/**
 * Phase 1d Left Rail Smoke Test
 * Verifies that the instructional cards are in place with:
 * - How to play card
 * - Legend card
 * - Your move card
 * - YourMoveCard updates on tile selection
 */
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
  await expect(page.getByTestId("matchmaker-start-button")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("@left-rail Phase 1d instructional cards", () => {
  test("renders How to play, Legend, and Your move cards", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("rail-alpha");
      const userB = generateTestUsername("rail-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 60_000,
        playerBUsername: userB,
      });
      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);

      await expect(pageA.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });

      const leftRail = pageA.getByTestId("match-layout-rail-left");
      await expect(leftRail).toBeVisible();
      await expect(leftRail.getByTestId("how-to-play-card")).toBeVisible();
      await expect(leftRail.getByTestId("legend-card")).toBeVisible();
      await expect(leftRail.getByTestId("your-move-card")).toBeVisible();

      await expect(
        leftRail.getByText("Select your first tile."),
      ).toBeVisible();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });

  test("YourMoveCard updates when a tile is picked", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("rail-pick-alpha");
      const userB = generateTestUsername("rail-pick-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 60_000,
        playerBUsername: userB,
      });

      await expect(pageA.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });

      const leftRail = pageA.getByTestId("match-layout-rail-left");
      const tiles = pageA.getByTestId("board-tile");
      await tiles.nth(0).click();

      await expect(leftRail.getByText("A1")).toBeVisible();
      await expect(leftRail.getByText(/Pick a second/i)).toBeVisible();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
