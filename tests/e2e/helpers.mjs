import { expect } from "@playwright/test";

export async function openApp(page) {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MEET SOMEONE WHO MOVES LIKE YOU." })).toBeVisible();
  return browserErrors;
}

export async function completeOnboarding(page) {
  await page.getByRole("button", { name: "Create account with email" }).click();
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("pace-test-password");
  await page.getByLabel("Confirm password").fill("pace-test-password");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("First name").fill("Alex");
  await page.locator("#onboarding-birthday").fill("1995-05-20");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /An activity partner/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "3–4× / week" }).click();
  await page.getByRole("button", { name: "Weekends" }).click();
  await page.getByRole("button", { name: "Meet people" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator("#onboarding-photo-input").setInputFiles("assets/onboarding-apple-mark.png");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Short bio").fill("Weekend runner looking for good company.");
  await page.getByLabel("An idea for meeting up").fill("Easy 5K and coffee");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.locator(".pace-launch")).toBeVisible();
  await expect(page.getByText("READY TO MOVE.", { exact: true })).toHaveCount(0);

  await expect(page.locator("#onboarding-root")).toBeHidden({ timeout: 4000 });
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#discover-view")).toBeVisible();
}
