/**
 * Spec 071 US2 and US6 (T043): one rematch request per match, 30s, both players still on the
 * result. A request that arrives with the slip lifted is the ledger's first line and never raises
 * the slip; accepting replaces the result with the new table. A decline ends it for both and
 * starts the pair's cooldown; crossed presses start one match.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { waitForYourMove } from "./helpers/swaps";

test.describe.configure({ mode: "serial", retries: 1 });

/** The result slip's actions ignore their first 500ms (spec 071 FR-002). */
const PAST_GUARD_MS = 600;

async function finishedMatch(browser: Browser): Promise<{ a: Page; b: Page; close: () => Promise<void> }> {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const userB = generateTestUsername("rm-b");
  await loginViaSlip(a, generateTestUsername("rm-a"));
  await loginViaSlip(b, userB);
  await startMatchWithDirectInvite(a, b, { timeoutMs: 60_000, playerBUsername: userB });
  await waitForYourMove(a);
  await a.getByTestId("ledger-menu-trigger").click();
  await a.getByTestId("ledger-menu-item-resign").click();
  await a.getByTestId("slip-confirm-resign").click();
  for (const p of [a, b]) await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 30_000 });
  // Both tabs must have told the server they are on the match (the offer needs both).
  for (const p of [a, b]) await expect(p.getByTestId("slip-rematch")).toBeVisible({ timeout: 20_000 });
  await a.waitForTimeout(PAST_GUARD_MS);
  return { a, b, close: async () => void (await Promise.all([contextA.close(), contextB.close()])) };
}

test.describe("@two-player-playtest rematch", () => {
  test("a request with the slip lifted is the ledger's line; accepting replaces the result with the new table", async ({ browser }) => {
    const { a, b, close } = await finishedMatch(browser);
    try {
      await a.keyboard.press("Escape");
      await expect(a.getByTestId("slip")).toHaveCount(0);
      const finished = a.url();

      await b.getByTestId("slip-rematch").click();
      await expect(b.getByTestId("slip-rematch-line")).toHaveText(/rematch sent · 0:\d\d/, { timeout: 5_000 });
      // SC-004: within two seconds it is A's first ledger line, and the slip stays down.
      await expect(a.getByTestId("ledger-rematch-accept")).toBeVisible({ timeout: 2_000 });
      await expect(a.getByTestId("slip")).toHaveCount(0);
      await expect(a).toHaveTitle(/^\(1\) .+ asks for a rematch · Wottle$/);

      await a.getByTestId("ledger-rematch-accept").click();
      for (const p of [a, b]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]+$/, { timeout: 15_000 });
      await expect(a).not.toHaveURL(finished);
      // T40: the new table replaced the result, so Back goes where the result would have.
      await expect(a.getByTestId("scoreboard-clock")).toContainText(/match 2 · .+ 1–0|starts when both sit/, { timeout: 15_000 });
    } finally {
      await close();
    }
  });

  test("a decline ends the rematch for both and starts the pair's cooldown", async ({ browser }) => {
    const { a, b, close } = await finishedMatch(browser);
    try {
      await b.getByTestId("slip-rematch").click();
      await expect(a.getByTestId("slip-accept-rematch")).toBeVisible({ timeout: 5_000 });
      await a.waitForTimeout(PAST_GUARD_MS);
      await a.getByTestId("slip-decline-rematch").click();
      // The sender reads who declined; rematch ▸ is gone for both; challenge again waits out 60s.
      await expect(b.getByTestId("slip-rematch-line")).toHaveText(/declined/, { timeout: 5_000 });
      for (const p of [a, b]) await expect(p.getByTestId("slip-rematch")).toHaveCount(0);
      await expect(b.getByTestId("slip-new-opponent")).toHaveClass(/action-primary/);
      await expect(b.getByTestId("slip-challenge-again")).toHaveText(/again in 0:[0-5]\d/);
      await expect(b.getByTestId("slip-challenge-again")).toBeDisabled();
    } finally {
      await close();
    }
  });

  test("crossed presses start one match, both at its table", async ({ browser }) => {
    const { a, b, close } = await finishedMatch(browser);
    try {
      await Promise.all([a.getByTestId("slip-rematch").click(), b.getByTestId("slip-rematch").click()]);
      for (const p of [a, b]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]+$/, { timeout: 15_000 });
      await expect.poll(() => a.url(), { timeout: 15_000 }).toBe(b.url());
    } finally {
      await close();
    }
  });

  test("an unanswered request runs out after 30s for both", async ({ browser }) => {
    test.setTimeout(120_000);
    const { a, b, close } = await finishedMatch(browser);
    try {
      await b.getByTestId("slip-rematch").click();
      await expect(a.getByTestId("slip-accept-rematch")).toBeVisible({ timeout: 5_000 });
      for (const p of [a, b]) await expect(p.getByTestId("slip-rematch-line")).toHaveText("no answer", { timeout: 40_000 });
    } finally {
      await close();
    }
  });
});
