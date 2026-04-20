/**
 * Phase 1b match-surfaces smoke tests
 * Verifies that coord labels (A-J, 1-10), round pip bar, and tiles-claimed card
 * are all visible and functional in a live two-player match.
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

test.describe("@match-surfaces Phase 1b visuals", () => {
  test("board edges show A-J and 1-10 coord labels", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("surfaces-alpha");
      const userB = generateTestUsername("surfaces-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 120_000,
        playerBUsername: userB,
      });

      // Verify top coord labels (A-J)
      const top = pageA.getByTestId("board-coords-top");
      await expect(top).toBeVisible();
      await expect(top.getByText("A", { exact: true })).toBeVisible();
      await expect(top.getByText("J", { exact: true })).toBeVisible();

      // Verify left coord labels (1-10)
      const left = pageA.getByTestId("board-coords-left");
      await expect(left).toBeVisible();
      await expect(left.getByText("1", { exact: true })).toBeVisible();
      await expect(left.getByText("10", { exact: true })).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("player panel shows a pip progress bar", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("surfaces-gamma");
      const userB = generateTestUsername("surfaces-delta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 120_000,
        playerBUsername: userB,
      });

      // Verify pip bar exists and is visible
      await expect(pageA.getByLabel(/Round \d+ of \d+/)).toBeVisible();
      const pips = pageA.getByTestId("round-pip");
      await expect(pips.first()).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("right rail shows the tiles-claimed card", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("surfaces-epsilon");
      const userB = generateTestUsername("surfaces-zeta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 120_000,
        playerBUsername: userB,
      });

      // Verify tiles-claimed card and its sections
      const card = pageA.getByTestId("tiles-claimed-card");
      await expect(card).toBeVisible();
      await expect(card.getByText("Tiles claimed")).toBeVisible();
      await expect(card.getByTestId("tiles-claimed-you")).toBeVisible();
      await expect(card.getByTestId("tiles-claimed-opponent")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
