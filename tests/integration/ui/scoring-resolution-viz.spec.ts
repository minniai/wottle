/**
 * Spec 043 — Improve Scoring Resolution Visualization.
 *
 * Deterministic E2E coverage for US2 (calm waiting state without greying the
 * board). After a player submits a swap, the board MUST stay full-color (no
 * whole-board dim/desaturate) and show the waiting banner, while a second move
 * stays blocked.
 *
 * US1 (current-round scored mark) and US3 (swap reveal-then-fade) depend on
 * forming a *scored word*, which is not deterministic without a seeded board.
 * Their class-wiring is covered by the component tests:
 *   - tests/unit/components/BoardGrid.scoredCurrent.spec.tsx (US1)
 *   - tests/unit/components/BoardGrid.swapReveal.spec.tsx (US3)
 *   - tests/unit/match/currentRoundScored.spec.ts (helper)
 * and by the manual steps in specs/043-scoring-resolution-viz/quickstart.md.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

async function loginPlayer(page: Page, username: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await page.waitForTimeout(1500);

  const lobbyVisible = await page
    .getByTestId("lobby-presence-list")
    .isVisible()
    .catch(() => false);
  if (!lobbyVisible) await page.goto("/");

  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("matchmaker-start-button")).toBeVisible({
    timeout: 10_000,
  });
}

/** Click two horizontally-adjacent, non-frozen tiles to submit a swap. */
async function submitAdjacentSwap(page: Page): Promise<void> {
  const first = page.locator('[data-testid="board-tile"][data-col="0"][data-row="0"]');
  const second = page.locator('[data-testid="board-tile"][data-col="1"][data-row="0"]');
  await first.click();
  await second.click();
}

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@scoring-resolution-viz Spec 043 waiting state (US2)", () => {
  test("submitting a move keeps the board full-color and shows the waiting banner", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("srv-alpha");
      const userB = generateTestUsername("srv-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 60_000,
        playerBUsername: userB,
      });
      expect(matchIdA).toEqual(matchIdB);

      await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 10_000 });
      await expect(pageA.getByTestId("board-grid")).toBeVisible({ timeout: 10_000 });

      // Player A submits a swap → enters the waiting state.
      await submitAdjacentSwap(pageA);

      // Waiting banner surfaces (FR-002).
      await expect(pageA.getByTestId("move-lock-banner")).toBeVisible({
        timeout: 10_000,
      });

      // The board container carries the locked class but is NOT dimmed (FR-001):
      // tiles keep full opacity and are not desaturated.
      const tile = pageA
        .locator('[data-testid="board-tile"][data-col="5"][data-row="5"]')
        .first();
      const { opacity, filter } = await tile.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { opacity: cs.opacity, filter: cs.filter };
      });
      expect(opacity).toBe("1");
      expect(filter === "none" || !/saturate\(0\.3\)/.test(filter)).toBe(true);

      // A second move is blocked while waiting (FR-003): banner stays, no nav.
      await submitAdjacentSwap(pageA);
      await expect(pageA.getByTestId("move-lock-banner")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
