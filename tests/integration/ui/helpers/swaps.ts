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

    // Scan from a different row each attempt: when the freeze broadcast is
    // delayed (safety poll cadence is 2s), the client's `data-frozen` can be
    // stale, so re-picking the same pair would repeat the same rejection.
    const startIndex = ((attempt - 1) * 30) % 100;
    const pair = await findUnfrozenAdjacentPair(page, startIndex);
    if (!pair) throw new Error("No unfrozen adjacent tile pair found");

    await clickPair(pair);

    if (await waitForSubmissionConfirmed(page, roundLabelBefore)) return;
  }

  throw new Error(
    `Swap submission not confirmed after ${MAX_SUBMIT_ATTEMPTS} attempts`,
  );
}

/**
 * Finds the first horizontal pair (n, n+1) — scanning from `startIndex` with
 * wraparound — where neither tile is frozen. Re-reads `data-frozen` on every
 * call: frozen state can change mid-round via the instant-scoring broadcast.
 */
async function findUnfrozenAdjacentPair(
  page: Page,
  startIndex = 0,
): Promise<[Locator, Locator] | null> {
  const board = page.getByTestId("board-grid");
  for (let offset = 0; offset < 100; offset += 1) {
    const n = (startIndex + offset) % 100;
    if (n % 10 === 9) continue;
    const tileA = board.locator(`[data-tile-index="${n}"]`);
    const tileB = board.locator(`[data-tile-index="${n + 1}"]`);
    const frozenA = await tileA.getAttribute("data-frozen");
    const frozenB = await tileB.getAttribute("data-frozen");
    if (!frozenA && !frozenB) {
      return [tileA, tileB];
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
 * Waits for the "Your move" card to leave its "Submitted" state. Best-effort:
 * if the card never unlocks (or isn't rendered, e.g. narrow viewports), the
 * retry loop's confirmation polling still bounds the failure.
 */
async function waitForBoardUnlocked(page: Page): Promise<void> {
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
