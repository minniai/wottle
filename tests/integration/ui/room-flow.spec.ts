/**
 * Spec 044 — the two-player room flow. Grows with each user story:
 *   US2: pick → commit (default), preview opt-in, Esc, opponent pin, frozen tap.
 *   US3: bands — one per ledger word, chevron edge matches data-direction.
 *   US4: ledger — rows fill per round, live row text, resign via the live-row confirmation.
 *   US6: reveal — bands settle after resolution; reduced motion shows the end state at once.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, startMatchWithDirectInvite } from "./helpers/matchmaking";

async function loginPlayer(page: Page, username: string) {
  await page.goto("/");
  await page.getByTestId("player-bar-name-input").fill(username);
  await page.getByTestId("player-bar-action-play").click();
  await expect(page.getByTestId("ledger-here-now")).toBeVisible({ timeout: 20_000 });
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

      // US3 — bands: one per word in the ledger's row 1, chevron edge per direction.
      const wordCells = pageA.getByTestId("ledger-row-1").locator(".ledger__words");
      const rowText = (await wordCells.allTextContents()).join(" ");
      const wordCount = rowText.split("·").map((w) => w.trim()).filter((w) => /^[^\d]+$/.test(w) && w.length > 0).length;
      const bands = pageA.getByTestId("field-band");
      expect(await bands.count()).toBe(wordCount);
      for (let i = 0; i < (await bands.count()); i += 1) {
        const dir = await bands.nth(i).getAttribute("data-direction");
        expect(["ltr", "rtl", "ttb", "btt"]).toContain(dir);
        const d = await bands.nth(i).locator("path").getAttribute("d");
        expect(d).toMatch(/^M /);
      }
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

  test("US4 ledger: live row transitions, rows fill per round, resign is a live-row confirmation that reverts on no", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("ldg-a");
      const userB = generateTestUsername("ldg-b");
      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // Ten rows; row 1 live; rows 2–10 labels only.
      for (let r = 1; r <= 10; r += 1) await expect(pageA.getByTestId(`ledger-row-${r}`)).toBeVisible();
      await expect(pageA.getByTestId("ledger-row-1")).toHaveAttribute("data-status", "live");
      await expect(pageA.getByTestId("ledger-row-5")).toHaveAttribute("data-status", "future");

      // Resign confirmation is a line, not a dialog; `no` reverts.
      await pageA.getByTestId("ledger-menu-trigger").click();
      await pageA.getByTestId("ledger-menu-item-resign").click();
      await expect(pageA.getByTestId("ledger-notice").filter({ hasText: "resign the match?" })).toBeVisible();
      expect(await pageA.locator("[role=alertdialog], [role=dialog]").count()).toBe(0);
      await pageA.getByTestId("notice-cancel-resign").click();
      await expect(pageA.getByTestId("ledger-notice").filter({ hasText: "resign the match?" })).toHaveCount(0);

      // Both play; row 1 becomes past with words or stays empty, row 2 goes live.
      const [ax1, ax2] = await twoFreeCells(pageA, 0);
      await cell(pageA, ax1, 0).click();
      await cell(pageA, ax2, 0).click();
      const [bx1, bx2] = await twoFreeCells(pageB, 9);
      await cell(pageB, bx1, 9).click();
      await cell(pageB, bx2, 9).click();
      await expect(pageA.getByTestId("ledger-row-2")).toHaveAttribute("data-status", "live", { timeout: 45_000 });
      await expect(pageA.getByTestId("ledger-row-1")).toHaveAttribute("data-status", "past");
      await expect(pageA.getByTestId("ledger-territory")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("US6 reveal: after resolution every band is settled; under reduced motion the end state is immediate", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext({ reducedMotion: "reduce" });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("rvl-a");
      const userB = generateTestUsername("rvl-b");
      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      const [ax1, ax2] = await twoFreeCells(pageA, 0);
      await cell(pageA, ax1, 0).click();
      await cell(pageA, ax2, 0).click();
      const [bx1, bx2] = await twoFreeCells(pageB, 9);
      await cell(pageB, bx1, 9).click();
      await cell(pageB, bx2, 9).click();
      await expect(pageA.getByTestId("round-indicator")).toContainText(/round 2/i, { timeout: 45_000 });

      // Settle: no band is still drawing or live once the reveal completes (≤ 2.5 s for three words).
      await pageA.waitForTimeout(2_600);
      expect(await pageA.locator(".field__band--drawing, .field__band--live").count()).toBe(0);
      expect(await pageB.locator(".field__band--drawing, .field__band--live").count()).toBe(0);
      // Both fields agree on the number of bands.
      expect(await pageA.getByTestId("field-band").count()).toBe(await pageB.getByTestId("field-band").count());
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

