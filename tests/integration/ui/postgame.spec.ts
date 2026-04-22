import { test, expect, type Page } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 2, timeout: 240_000 });

async function loginPlayer(page: Page, username: string) {
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
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

test.describe("@postgame Phase 2 post-game redesign", () => {
  test("post-game verdict and words-of-match render when a match ends", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("pg-alpha");
      const userB = generateTestUsername("pg-beta");

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

      // Resign to reach the post-game screen deterministically.
      await pageA.getByTestId("hud-resign-button").click();
      await pageA.getByTestId("resign-confirm").click();

      await expect(pageA.getByTestId("final-summary-root")).toBeVisible({
        timeout: 20_000,
      });

      // New post-game surfaces.
      await expect(pageA.getByTestId("post-game-verdict")).toBeVisible();
      await expect(pageA.getByTestId("words-of-match")).toBeVisible();
      await expect(
        pageA.getByTestId("final-summary-scoreboard"),
      ).toBeVisible();
      // Chart mounts but has zero height when the match ends on round 1 with
      // no rounds played, so check the component is attached rather than visible.
      await expect(pageA.getByTestId("round-by-round-chart")).toBeAttached();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
