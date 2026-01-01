import type { Page } from "@playwright/test";

/**
 * Checks if a page is still open and usable.
 */
function isPageOpen(page: Page): boolean {
  try {
    return !page.isClosed();
  } catch {
    return false;
  }
}

/**
 * Safely waits for a timeout, checking if page is closed.
 */
async function safeWait(page: Page, delayMs: number): Promise<void> {
  if (!isPageOpen(page)) {
    throw new Error("Page was closed during wait");
  }
  await page.waitForTimeout(delayMs);
}

/**
 * Retry helper for matchmaking operations that may have race conditions.
 * Handles timing issues when two players click "Start Game" simultaneously.
 */
export async function retryMatchmaking(
  page: Page,
  action: () => Promise<void>,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<void> {
  const { maxRetries = 5, retryDelayMs = 1000, timeoutMs = 20_000 } = options;
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (!isPageOpen(page)) {
        throw new Error("Page was closed before action");
      }
      await action();
      return; // Success
    } catch (error) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(
          `Matchmaking operation timed out after ${timeoutMs}ms: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (attempt < maxRetries - 1) {
        // Wait before retry, with exponential backoff
        const delay = retryDelayMs * Math.pow(1.5, attempt);
        await safeWait(page, delay);
      } else {
        // Last attempt failed
        throw error;
      }
    }
  }
}

/**
 * Waits for both players to be matched and navigated to the match shell.
 * Handles race conditions by polling until both pages show the match shell.
 */
export async function waitForBothPlayersMatched(
  pageA: Page,
  pageB: Page,
  timeoutMs = 20_000
): Promise<[string | null, string | null]> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < timeoutMs) {
    // Check if pages are still open
    if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
      throw new Error("Page was closed while waiting for match");
    }

    const [matchIdA, matchIdB] = await Promise.all([
      pageA
        .getByTestId("match-shell")
        .getAttribute("data-match-id")
        .catch(() => null),
      pageB
        .getByTestId("match-shell")
        .getAttribute("data-match-id")
        .catch(() => null),
    ]);

    // Check if both are matched
    const shellA = await pageA.getByTestId("match-shell").isVisible().catch(() => false);
    const shellB = await pageB.getByTestId("match-shell").isVisible().catch(() => false);

    if (shellA && shellB && matchIdA && matchIdB && matchIdA === matchIdB) {
      return [matchIdA, matchIdB];
    }

    await safeWait(pageA, pollInterval);
  }

  // Final check
  if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
    throw new Error("Page was closed before final match check");
  }

  const [finalMatchIdA, finalMatchIdB] = await Promise.all([
    pageA
      .getByTestId("match-shell")
      .getAttribute("data-match-id")
      .catch(() => null),
    pageB
      .getByTestId("match-shell")
      .getAttribute("data-match-id")
      .catch(() => null),
  ]);

  return [finalMatchIdA, finalMatchIdB];
}

/**
 * Clicks "Start Game" for both players with retry logic to handle race conditions.
 */
export async function startMatchWithRetry(
  pageA: Page,
  pageB: Page,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<[string | null, string | null]> {
  const { maxRetries = 5, retryDelayMs = 1000, timeoutMs = 30_000 } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if pages are still open
      if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
        throw new Error("Page was closed before starting match");
      }

      // Click both start buttons simultaneously
      await Promise.all([
        pageA.getByTestId("matchmaker-start-button").click(),
        pageB.getByTestId("matchmaker-start-button").click(),
      ]);

      // Wait a moment for queue processing
      await safeWait(pageA, 500);

      // Wait for both to be matched
      const [matchIdA, matchIdB] = await waitForBothPlayersMatched(pageA, pageB, timeoutMs);

      if (matchIdA && matchIdB && matchIdA === matchIdB) {
        return [matchIdA, matchIdB];
      }

      // If not matched yet, wait and retry
      if (attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(1.5, attempt);
        await safeWait(pageA, delay);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      // Check if pages are still open before retrying
      if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
        throw new Error("Page was closed during retry");
      }
      const delay = retryDelayMs * Math.pow(1.5, attempt);
      await safeWait(pageA, delay);
    }
  }

  // Final attempt
  const [finalMatchIdA, finalMatchIdB] = await waitForBothPlayersMatched(pageA, pageB, timeoutMs);
  return [finalMatchIdA, finalMatchIdB];
}
