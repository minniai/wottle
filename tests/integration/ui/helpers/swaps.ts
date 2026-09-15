import type { Locator, Page } from "@playwright/test";

const MAX_SUBMIT_ATTEMPTS = 5;
const CONFIRM_TIMEOUT_MS = 5_000;
const CONFIRM_POLL_INTERVAL_MS = 200;
const TILE_CLICK_TIMEOUT_MS = 2_000;
const UNLOCK_TIMEOUT_MS = 10_000;
/** The live row is replaced by a notice line while one shows; reads must not wait for it. */
const READ_TIMEOUT_MS = 1_000;

/**
 * Submits a swap on the field by tapping two adjacent free letters, then
 * verifies the server accepted it (live row reads `played ●`, or the round
 * caption advanced). Retries with a fresh pair when the instant first-mover
 * reveal froze or pinned a chosen letter in between (spec 042 / 044).
 */
export async function submitSwap(page: Page): Promise<void> {
  await waitForBoardUnlocked(page);
  const roundLabelBefore = await readRoundLabel(page);

  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt += 1) {
    await page.keyboard.press("Escape");
    const startIndex = ((attempt - 1) * 30) % 100;
    const pair = await findFreeAdjacentPair(page, startIndex);
    if (!pair) throw new Error("No free adjacent letter pair found");
    await clickPair(pair);
    if (await waitForSubmissionConfirmed(page, roundLabelBefore)) return;
  }

  throw new Error(`Swap submission not confirmed after ${MAX_SUBMIT_ATTEMPTS} attempts`);
}

/** First horizontal pair (n, n+1) from `startIndex` (wrapping) whose cells are both `free`. */
async function findFreeAdjacentPair(page: Page, startIndex = 0): Promise<[Locator, Locator] | null> {
  const field = page.getByTestId("field");
  const blocked: boolean[] = await field.evaluate((el) => {
    const states: boolean[] = new Array(100).fill(true);
    el.querySelectorAll("[data-testid='field-cell']").forEach((cell) => {
      const x = Number(cell.getAttribute("data-x"));
      const y = Number(cell.getAttribute("data-y"));
      states[y * 10 + x] = cell.getAttribute("data-state") !== "free";
    });
    return states;
  });

  for (let offset = 0; offset < 100; offset += 1) {
    const n = (startIndex + offset) % 100;
    if (n % 10 === 9) continue;
    if (!blocked[n] && !blocked[n + 1]) {
      const at = (i: number) => field.locator(`[data-testid="field-cell"][data-x="${i % 10}"][data-y="${Math.floor(i / 10)}"]`);
      return [at(n), at(n + 1)];
    }
  }
  return null;
}

async function clickPair([a, b]: [Locator, Locator]): Promise<void> {
  try {
    await a.click({ timeout: TILE_CLICK_TIMEOUT_MS });
    await b.click({ timeout: TILE_CLICK_TIMEOUT_MS });
  } catch {
    // The confirmation poll decides whether a retry is needed.
  }
}

/** Waits until the live row no longer reads `played ●` (the previous round's commit has cleared). */
export async function waitForBoardUnlocked(page: Page): Promise<void> {
  const deadline = Date.now() + UNLOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const live = await page.getByTestId("ledger-live-row").textContent({ timeout: READ_TIMEOUT_MS }).catch(() => null);
    if (!live || !/played/.test(live)) return;
    await page.waitForTimeout(CONFIRM_POLL_INTERVAL_MS);
  }
}

async function waitForSubmissionConfirmed(page: Page, roundLabelBefore: string | null): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const live = await page.getByTestId("ledger-live-row").textContent({ timeout: READ_TIMEOUT_MS }).catch(() => null);
    if (live && /played/.test(live)) return true;
    if (roundLabelBefore) {
      const now = await readRoundLabel(page);
      if (now && now !== roundLabelBefore) return true;
    }
    await page.waitForTimeout(CONFIRM_POLL_INTERVAL_MS);
  }
  return false;
}

async function readRoundLabel(page: Page): Promise<string | null> {
  return page.getByTestId("round-indicator").textContent({ timeout: READ_TIMEOUT_MS }).catch(() => null);
}
