import type { Page } from "@playwright/test";

/**
 * Generates a unique username for test isolation.
 */
export function generateTestUsername(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Checks if a page is still open and usable.
 */
export function isPageOpen(page: Page): boolean {
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
 * Direct invite matchmaking - more reliable than queue-based.
 * Player A invites Player B, Player B accepts.
 * This guarantees both players match with each other.
 */
export async function startMatchWithDirectInvite(
  pageA: Page,
  pageB: Page,
  options: {
    timeoutMs?: number;
  } = {}
): Promise<[string | null, string | null]> {
  const { timeoutMs = 30_000 } = options;
  const startTime = Date.now();

  // Wait for both players to see each other in the lobby
  await waitForPlayersVisible(pageA, pageB, timeoutMs);

  // Player A opens invite modal and invites Player B
  const elapsed1 = Date.now() - startTime;
  if (elapsed1 > timeoutMs) {
    throw new Error(`Timeout waiting for players to be visible: ${elapsed1}ms`);
  }

  await pageA.getByTestId("matchmaker-invite-button").click();
  
  // Wait for invite modal to appear
  await pageA.getByTestId("matchmaker-invite-modal").waitFor({ 
    state: "visible", 
    timeout: Math.min(5000, timeoutMs - (Date.now() - startTime)) 
  });

  // Find Player B in the invite list and click invite
  // We need to find the correct player - look for one that's NOT player A
  const inviteOptions = pageA.getByTestId("invite-option");
  const count = await inviteOptions.count();
  
  if (count === 0) {
    throw new Error("No players available to invite");
  }

  // Click the first invite option (should be Player B)
  await inviteOptions.first().getByRole("button", { name: "Invite" }).click();

  // Wait for Player B to see the incoming invite
  const remainingTime1 = timeoutMs - (Date.now() - startTime);
  await pageB.getByTestId("matchmaker-invite-banner").waitFor({ 
    state: "visible", 
    timeout: Math.min(10000, remainingTime1) 
  });

  // Player B accepts the invite
  await pageB.getByTestId("matchmaker-invite-accept").click();

  // Wait for both players to see the match shell
  const remainingTime2 = timeoutMs - (Date.now() - startTime);
  const [matchIdA, matchIdB] = await waitForBothPlayersMatched(
    pageA, 
    pageB, 
    Math.max(remainingTime2, 5000)
  );

  return [matchIdA, matchIdB];
}

/**
 * Wait for both players to be visible in each other's lobby view.
 */
async function waitForPlayersVisible(
  pageA: Page,
  pageB: Page,
  timeoutMs: number
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < timeoutMs) {
    if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
      throw new Error("Page was closed while waiting for players to be visible");
    }

    // Check if invite button is enabled on page A (indicates players are visible)
    const inviteButtonA = pageA.getByTestId("matchmaker-invite-button");
    const isEnabledA = await inviteButtonA.isEnabled().catch(() => false);
    
    const inviteButtonB = pageB.getByTestId("matchmaker-invite-button");
    const isEnabledB = await inviteButtonB.isEnabled().catch(() => false);

    if (isEnabledA && isEnabledB) {
      return;
    }

    await safeWait(pageA, pollInterval);
  }

  throw new Error(`Timeout waiting for players to be visible after ${timeoutMs}ms`);
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
 * Queue-based matchmaking with retry logic.
 * Less reliable than direct invite, but kept for compatibility.
 * @deprecated Use startMatchWithDirectInvite for more reliable tests
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
  const { maxRetries = 3, retryDelayMs = 1000, timeoutMs = 15_000 } = options;
  const startTime = Date.now();
  const overallTimeout = 60_000; // Don't retry for more than 60s total

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if we're approaching overall timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > overallTimeout) {
        throw new Error(
          `Matchmaking exceeded overall timeout of ${overallTimeout}ms after ${attempt} attempts`
        );
      }

      // Check if pages are still open
      if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
        throw new Error("Page was closed before starting match (likely due to test timeout)");
      }

      // Click both start buttons simultaneously
      await Promise.all([
        pageA.getByTestId("matchmaker-start-button").click().catch((e) => {
          if (!isPageOpen(pageA)) {
            throw new Error("Page A was closed during button click");
          }
          throw e;
        }),
        pageB.getByTestId("matchmaker-start-button").click().catch((e) => {
          if (!isPageOpen(pageB)) {
            throw new Error("Page B was closed during button click");
          }
          throw e;
        }),
      ]);

      // Wait a moment for queue processing
      await safeWait(pageA, 500);

      // Wait for both to be matched (with reduced timeout per attempt)
      const remainingTime = Math.min(timeoutMs, overallTimeout - (Date.now() - startTime));
      if (remainingTime < 1000) {
        throw new Error("Not enough time remaining for matchmaking");
      }

      const [matchIdA, matchIdB] = await waitForBothPlayersMatched(pageA, pageB, remainingTime);

      if (matchIdA && matchIdB && matchIdA === matchIdB) {
        return [matchIdA, matchIdB];
      }

      // If not matched yet, wait and retry
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          retryDelayMs * Math.pow(1.5, attempt),
          overallTimeout - (Date.now() - startTime) - 2000 // Leave 2s buffer
        );
        if (delay > 0) {
          await safeWait(pageA, delay);
        }
      }
    } catch (error) {
      // If pages are closed, it's likely due to test timeout - provide helpful error
      if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
        const elapsed = Date.now() - startTime;
        throw new Error(
          `Pages were closed during matchmaking (likely test timeout). Elapsed: ${elapsed}ms, Attempt: ${attempt + 1}/${maxRetries}. Original error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Check remaining time before retrying
      const elapsed = Date.now() - startTime;
      const remainingTime = overallTimeout - elapsed;
      if (remainingTime < 2000) {
        throw new Error(
          `Not enough time for retry. Elapsed: ${elapsed}ms, Remaining: ${remainingTime}ms`
        );
      }

      const delay = Math.min(
        retryDelayMs * Math.pow(1.5, attempt),
        remainingTime - 1000 // Leave 1s buffer
      );
      if (delay > 0) {
        await safeWait(pageA, delay);
      }
    }
  }

  // Final attempt with remaining time
  const remainingTime = Math.min(timeoutMs, overallTimeout - (Date.now() - startTime));
  if (remainingTime < 1000) {
    throw new Error("Not enough time for final matchmaking attempt");
  }

  const [finalMatchIdA, finalMatchIdB] = await waitForBothPlayersMatched(
    pageA,
    pageB,
    remainingTime
  );
  return [finalMatchIdA, finalMatchIdB];
}
