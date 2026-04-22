import { test, expect, type BrowserContext, type Page } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

// The lobby's per-card invite flow shares server-side state (presence +
// invite rows) across Playwright projects. Running this in both chromium
// and playtest-firefox in parallel races. Scope to chromium only, matching
// the pattern in matchmaking-phase-4b.spec.ts.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Phase 5a profile modal smoke runs on chromium only — dual-session invite races",
);

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  return { page, username };
}

async function openProfileModal(page: Page, targetUsername: string) {
  const targetCard = page
    .getByTestId("lobby-card")
    .filter({ hasText: `@${targetUsername}` });
  await expect(targetCard).toBeVisible({ timeout: 15_000 });
  await targetCard.getByTestId("lobby-username-btn").click();
  await expect(page.getByTestId("player-profile-modal")).toBeVisible({
    timeout: 10_000,
  });
}

// Log in two players once for all three tests — avoids hitting the 5/min
// auth:login rate limit that would fire if each test created fresh sessions.
test.describe("@profile-modal Phase 5a modal", () => {
  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page;
  let usernameB: string;

  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext();
    ctxB = await browser.newContext();
    const [a, b] = await Promise.all([
      loginAs(ctxA, "prof-a"),
      loginAs(ctxB, "prof-b"),
    ]);
    pageA = a.page;
    usernameB = b.username;
  });

  test.afterAll(async () => {
    await ctxA?.close();
    await ctxB?.close();
  });

  test("clicking a lobby username opens the modal with sparkline + form chips + Challenge CTA", async () => {
    await openProfileModal(pageA, usernameB);
    const modal = pageA.getByTestId("player-profile-modal");
    await expect(modal.getByTestId("profile-sparkline")).toBeVisible();
    await expect(modal.getByTestId("profile-form-chips")).toBeVisible();
    await expect(
      modal.getByRole("button", { name: /Challenge /i }),
    ).toBeVisible();
    // Close the modal so the next test starts clean
    await modal.getByRole("button", { name: /Later/i }).click();
    await expect(pageA.getByTestId("player-profile-modal")).toBeHidden({
      timeout: 5_000,
    });
  });

  test("Later closes the modal without opening the invite flow", async () => {
    await openProfileModal(pageA, usernameB);
    await pageA.getByRole("button", { name: /Later/i }).click();
    await expect(pageA.getByTestId("player-profile-modal")).toBeHidden({
      timeout: 5_000,
    });
    // invite-dialog-confirm should not be present after Later
    await expect(pageA.getByTestId("invite-dialog-confirm")).toBeHidden({
      timeout: 2_000,
    });
  });

  test("Challenge opens the InviteDialog send flow", async () => {
    await openProfileModal(pageA, usernameB);
    await pageA
      .getByTestId("player-profile-modal")
      .getByRole("button", { name: /Challenge /i })
      .click();
    // Profile modal should close
    await expect(pageA.getByTestId("player-profile-modal")).toBeHidden({
      timeout: 5_000,
    });
    // InviteDialog send variant confirms via invite-dialog-confirm
    await expect(pageA.getByTestId("invite-dialog-confirm")).toBeVisible({
      timeout: 5_000,
    });
  });
});
