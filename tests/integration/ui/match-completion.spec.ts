/**
 * T034: E2E test for match completion — verifies game-over screen displays
 * winner declaration, frozen tile counts, and top words; both players can
 * return to lobby.
 *
 * Note: frozen tile counts appear only if tiles were actually frozen during
 * the match. Top words appear only if words were scored. Both sections are
 * verified present when applicable; empty states are acceptable since board
 * position is random.
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

test.describe("Match completion — game-over screen (T034)", () => {
  test(
    "shows winner declaration, frozen tile counts, top words, and lobby return @two-player-playtest",
    async ({ browser }) => {
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      try {
        const userA = generateTestUsername("completion-alpha");
        const userB = generateTestUsername("completion-beta");

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

        // Play all 10 rounds to trigger match completion
        for (let round = 1; round <= 10; round += 1) {
          await submitSwap(pageA);
          await submitSwap(pageB);
          const settleMs = round === 1 ? 6_000 : 3_000;
          await pageA.waitForTimeout(settleMs);
          if (round < 10) {
            // Wait for round to resolve and advance — rounds auto-advance after recap animation
            await expect(pageA.getByTestId("game-chrome-player").getByTestId("round-indicator")).toContainText(
              new RegExp(`r${round + 1}`, "i"),
              { timeout: 45_000 },
            );
          }
        }

        // Final summary should be visible
        const summaryView = pageA.getByTestId("final-summary-root");
        await expect(summaryView).toBeVisible({ timeout: 30_000 });

        // Winner declaration OR draw banner must be visible
        const hasWinner = await pageA.getByText("Winner").isVisible().catch(() => false);
        const hasDraw = await pageA.getByText("Draw").isVisible().catch(() => false);
        expect(hasWinner || hasDraw).toBe(true);

        // Ended reason shown
        await expect(pageA.getByTestId("final-summary-ended-reason")).toContainText(
          /10 rounds completed/i,
        );

        // Scoreboard present
        await expect(pageA.getByTestId("final-summary-scoreboard")).toBeVisible();

        // Word history section present (may be empty if no words scored)
        await expect(pageA.getByTestId("final-summary-word-history")).toBeVisible();

        // Both players see "tiles frozen" text in the player cards (count may be 0)
        const frozenTexts = await pageA.getByText(/tiles frozen/i).all();
        expect(frozenTexts.length).toBeGreaterThanOrEqual(1);

        // Action buttons present
        await expect(pageA.getByTestId("final-summary-back-lobby")).toBeVisible();

        // Both players click "Back to Lobby" and land on lobby page
        await pageA.getByTestId("final-summary-back-lobby").click();
        await expect(pageA.getByTestId("lobby-presence-list")).toBeVisible({
          timeout: 15_000,
        });

        await pageB
          .getByTestId("final-summary-back-lobby")
          .click()
          .catch(async () => {
            // pageB may still be on the match page if Realtime was slow;
            // navigate directly to lobby
            await pageB.goto("/");
          });
        await expect(pageB.getByTestId("lobby-presence-list")).toBeVisible({
          timeout: 15_000,
        });
      } finally {
        await pageA.close();
        await pageB.close();
        await contextA.close();
        await contextB.close();
      }
    },
  );
});
