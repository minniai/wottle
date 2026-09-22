import type { Locator, Page } from "@playwright/test";

const MAX_SUBMIT_ATTEMPTS = 5;
const CONFIRM_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 200;
const TILE_CLICK_TIMEOUT_MS = 2_000;
const TURN_TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 1_000;

/**
 * Plays one move on the field (spec 050): waits until the move is the
 * viewer's to make, taps two adjacent free letters, then waits until the
 * bottom bar's lane counts it. A move refused at resolution (`frozen` / `moved` because the
 * opponent's move landed first) is not counted, so the helper picks a fresh
 * pair and tries again.
 */
export async function submitSwap(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt += 1) {
    await waitForYourMove(page);
    const before = await readRail(page);
    await page.keyboard.press("Escape");
    const pair = await findFreeAdjacentPair(page, ((attempt - 1) * 30) % 100);
    if (!pair) throw new Error("No free adjacent letter pair found");
    await clickPair(pair);
    if (await waitForMoveCounted(page, before)) return;
  }
  throw new Error(`Move not counted after ${MAX_SUBMIT_ATTEMPTS} attempts`);
}

/** The field is outlined in the viewer's seat colour exactly while a move is theirs to make. */
export async function waitForYourMove(page: Page): Promise<void> {
  await page.getByTestId("field").and(page.locator('[data-turn="you"]')).waitFor({ timeout: TURN_TIMEOUT_MS });
}

/** The viewer's moves left, from the bottom bar's lane: `7`, then `0` (2026-09-21). */
export async function readRail(page: Page): Promise<string | null> {
  return page.getByTestId("player-bar-bottom").getByTestId("player-bar-lane").getAttribute("aria-valuenow", { timeout: READ_TIMEOUT_MS }).catch(() => null);
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

/** True once the rail moves past `before`; false when the move came back refused or never landed. */
async function waitForMoveCounted(page: Page, before: string | null): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  let sawScoring = false;
  while (Date.now() < deadline) {
    const rail = await readRail(page);
    if (rail && rail !== before) return true;
    const live = await page.getByTestId("ledger-live-row").textContent({ timeout: READ_TIMEOUT_MS }).catch(() => null);
    if (live && /scoring|scored/.test(live)) sawScoring = true;
    // Back to the viewer's move with the rail unchanged after scoring: refused, try again.
    else if (sawScoring && live && /your move/.test(live)) return false;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
  return false;
}
