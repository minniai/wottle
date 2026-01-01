import type { Page } from "@playwright/test";

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
        await page.waitForTimeout(delay);
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

    await pageA.waitForTimeout(pollInterval);
  }

  // Final check
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
  const { maxRetries = 5, retryDelayMs = 1000, timeoutMs = 20_000 } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Click both start buttons simultaneously
      await Promise.all([
        pageA.getByTestId("matchmaker-start-button").click(),
        pageB.getByTestId("matchmaker-start-button").click(),
      ]);

      // Wait a moment for queue processing
      await pageA.waitForTimeout(500);

      // Wait for both to be matched
      const [matchIdA, matchIdB] = await waitForBothPlayersMatched(pageA, pageB, timeoutMs);

      if (matchIdA && matchIdB && matchIdA === matchIdB) {
        return [matchIdA, matchIdB];
      }

      // If not matched yet, wait and retry
      if (attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(1.5, attempt);
        await pageA.waitForTimeout(delay);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      const delay = retryDelayMs * Math.pow(1.5, attempt);
      await pageA.waitForTimeout(delay);
    }
  }

  // Final attempt
  const [finalMatchIdA, finalMatchIdB] = await waitForBothPlayersMatched(pageA, pageB, timeoutMs);
  return [finalMatchIdA, finalMatchIdB];
}
