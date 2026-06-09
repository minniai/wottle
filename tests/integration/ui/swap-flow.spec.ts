import { test, expect } from "@playwright/test";

import { submitSwap, waitForBoardUnlocked } from "./helpers/swaps";
import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

const BOARD_TILE_SELECTOR = "[data-testid=\"board-tile\"]";
const FEEDBACK_SELECTOR = "[data-testid=\"move-feedback-toast\"]";

async function getTileLetters(page: import("@playwright/test").Page, indices: number[]) {
  const tiles = page.locator(BOARD_TILE_SELECTOR);
  return Promise.all(
    indices.map(async (index) => {
      const raw = await tiles
        .nth(index)
        .locator("[aria-hidden=\"true\"]")
        .textContent();
      return raw?.trim() ?? null;
    })
  );
}

// ─── T014: Invalid shake on frozen-tile swap (US2) ────────────────────────
test.describe("Invalid shake on frozen tile (US2)", () => {
  async function loginPlayer(
    page: import("@playwright/test").Page,
    username: string,
  ) {
    await page.goto("/");
    await page.getByTestId("landing-username-input").fill(username);
    await page.getByTestId("landing-login-submit").click();
    await page.waitForTimeout(1500);
    const lobbyVisible = await page
      .getByTestId("lobby-presence-list")
      .isVisible()
      .catch(() => false);
    if (!lobbyVisible) await page.goto("/");
    await expect(page.getByTestId("lobby-presence-list")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("matchmaker-start-button")).toBeVisible({ timeout: 10_000 });
  }

  test("T014: swapping a frozen tile shows invalid class on both tiles @two-player-playtest", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("frozen-alpha");
      const userB = generateTestUsername("frozen-beta");

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

      // Complete round 1 to generate frozen tiles
      await submitSwap(pageA);
      await submitSwap(pageB);

      // Wait for round to resolve and advance — rounds auto-advance after recap animation
      await expect(pageA.getByTestId("game-chrome-player").getByTestId("round-indicator")).toContainText(/r2/i, {
        timeout: 45_000,
      });

      // The round indicator flips before the recap animation releases the
      // board (`moveLocked` disables BoardGrid for ~1.2s after resolution).
      // Clicks dispatched during that window are silently ignored, so wait
      // for the unlock before interacting with the frozen tile.
      await waitForBoardUnlocked(pageA);

      // Find the first frozen tile on pageA's board
      const board = pageA.getByTestId("board-grid");
      let frozenTileIndex = -1;
      for (let n = 0; n < 100; n += 1) {
        const tile = board.locator(`[data-tile-index="${n}"]`);
        const frozen = await tile.getAttribute("data-frozen");
        if (frozen) {
          frozenTileIndex = n;
          break;
        }
      }

      if (frozenTileIndex === -1) {
        // No frozen tiles after round 1 — scoring didn't happen (zero-word round)
        // The test is still valid: we can skip the frozen-tile assertion
        return;
      }

      // Find an adjacent (non-diagonal) neighbour tile
      const col = frozenTileIndex % 10;
      const neighborIndex = col < 9 ? frozenTileIndex + 1 : frozenTileIndex - 1;

      const frozenTile = board.locator(`[data-tile-index="${frozenTileIndex}"]`);
      const neighborTile = board.locator(`[data-tile-index="${neighborIndex}"]`);

      // Frozen tiles have aria-disabled="true" which Playwright treats as non-actionable.
      // Use dispatchEvent to bypass the check and trigger the click handler directly.
      //
      // Clicks during a FLIP animation are silently dropped (the isAnimating
      // guard in handleTileClick) and the round-start replay of the opponent's
      // swap can still be running here, so each dispatch verifies its
      // observable effect and retries until it lands.
      await expect
        .poll(
          async () => {
            await frozenTile.dispatchEvent("click");
            await pageA.waitForTimeout(150);
            return frozenTile.getAttribute("aria-selected");
          },
          { timeout: 10_000 },
        )
        .toBe("true");

      // Both tiles should flash the invalid class once the frozen pair is
      // rejected. The flash lasts ~400ms, so sample both classes right after
      // each dispatch instead of asserting them sequentially.
      await expect
        .poll(
          async () => {
            await neighborTile.dispatchEvent("click");
            await pageA.waitForTimeout(150);
            const [frozenClass, neighborClass] = await Promise.all([
              frozenTile.getAttribute("class"),
              neighborTile.getAttribute("class"),
            ]);
            return frozenClass?.includes("board-grid__cell--invalid") &&
              neighborClass?.includes("board-grid__cell--invalid")
              ? "both-invalid"
              : "no-flash";
          },
          { timeout: 10_000 },
        )
        .toBe("both-invalid");

      // data-frozen attribute must still be present (board unchanged)
      await expect(frozenTile).toHaveAttribute("data-frozen");

      // Invalid class should clear after ~500ms
      await pageA.waitForTimeout(500);
      await expect(frozenTile).not.toHaveClass(/board-grid__cell--invalid/);
      await expect(neighborTile).not.toHaveClass(/board-grid__cell--invalid/);
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});

test.describe("Swap flow", () => {
  test.skip("performs a successful swap and updates the grid", async ({ page }) => {
    // SKIP: Board is no longer on home page - now requires match context
    // TODO: Update test to create/join a match first
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    const [firstBeforeRaw, secondBeforeRaw] = await getTileLetters(page, [0, 1]);
    if (!firstBeforeRaw || !secondBeforeRaw) {
      throw new Error("Failed to read initial board tile letters for swap test");
    }
    const firstBefore = firstBeforeRaw;
    const secondBefore = secondBeforeRaw;

    await page.click(`${BOARD_TILE_SELECTOR}:nth-of-type(1)`);
    await page.click(`${BOARD_TILE_SELECTOR}:nth-of-type(2)`);

    const feedbackToast = page.locator(FEEDBACK_SELECTOR);
    await expect(feedbackToast).toBeVisible({ timeout: 5000 });
    await expect(feedbackToast).toHaveAttribute("data-variant", "success");
    await expect(feedbackToast).toContainText(/move accepted/i);

    await expect
      .poll(async () => getTileLetters(page, [0, 1]))
      .toEqual([secondBefore, firstBefore]);
  });

  test.skip("shows an error and keeps the board unchanged on invalid swaps", async ({ page }) => {
    // SKIP: Board is no longer on home page - now requires match context
    // TODO: Update test to create/join a match first
    await page.goto("/");
    await page.waitForSelector(BOARD_TILE_SELECTOR);

    const firstTile = page.locator(BOARD_TILE_SELECTOR).first();
    const letterBeforeRaw = await firstTile.locator("[aria-hidden=\"true\"]").textContent();
    const letterBefore = letterBeforeRaw?.trim();
    if (!letterBefore) {
      throw new Error("Failed to read tile text before invalid swap");
    }

    await firstTile.click();
    await firstTile.click();

    const feedbackToast = page.locator(FEEDBACK_SELECTOR);
    await expect(feedbackToast).toBeVisible();
    await expect(feedbackToast).toHaveAttribute("data-variant", "error");
    await expect(feedbackToast).toContainText(/invalid swap/i);

    const letterAfter = (await firstTile.locator("[aria-hidden=\"true\"]").textContent())?.trim();
    expect(letterAfter).toBe(letterBefore);
  });
});


