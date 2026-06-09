import type { Locator, Page } from "@playwright/test";

const MAX_SUBMIT_ATTEMPTS = 5;
const CONFIRM_TIMEOUT_MS = 5_000;
const CONFIRM_POLL_INTERVAL_MS = 200;
const TILE_CLICK_TIMEOUT_MS = 2_000;
const UNLOCK_TIMEOUT_MS = 10_000;

/**
 * Submits a swap by clicking two adjacent unfrozen tiles, then verifies the
 * server actually accepted the submission before returning.
 *
 * Verification is required since spec 042 (instant scoring reveal): the first
 * mover's fast-path scoring can freeze tiles and broadcast mid-`collecting`,
 * which means the second player's click pair can silently fail to produce a
 * move_submission in three ways:
 *   1. The server rejects the swap because a clicked tile froze between the
 *      DOM read and server-side validation (FR-014).
 *   2. The US3 auto-deselect clears the first selection when its tile freezes,
 *      so the second click becomes a fresh first selection (FR-004).
 *   3. A click lands during the reveal's FLIP animation window and is ignored.
 *   4. The first mover's revealed swap locks its two tiles on this player's
 *      board (issue #210) and clicks on them are silently ignored — and both
 *      players' helpers deterministically pick the same first free pair, so
 *      this collision is the common case, not the exception.
 *
 * Each failure leaves the round stuck waiting for a second submission, so the
 * helper retries with a freshly-read unfrozen pair until the "Submitted" state
 * appears (or the round indicator advances past the captured value).
 */
export async function submitSwap(page: Page): Promise<void> {
  // The previous round's recap keeps the board locked (and the "Submitted"
  // card visible) for ~1.2s after the round indicator advances. Wait for the
  // unlock so the stale "Submitted" text can't be mistaken for this round's
  // confirmation and clicks aren't silently dropped on the disabled board.
  await waitForBoardUnlocked(page);

  const roundLabelBefore = await readRoundLabel(page);

  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt += 1) {
    // Clear any stray single-tile selection left by a prior attempt.
    await page.keyboard.press("Escape");

    const pair = await findUnfrozenAdjacentPair(page);
    if (!pair) throw new Error("No unfrozen adjacent tile pair found");

    await clickPair(pair);

    if (await waitForSubmissionConfirmed(page, roundLabelBefore)) return;
  }

  throw new Error(
    `Swap submission not confirmed after ${MAX_SUBMIT_ATTEMPTS} attempts`,
  );
}

/**
 * Finds the first horizontal pair (n, n+1) where both tiles are swappable.
 * Reads the whole grid's state in one DOM evaluation per call — tile state
 * can change mid-round via the instant-scoring broadcast, so each retry
 * re-reads it fresh.
 *
 * A tile is unswappable when it is frozen (`data-frozen`) OR locked by the
 * opponent's mid-round revealed swap (`board-grid__cell--opponent-locked`,
 * issue #210) — BoardGrid silently ignores clicks on opponent-locked tiles,
 * and they are NOT marked with `data-frozen`, so checking only the frozen
 * attribute made the helper re-pick the same dead pair forever.
 */
async function findUnfrozenAdjacentPair(
  page: Page,
): Promise<[Locator, Locator] | null> {
  const board = page.getByTestId("board-grid");
  const blocked: boolean[] = await board.evaluate((el) => {
    const states: boolean[] = new Array(100).fill(true);
    el.querySelectorAll("[data-tile-index]").forEach((tile) => {
      const index = Number(tile.getAttribute("data-tile-index"));
      states[index] =
        tile.hasAttribute("data-frozen") ||
        tile.classList.contains("board-grid__cell--opponent-locked");
    });
    return states;
  });

  for (let n = 0; n < 99; n += 1) {
    if (n % 10 === 9) continue;
    if (!blocked[n] && !blocked[n + 1]) {
      return [
        board.locator(`[data-tile-index="${n}"]`),
        board.locator(`[data-tile-index="${n + 1}"]`),
      ];
    }
  }
  return null;
}

/**
 * Clicks both tiles with a short timeout. A tile that froze after the
 * `data-frozen` read becomes aria-disabled (non-actionable to Playwright);
 * swallow the timeout and let the confirmation poll trigger a retry.
 */
async function clickPair([tileA, tileB]: [Locator, Locator]): Promise<void> {
  try {
    await tileA.click({ timeout: TILE_CLICK_TIMEOUT_MS });
    await tileB.click({ timeout: TILE_CLICK_TIMEOUT_MS });
  } catch {
    // Confirmation poll below decides whether a retry is needed.
  }
}

/**
 * Waits for the "Your move" card to leave its "Submitted" state — i.e. for
 * `moveLocked` to clear after the round-recap window, re-enabling the board.
 * Best-effort: if the card never unlocks (or isn't rendered, e.g. narrow
 * viewports), callers' own retries/assertions bound the failure.
 */
export async function waitForBoardUnlocked(page: Page): Promise<void> {
  const deadline = Date.now() + UNLOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const yourMoveText = await page
      .getByTestId("your-move-card")
      .textContent()
      .catch(() => null);
    if (!yourMoveText || !/submitted/i.test(yourMoveText)) return;
    await page.waitForTimeout(CONFIRM_POLL_INTERVAL_MS);
  }
}

async function waitForSubmissionConfirmed(
  page: Page,
  roundLabelBefore: string | null,
): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isSubmissionConfirmed(page, roundLabelBefore)) return true;
    await page.waitForTimeout(CONFIRM_POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * A submission is confirmed when the "Your move" card flips to its
 * "Submitted" state (set only after the move API returns 200 — rejections
 * throw and never lock the board), or when the round indicator has already
 * advanced past the value captured before clicking (the round resolved
 * before we observed the transient "Submitted" window).
 */
async function isSubmissionConfirmed(
  page: Page,
  roundLabelBefore: string | null,
): Promise<boolean> {
  const yourMoveText = await page
    .getByTestId("your-move-card")
    .textContent()
    .catch(() => null);
  if (yourMoveText && /submitted/i.test(yourMoveText)) return true;

  if (roundLabelBefore) {
    const roundLabelNow = await readRoundLabel(page);
    if (roundLabelNow && roundLabelNow !== roundLabelBefore) return true;
  }

  return false;
}

async function readRoundLabel(page: Page): Promise<string | null> {
  return page
    .getByTestId("game-chrome-player")
    .getByTestId("round-indicator")
    .textContent()
    .catch(() => null);
}
