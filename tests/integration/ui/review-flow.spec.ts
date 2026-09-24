/**
 * Spec 071 US3–US5 (T063, T066): review at `?review=n` on the match page. The same field steps
 * through every move in receipt order; the scrubber in the scoreboard's clock row owns the keys;
 * entering review adds one history entry and Back walks review → result → lobby. Anyone may read
 * a finished match, signed out included.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

test.describe.configure({ mode: "serial", retries: 1 });

async function playedAndResigned(browser: Browser): Promise<{ a: Page; b: Page; url: string; close: () => Promise<void> }> {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const userB = generateTestUsername("rv-b");
  await loginViaSlip(a, generateTestUsername("rv-a"));
  await loginViaSlip(b, userB);
  await startMatchWithDirectInvite(a, b, { timeoutMs: 60_000, playerBUsername: userB });
  await submitSwap(a);
  await submitSwap(b);
  await expect(a.getByTestId("scoreboard-row-opp")).toContainText("1 of 10", { timeout: 20_000 });
  await a.getByTestId("ledger-menu-trigger").click();
  await a.getByTestId("ledger-menu-item-resign").click();
  await a.getByTestId("slip-confirm-resign").click();
  await expect(a.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 30_000 });
  await a.waitForTimeout(600);
  return { a, b, url: a.url(), close: async () => void (await Promise.all([contextA.close(), contextB.close()])) };
}

test.describe("@two-player-playtest review", () => {
  test("from the result: the scrubber steps the field; Back walks review, then result, then lobby", async ({ browser }) => {
    const { a, url, close } = await playedAndResigned(browser);
    try {
      await a.getByTestId("slip-review-field").click();
      await expect(a).toHaveURL(/\?review=2$/);
      await expect(a.getByTestId("slip")).toHaveCount(0);
      const scrubber = a.getByRole("slider");
      await expect(scrubber).toHaveAttribute("aria-valuenow", "2");
      await expect(a.getByTestId("scoreboard-clock")).toContainText("step 2 of 2");
      await expect(a.getByTestId("scoreboard-row-you")).toContainText("at step 2");

      await scrubber.focus();
      await a.keyboard.press("Home");
      await expect(a).toHaveURL(/\?review=1$/);
      await expect(scrubber).toHaveAttribute("aria-valuetext", /^step 1 of 2, /);
      await expect(a.getByTestId("ledger-live-row")).toContainText("move 1 ·");
      await a.keyboard.press("ArrowRight");
      await expect(a).toHaveURL(/\?review=2$/);

      // One entry for all of review: Back is the result, with its slip; Back again is the lobby.
      await a.goBack();
      await expect(a).toHaveURL(url);
      await expect(a.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver");
      await a.goBack();
      await expect(a).toHaveURL(/\/en\/?$/, { timeout: 15_000 });
    } finally {
      await close();
    }
  });

  test("old and odd links land on a step: /summary, ?review=abc", async ({ browser }) => {
    const { a, url, close } = await playedAndResigned(browser);
    try {
      await a.goto(`${url}/summary`);
      await expect(a).toHaveURL(/\?review=2$/, { timeout: 15_000 });
      await expect(a.getByRole("slider")).toHaveAttribute("aria-valuenow", "2");
      await a.goto(`${url}?review=abc`);
      await expect(a).toHaveURL(/\?review=2$/, { timeout: 15_000 });
    } finally {
      await close();
    }
  });

  test("a signed-out visitor reads a finished match's review, with no slip and the door as the way on", async ({ browser }) => {
    const { url, close } = await playedAndResigned(browser);
    const visitor = await browser.newContext();
    try {
      const page = await visitor.newPage();
      await page.goto(url);
      await expect(page).toHaveURL(/\?review=2$/, { timeout: 15_000 });
      await expect(page.getByRole("slider")).toBeVisible();
      await expect(page.getByTestId("room")).toContainText("this match is over ·");
      await expect(page.getByTestId("slip")).toHaveCount(0);
      await expect(page.getByTestId("ledger-lobby")).toHaveText("enter the lobby ▸");
    } finally {
      await visitor.close();
      await close();
    }
  });
});
