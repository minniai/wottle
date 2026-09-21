/**
 * Spec 050 US3 — the shared clock decides. With a short clock
 * (`PLAYTEST_MATCH_CLOCK_MS`, read by the server) A plays one move and B none;
 * at 0:00 both are short of ten, so the match is a draw that says
 * `neither finished`, rated like any other.
 *
 * The server must be started with the same variable, so the spec skips unless
 * this process has it too:
 *   PLAYTEST_MATCH_CLOCK_MS=20000 pnpm exec playwright test tests/integration/ui/deadline-flow.spec.ts
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

const CLOCK_MS = Number(process.env.PLAYTEST_MATCH_CLOCK_MS ?? 0);

test.skip(!CLOCK_MS || CLOCK_MS > 60_000, "needs a short PLAYTEST_MATCH_CLOCK_MS on the server and here");

test("at 0:00 both short of ten is a draw: neither finished", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const userB = generateTestUsername("dl-b");
    await loginViaSlip(pageA, generateTestUsername("dl-a"));
    await loginViaSlip(pageB, userB);
    await startMatchWithDirectInvite(pageA, pageB, { playerBUsername: userB, timeoutMs: 60_000 });
    await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

    await submitSwap(pageA);

    for (const p of [pageA, pageB]) {
      await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: CLOCK_MS + 30_000 });
      await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 20_000 });
      await expect(p.getByTestId("verdict")).toContainText("neither finished");
    }
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
