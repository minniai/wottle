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
 * Direct invite matchmaking - more reliable than queue-based.
 * Player A invites Player B, Player B accepts.
 * This guarantees both players match with each other.
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

  // Wait for both players to see each other in the lobby
  // Pass the specific username so we wait for the correct player (important for parallel tests)
  await waitForPlayersVisible(pageA, pageB, timeoutMs, {
    playerBUsername,
  });

  // Stabilization wait: give presence store time to settle before opening invite modal
  // (Realtime/poller can overwrite briefly; modal reads from same store)
  await safeWait(pageA, 2500);

  // Player A opens invite modal and invites Player B
  // Retry loop to handle modal refresh timing
  const maxRetries = 8;
  let invited = false;
  
  for (let attempt = 1; attempt <= maxRetries && !invited; attempt++) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      throw new Error(`Timeout waiting for invite modal: ${elapsed}ms after ${attempt} attempts`);
    }

    await pageA.getByTestId("matchmaker-invite-button").click();
    
    // Wait for invite modal to appear
    const remainingForModal = Math.max(1000, Math.min(5000, timeoutMs - (Date.now() - startTime)));
    await pageA.getByTestId("matchmaker-invite-modal").waitFor({ 
      state: "visible", 
      timeout: remainingForModal,
    });

    // Find Player B in the invite list and click invite
    if (playerBUsername) {
      // Find the specific player by username (handles parallel test isolation)
      const targetOption = pageA.getByTestId("invite-option").filter({
        hasText: `@${playerBUsername}`,
      });
      
      // Wait for the specific player to appear in the list
      // Use longer timeout since modal content might take a moment to populate
      const remainingTimeForOption = Math.max(1000, Math.min(8000, timeoutMs - (Date.now() - startTime)));
      try {
        await targetOption.waitFor({
          state: "visible",
          timeout: remainingTimeForOption,
        });
        
        await targetOption.getByRole("button", { name: "Invite" }).click();
        invited = true;
      } catch (e) {
        // Player not found in modal, close and retry
        if (attempt < maxRetries) {
          if (!isPageOpen(pageA)) {
            throw new Error(
              "Page was closed during invite modal retry (likely test timeout)"
            );
          }
          // Close modal via button (preferred) or Escape
          const closeBtn = pageA.getByRole("button", { name: "Close invite modal" });
          const closed = await closeBtn.click({ timeout: 2000 }).then(() => true).catch(() => false);
          if (!closed) {
            await pageA.keyboard.press("Escape");
          }
          await pageA.waitForTimeout(2000);
        } else {
          throw e; // Last attempt, re-throw the error
        }
      }
    } else {
      // Fallback: click first option (legacy behavior, may have issues with parallel tests)
      const inviteOptions = pageA.getByTestId("invite-option");
      const count = await inviteOptions.count();
      
      if (count === 0) {
        throw new Error("No players available to invite");
      }

      await inviteOptions.first().getByRole("button", { name: "Invite" }).click();
      invited = true;
    }
  }

  // Wait for Player B to see the incoming invite
  const remainingTime1 = Math.max(5000, Math.min(10000, timeoutMs - (Date.now() - startTime)));
  await pageB.getByTestId("matchmaker-invite-banner").waitFor({ 
    state: "visible", 
    timeout: remainingTime1,
  });

  // Player B accepts the invite
  await pageB.getByTestId("matchmaker-invite-accept").click();

  // Wait for both players to see the match shell
  const remainingTime2 = Math.max(5000, timeoutMs - (Date.now() - startTime));
  const [matchIdA, matchIdB] = await waitForBothPlayersMatched(
    pageA, 
    pageB, 
    Math.max(remainingTime2, 5000)
  );

  return [matchIdA, matchIdB];
}

/**
 * Wait for both players to be visible in each other's lobby view.
 * If specific usernames are provided, wait for those specific players to appear.
 */
async function waitForPlayersVisible(
  pageA: Page,
  pageB: Page,
  timeoutMs: number,
  options?: { playerAUsername?: string; playerBUsername?: string }
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < timeoutMs) {
    if (!isPageOpen(pageA) || !isPageOpen(pageB)) {
      throw new Error("Page was closed while waiting for players to be visible");
    }

    // Check if invite buttons are enabled on both pages
    const inviteButtonA = pageA.getByTestId("matchmaker-invite-button");
    const isEnabledA = await inviteButtonA.isEnabled().catch(() => false);
    
    const inviteButtonB = pageB.getByTestId("matchmaker-invite-button");
    const isEnabledB = await inviteButtonB.isEnabled().catch(() => false);

    if (!isEnabledA || !isEnabledB) {
      await safeWait(pageA, pollInterval);
      continue;
    }

    // If specific usernames are provided, verify they are actually in the lobby list
    if (options?.playerBUsername) {
      // Check if Player B is visible in the lobby list on Page A
      const lobbyListA = pageA.getByTestId("lobby-presence-list");
      const playerBVisibleOnA = await lobbyListA.getByText(`@${options.playerBUsername}`).isVisible().catch(() => false);
      
      if (!playerBVisibleOnA) {
        await safeWait(pageA, pollInterval);
        continue;
      }
    }

    if (options?.playerAUsername) {
      // Check if Player A is visible in the lobby list on Page B
      const lobbyListB = pageB.getByTestId("lobby-presence-list");
      const playerAVisibleOnB = await lobbyListB.getByText(`@${options.playerAUsername}`).isVisible().catch(() => false);
      
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
