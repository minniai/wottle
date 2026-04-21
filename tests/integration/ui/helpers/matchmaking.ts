import type { Page } from "@playwright/test";

/**
 * Generates a unique username for test isolation.
 * Max 24 characters to comply with the username validation rules.
 */
export function generateTestUsername(prefix: string): string {
  // Use last 6 digits of timestamp + 4 digit random = 10 chars for uniqueness
  // This allows prefix up to ~13 chars (13 + 1 dash + 10 = 24)
  const shortTimestamp = (Date.now() % 1_000_000).toString().padStart(6, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  // Truncate prefix if needed to fit within 24 char limit
  const maxPrefixLength = 24 - 1 - 6 - 4; // 13 chars
  const truncatedPrefix = prefix.slice(0, maxPrefixLength);
  return `${truncatedPrefix}-${shortTimestamp}${random}`;
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
 * Direct invite matchmaking via the per-card Challenge flow.
 * Player A clicks Challenge on Player B's LobbyCard, confirms the
 * send dialog, and Player B accepts the incoming InviteToast.
 *
 * The `playerBUsername` option is required for parallel-test isolation —
 * the lobby presence list typically contains many other players.
 */
export async function startMatchWithDirectInvite(
  pageA: Page,
  pageB: Page,
  options: {
    timeoutMs?: number;
    playerBUsername?: string;
  } = {}
): Promise<[string | null, string | null]> {
  const { timeoutMs = 30_000, playerBUsername } = options;
  const startTime = Date.now();

  if (!playerBUsername) {
    throw new Error(
      "startMatchWithDirectInvite requires options.playerBUsername — " +
        "the per-card Challenge flow needs a specific target.",
    );
  }

  // Wait for both players' cards to appear in each other's lobby list.
  await waitForPlayersVisible(pageA, pageB, timeoutMs, {
    playerBUsername,
  });

  // Stabilisation wait: presence store churns while realtime sync settles.
  await safeWait(pageA, 1500);

  // Player A: click Challenge on Player B's card, then confirm the dialog.
  const remainingForChallenge = Math.max(5_000, timeoutMs - (Date.now() - startTime));
  const targetCard = pageA
    .getByTestId("lobby-card")
    .filter({ hasText: `@${playerBUsername}` });
  await targetCard.waitFor({ state: "visible", timeout: remainingForChallenge });
  await targetCard.getByRole("button", { name: /Challenge/i }).click();
  await pageA.getByTestId("invite-dialog-confirm").waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await pageA.getByTestId("invite-dialog-confirm").click();

  // Player B: wait for the incoming InviteToast, then click Accept.
  const remainingForToast = Math.max(5_000, timeoutMs - (Date.now() - startTime));
  const toast = pageB.getByTestId("invite-toast");
  await toast.waitFor({ state: "visible", timeout: remainingForToast });
  await toast.getByRole("button", { name: /Accept/i }).click();

  // Both players: wait for the match shell.
  const remainingForMatch = Math.max(5_000, timeoutMs - (Date.now() - startTime));
  const [matchIdA, matchIdB] = await waitForBothPlayersMatched(
    pageA,
    pageB,
    Math.max(remainingForMatch, 5_000),
  );

  return [matchIdA, matchIdB];
}

/**
 * Wait for both players' LobbyCards to appear in each other's lobby
 * presence list. Required before triggering the Challenge flow.
 */
async function waitForPlayersVisible(
  pageA: Page,
  pageB: Page,
  timeoutMs: number,
  options: { playerAUsername?: string; playerBUsername?: string },
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < timeoutMs) {
    if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
      throw new Error("Page was closed while waiting for players to be visible");
    }

    const lobbyListA = pageA.getByTestId("lobby-presence-list");
    const lobbyListB = pageB.getByTestId("lobby-presence-list");

    const lobbyReadyA = await lobbyListA.isVisible().catch(() => false);
    const lobbyReadyB = await lobbyListB.isVisible().catch(() => false);
    if (!lobbyReadyA || !lobbyReadyB) {
      await safeWait(pageA, pollInterval);
      continue;
    }

    if (options.playerBUsername) {
      const playerBVisibleOnA = await lobbyListA
        .getByText(`@${options.playerBUsername}`)
        .isVisible()
        .catch(() => false);
      if (!playerBVisibleOnA) {
        await safeWait(pageA, pollInterval);
        continue;
      }
    }

    if (options.playerAUsername) {
      const playerAVisibleOnB = await lobbyListB
        .getByText(`@${options.playerAUsername}`)
        .isVisible()
        .catch(() => false);
      if (!playerAVisibleOnB) {
        await safeWait(pageA, pollInterval);
        continue;
      }
    }

    return;
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
