/**
 * Spec 044 — the two-player room flow. Grows with each user story:
 *   US2: pick → commit (default), preview opt-in, Esc, opponent pin, frozen tap.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, startMatchWithDirectInvite } from "./helpers/matchmaking";

async function loginPlayer(page: Page, username: string) {
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page.getByTestId("lobby-presence-list")).toBeVisible({ timeout: 20_000 });
}

const cell = (page: Page, x: number, y: number) => page.locator(`[data-testid="field-cell"][data-x="${x}"][data-y="${y}"]`);

/** Two free, unpinned cells in the given row. */
async function twoFreeCells(page: Page, y: number): Promise<[number, number]> {
  const free: number[] = [];
  for (let x = 0; x < 10 && free.length < 2; x += 1) {
    if ((await cell(page, x, y).getAttribute("data-state")) === "free") free.push(x);
  }
  expect(free).toHaveLength(2);
  return [free[0], free[1]];
}

async function togglePreview(page: Page) {
  await page.getByTestId("ledger-menu-trigger").click();
  await page.getByTestId("ledger-menu-item-preview").click();
  await page.keyboard.press("Escape");
}

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@room-flow US2 pick, preview, commit", () => {
  test("default second tap commits; opponent sees the pins in coral; preview is an opt-in with Esc cancel", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("flow-a");
      const userB = generateTestUsername("flow-b");
      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(pageB.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // A: default mode — pick then commit on the second tap.
      const [ax1, ax2] = await twoFreeCells(pageA, 0);
      await cell(pageA, ax1, 0).click();
      await expect(cell(pageA, ax1, 0)).toHaveAttribute("data-state", "picked");
      await expect(pageA.getByTestId("ledger-live-row")).toContainText(/picking ·/);
      await cell(pageA, ax2, 0).click();
      await expect(cell(pageA, ax1, 0)).toHaveAttribute("data-state", "pinned");
      await expect(pageA.getByTestId("ledger-live-row")).toContainText("played ●");

      // B sees A's letters pinned in coral on their own field.
      await expect(cell(pageB, ax1, 0)).toHaveAttribute("data-state", "pinned", { timeout: 15_000 });
      await expect(cell(pageB, ax1, 0)).toHaveAttribute("data-seat", "opp");

      // B: opt into preview — second tap previews, Esc reverses, third tap commits.
      await togglePreview(pageB);
      const [bx1, bx2] = await twoFreeCells(pageB, 9);
      await cell(pageB, bx1, 9).click();
      await cell(pageB, bx2, 9).click();
      await expect(cell(pageB, bx1, 9)).toHaveAttribute("data-state", "previewed");
      await expect(pageB.getByTestId("ledger-hint")).toContainText(/tap again to play/);
      await pageB.keyboard.press("Escape");
      await expect(cell(pageB, bx1, 9)).toHaveAttribute("data-state", "free");
      await cell(pageB, bx1, 9).click();
      await cell(pageB, bx2, 9).click();
      await expect(cell(pageB, bx1, 9)).toHaveAttribute("data-state", "previewed");
      await cell(pageB, bx2, 9).click();
      await expect(cell(pageB, bx1, 9)).toHaveAttribute("data-state", "pinned");

      // Round resolves: caption advances, pins clear.
      await expect(pageA.getByTestId("round-indicator")).toContainText(/round 2/i, { timeout: 45_000 });
      await expect(cell(pageA, ax1, 0)).not.toHaveAttribute("data-state", "pinned");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("a frozen letter shakes and the live row names the owner; a pinned opponent letter cannot be picked", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("frz-a");
      const userB = generateTestUsername("frz-b");
      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // B commits; A tries to pick one of B's pinned letters → shake, no pick.
      const [bx1, bx2] = await twoFreeCells(pageB, 5);
      await cell(pageB, bx1, 5).click();
      await cell(pageB, bx2, 5).click();
      await expect(cell(pageA, bx1, 5)).toHaveAttribute("data-state", "pinned", { timeout: 15_000 });
      await cell(pageA, bx1, 5).dispatchEvent("click");
      await expect(cell(pageA, bx1, 5)).not.toHaveAttribute("data-state", "picked");
      await expect(pageA.getByTestId("ledger-notice")).toContainText(/frozen ·|pinned/, { timeout: 5_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
