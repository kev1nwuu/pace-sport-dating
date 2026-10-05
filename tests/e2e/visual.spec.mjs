import { expect, test } from "@playwright/test";
import { completeOnboarding, openApp } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.route("https://images.unsplash.com/**", (route) => route.abort());
  await page.route("https://images.pexels.com/**", (route) => route.abort());
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await openApp(page);
});

test("onboarding welcome remains visually stable", async ({ page }) => {
  await expect(page.locator("#onboarding-root")).toHaveScreenshot("onboarding-welcome.png", {
    animations: "disabled",
  });
});

test("discovery remains visually stable", async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.locator(".app-shell")).toHaveScreenshot("discovery.png", {
    animations: "disabled",
  });
});

test("connection activity remains visually stable", async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Moments" }).click();
  await expect(page.locator(".app-shell")).toHaveScreenshot("connection-activity.png", {
    animations: "disabled",
  });
});

test("connection card remains visually stable", async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveScreenshot("connection-card.png", {
    animations: "disabled",
  });
});

test("conversation remains visually stable", async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.locator(".match-feature-button").click();
  await expect(page.locator(".app-shell")).toHaveScreenshot("conversation.png", {
    animations: "disabled",
  });
});

test("athlete profile remains visually stable", async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveScreenshot("athlete-profile.png", {
    animations: "disabled",
  });
});

test("settings section remains visually stable", async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("tab", { name: /Settings & account/ }).click();
  await expect(page.locator(".app-shell")).toHaveScreenshot("settings-dialog.png", {
    animations: "disabled",
  });
});
