import { expect, test } from "@playwright/test";
import { completeOnboarding, openApp } from "./helpers.mjs";

async function basicAccessibilityViolations(page) {
  return page.locator("body").evaluate(() => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };
    const referencedText = (element, attribute) => (element.getAttribute(attribute) ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    const accessibleName = (element) => element.getAttribute("aria-label")?.trim()
      || referencedText(element, "aria-labelledby")
      || [...(element.labels ?? [])].map((label) => label.textContent?.trim()).join(" ").trim()
      || element.textContent?.trim()
      || element.getAttribute("title")?.trim()
      || "";
    const violations = [];

    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    duplicateIds.forEach((id) => violations.push(`duplicate id: ${id}`));

    document.querySelectorAll("button, a[href]").forEach((element) => {
      if (isVisible(element) && !accessibleName(element)) violations.push(`unnamed action: ${element.outerHTML.slice(0, 100)}`);
    });
    document.querySelectorAll("input:not([type=hidden]):not([type=button]):not([type=submit]), select, textarea").forEach((element) => {
      if (isVisible(element) && !accessibleName(element)) violations.push(`unlabelled control: ${element.outerHTML.slice(0, 100)}`);
    });
    document.querySelectorAll("img").forEach((image) => {
      if (isVisible(image) && !image.hasAttribute("alt")) violations.push(`image missing alt: ${image.src}`);
    });
    document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
      if (!isVisible(dialog)) return;
      if (dialog.getAttribute("aria-modal") !== "true") violations.push("visible dialog is not modal");
      if (!accessibleName(dialog)) violations.push("visible dialog has no accessible name");
      if (!dialog.contains(document.activeElement)) violations.push("focus is outside visible dialog");
    });
    return violations;
  });
}

test("core onboarding, navigation, and modal states meet baseline accessibility contracts", async ({ page }) => {
  const browserErrors = await openApp(page);
  expect(await basicAccessibilityViolations(page)).toEqual([]);

  await completeOnboarding(page);
  expect(await basicAccessibilityViolations(page)).toEqual([]);

  const nextPhoto = page.getByRole("button", { name: /Next photo/ });
  await nextPhoto.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-discovery-photo]")).toHaveAttribute("aria-label", /Photo 2 of 4/);

  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const matchCard = page.locator(".match-feature-button");
  await matchCard.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#chat-view")).toBeVisible();
  await page.getByRole("button", { name: /Back/ }).click();

  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.locator(".profile-avatar-edit").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#edit-profile-view")).toBeVisible();
  expect(await basicAccessibilityViolations(page)).toEqual([]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#me-view")).toBeVisible();
  await page.getByRole("tab", { name: /Settings & account/ }).click();
  await expect(page.locator("#profile-settings-panel")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await basicAccessibilityViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Moments" }).click();
  await page.getByRole("button", { name: "Share a moment" }).click();
  expect(await basicAccessibilityViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.locator(".moment-card").first().getByRole("button", { name: /Comments/ }).click();
  expect(await basicAccessibilityViolations(page)).toEqual([]);
  await expect(page.getByRole("button", { name: "Close comments" })).toBeVisible();
  await expect(page.locator(".comments-sheet-close")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("core visual assets remain available without third-party network requests", async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173)/, (route) => route.abort());
  const browserErrors = await openApp(page);
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Moments" }).click();

  const fontState = await page.evaluate(async () => {
    await document.fonts.load('500 22px "Material Symbols Rounded"', "chat_bubble");
    await document.fonts.ready;
    return {
      display: document.fonts.check('400 32px "Archivo Black"'),
      body: document.fonts.check('400 16px "Manrope"'),
      mono: document.fonts.check('500 12px "DM Mono"'),
      icons: document.fonts.check('500 22px "Material Symbols Rounded"'),
    };
  });
  expect(fontState).toEqual({ display: true, body: true, mono: true, icons: true });

  await page.locator(".moment-media").last().scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator(".moment-media").evaluateAll((images) => images
    .filter((image) => !image.complete || image.naturalWidth === 0)
    .map((image) => image.alt))).toEqual([]);
  await expect(page.locator(".moment-chat")).toHaveCount(0);
  await page.locator(".moment-avatar").first().click();
  await expect(page.getByRole("tab", { name: "Profile", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".chat-back .material-symbols-rounded")).toHaveCSS("font-family", /Material Symbols Rounded/);
  expect(browserErrors).toEqual([]);
});
