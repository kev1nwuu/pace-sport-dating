import { expect, test } from "@playwright/test";
import { completeOnboarding, openApp } from "./helpers.mjs";

const welcomeTitle = "MEET SOMEONE WHO MOVES LIKE YOU.";

async function logIn(page) {
  await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expectAppReady(page);
}

async function expectAppReady(page) {
  await expect(page.locator("#onboarding-root")).toBeHidden();
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#discover-view")).toBeVisible();
  await expect(page.locator("#discovery-card")).toBeVisible();
}

async function expectReturningLaunch(page) {
  await expect(page.locator(".pace-launch")).toBeVisible();
  await expect(page.getByRole("heading", { name: welcomeTitle })).toBeHidden();
  await expect(page.locator('[data-onboarding-form="login"]')).toBeHidden();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expectAppReady(page);
}

test("a signed-in member reloads through the launch screen directly into discovery", async ({ page }) => {
  await logIn(page);
  await page.reload();
  await expectReturningLaunch(page);
});

test("a new page in the same browser context restores the member session", async ({ page, context }) => {
  await logIn(page);
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto("/");
  await expectReturningLaunch(reopened);
});

test("logout removes the remembered session so reloading requires entry again", async ({ page }) => {
  await logIn(page);
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("tab", { name: "Settings & account" }).click();
  await page.getByRole("button", { name: /Log out/ }).click();
  await expect(page.locator('[data-onboarding-form="login"]')).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: welcomeTitle })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expect(page.locator(".app-shell")).toHaveAttribute("aria-hidden", "true");
});

test("finishing signup remembers the session for the next app opening", async ({ page }) => {
  await openApp(page);
  await completeOnboarding(page);
  await page.reload();
  await expectReturningLaunch(page);
});

test("an unfinished signup cannot restore into the member area", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Create account with email" }).click();
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("pace-test-password");
  await page.getByLabel("Confirm password").fill("pace-test-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("First name")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: welcomeTitle })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
});

// Exercise the production HTTP adapter; only the server responses are mocked.
async function mockSessionServer(page, initialStatus) {
  const server = { sessionStatus: initialStatus, sessionRequests: 0 };
  await page.route("**/", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace('name="pace-data-adapter" content="local"', 'name="pace-data-adapter" content="http"');
    await route.fulfill({ response, body });
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") {
      server.sessionRequests += 1;
      return server.sessionStatus === 200
        ? respond({ authenticated: true })
        : respond({ error: { code: server.sessionStatus === 401 ? "UNAUTHENTICATED" : "UNAVAILABLE" } }, server.sessionStatus);
    }
    if (path === "/discover") return respond({ state: "results", candidates: [{ id: "maya", distanceKm: 9, sportIds: ["running"] }] });
    if (path === "/connections/feed") return respond({ items: [] });
    if (path === "/me/membership") return respond({ tier: "free", status: "free", entitlements: {} });
    return respond({ error: { code: "NOT_FOUND", message: `Unexpected test endpoint: ${path}` } }, 404);
  });
  return server;
}

test("an expired HTTP session returns to welcome without exposing the member area", async ({ page }) => {
  const server = await mockSessionServer(page, 401);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: welcomeTitle })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expect(page.locator(".app-shell")).toHaveAttribute("aria-hidden", "true");
  expect(server.sessionRequests).toBe(1);
});

test("a temporary session failure can retry into discovery without another login", async ({ page }) => {
  const server = await mockSessionServer(page, 503);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LET’S TRY THAT AGAIN." })).toBeVisible();
  await expect(page.getByRole("heading", { name: welcomeTitle })).toBeHidden();
  await expect(page.locator('[data-onboarding-form="login"]')).toBeHidden();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  expect(server.sessionRequests).toBe(1);

  server.sessionStatus = 200;
  await page.locator('[data-action="retry-session"]').click();
  await expectReturningLaunch(page);
  expect(server.sessionRequests).toBe(2);
});
