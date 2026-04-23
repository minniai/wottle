import { test, expect, type Page, type BrowserContext } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Phase 5b profile page smoke runs on chromium only",
);

test.describe("@profile-page Phase 5b profile pages", () => {
  let seedCtx: BrowserContext;
  let seedUsername: string;
  let viewerCtx: BrowserContext;
  let viewerPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Log in one "seed" user so /profile/<seed> renders a real profile.
    seedCtx = await browser.newContext();
    const seedPage = await seedCtx.newPage();
    seedUsername = generateTestUsername("prof-seed");
    await seedPage.goto("/");
    await seedPage.getByTestId("landing-username-input").fill(seedUsername);
    await seedPage.getByTestId("landing-login-submit").click();
    await expect(seedPage).toHaveURL(/\/lobby$/, { timeout: 15_000 });
    await seedPage.close();

    // Log in the "viewer" user reused across the authed tests.
    viewerCtx = await browser.newContext();
    viewerPage = await viewerCtx.newPage();
    const viewerName = generateTestUsername("prof-viewer");
    await viewerPage.goto("/");
    await viewerPage.getByTestId("landing-username-input").fill(viewerName);
    await viewerPage.getByTestId("landing-login-submit").click();
    await expect(viewerPage).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  });

  test.afterAll(async () => {
    await viewerCtx.close();
    await seedCtx.close();
  });

  test("/profile renders own profile for authenticated viewer", async () => {
    await viewerPage.goto("/profile");
    await expect(viewerPage.getByTestId("profile-page")).toBeVisible({
      timeout: 10_000,
    });
    await expect(viewerPage.getByTestId("profile-sidebar")).toBeVisible();
    await expect(viewerPage.getByTestId("profile-rating-chart")).toBeVisible();
    await expect(viewerPage.getByTestId("profile-word-cloud")).toBeVisible();
    await expect(viewerPage.getByTestId("profile-match-history")).toBeVisible();
  });

  test("/profile/[handle] renders a public profile by username", async () => {
    await viewerPage.goto(`/profile/${seedUsername}`);
    await expect(viewerPage.getByTestId("profile-page")).toBeVisible({
      timeout: 10_000,
    });
    // Handle appears inside the sidebar identity line.
    await expect(viewerPage.getByTestId("profile-handle")).toContainText(
      `@${seedUsername}`,
    );
    // And since the viewer is not the seed, the Challenge CTA is rendered.
    await expect(viewerPage.getByTestId("challenge-cta")).toBeVisible();
  });

  test("/profile/ghost renders 'No such player' for unknown handle", async () => {
    await viewerPage.goto("/profile/thisuserdoesnotexist");
    await expect(viewerPage.getByText(/No such player/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("/profile redirects to / when unauthenticated", async ({ browser }) => {
    const anonCtx = await browser.newContext();
    try {
      const anonPage = await anonCtx.newPage();
      await anonPage.goto("/profile");
      // After redirect, URL should be '/' (may be represented with or without trailing slash)
      await expect(anonPage).toHaveURL(/^[^/]+:\/\/[^/]+\/?$/, {
        timeout: 10_000,
      });
      // And the landing hero should be visible as evidence of the redirect
      await expect(anonPage.getByTestId("landing-username-input")).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await anonCtx.close();
    }
  });
});
