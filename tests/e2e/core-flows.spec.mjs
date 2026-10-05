import { expect, test } from "@playwright/test";
import { completeOnboarding, openApp } from "./helpers.mjs";

test("a returning member can open the full login page and enter the app", async ({ page }) => {
  const browserErrors = await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await expect(page.getByRole("heading", { name: "BACK TO YOUR MATCHES." })).toBeVisible();
  await expect(page.locator('[data-onboarding-form="login"]')).toBeVisible();
  await expect(page.locator("#onboarding-progress")).toBeEmpty();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("#onboarding-root")).toBeHidden();
  await expect(page.locator("#discover-view")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass on this profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite to meet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Like this profile" })).toBeVisible();
  await page.getByRole("button", { name: "Meet up", exact: true }).click();
  await expect(page.locator(".train-featured")).toContainText("High Park morning run");
  const tomorrowDay = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return new Intl.DateTimeFormat("en", { day: "numeric" }).format(date);
  });
  await expect(page.locator(".train-featured .train-date b")).toHaveText(tomorrowDay);
  await page.getByRole("button", { name: "PACE home" }).click();
  await expect(page.locator("#discover-view")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("a signed-in member can log out from account settings", async ({ page }) => {
  const browserErrors = await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("tab", { name: "Settings & account" }).click();
  await page.getByRole("button", { name: /Log out/ }).click();

  await expect(page.locator("#onboarding-root")).toBeVisible();
  await expect(page.getByRole("heading", { name: "BACK TO YOUR MATCHES." })).toBeVisible();
  await expect(page.locator('[data-onboarding-form="login"]')).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expect(page.locator(".app-shell")).toHaveAttribute("aria-hidden", "true");
  expect(browserErrors).toEqual([]);
});

test("match thumbnails use a dedicated face-safe crop", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.locator('[data-tab="connect"]').click();

  const avatar = page.locator(".match-feature .mini-photo");
  await expect(avatar).toHaveCSS("background-image", /maya-profile-02\.jpg/);
  await expect(avatar).toHaveCSS("background-position", "50% 24%");
  await expect(page.locator(".app-topbar")).toHaveCSS("visibility", "hidden");
  await expect(page.locator(".app-topbar")).toHaveCSS("display", "flex");
});

test("optional personal details stay private during onboarding", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Create account with email" }).click();
  await page.getByLabel("Email").fill("private@example.com");
  await page.getByLabel("Password", { exact: true }).fill("pace-private-password");
  await page.getByLabel("Confirm password").fill("pace-private-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".onboarding-visibility")).toHaveCount(0);
  await expect(page.getByText("Show height", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Show ethnicity", { exact: true })).toHaveCount(0);
});

test("athletic summary stays within the discovery card on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const layout = await page.locator(".athlete-panel").evaluate((panel) => {
    const sports = panel.querySelector(".sport-list");
    const sportItems = [...sports.children].map((row) => {
      const box = row.getBoundingClientRect();
      const iconBox = row.querySelector(".sport-logo").getBoundingClientRect();
      return { left: Math.round(iconBox.left), top: Math.round(box.top), bottom: Math.round(box.bottom) };
    });
    const panelBox = panel.getBoundingClientRect();
    const sportsBox = sports.getBoundingClientRect();
    return {
      panelScrollWidth: panel.scrollWidth,
      panelClientWidth: panel.clientWidth,
      sportsRight: Math.round(sportsBox.right),
      panelRight: Math.round(panelBox.right),
      panelBottom: Math.round(panelBox.bottom),
      firstSportInset: Math.round(sports.firstElementChild.getBoundingClientRect().left - panelBox.left),
      sportItems,
      backgroundImage: getComputedStyle(panel).backgroundImage,
    };
  });
  expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth);
  expect(layout.sportsRight).toBeLessThanOrEqual(layout.panelRight);
  expect(layout.firstSportInset).toBeGreaterThanOrEqual(8);
  expect(layout.sportItems[0].top).toBe(layout.sportItems[1].top);
  expect(layout.sportItems[1].top).toBe(layout.sportItems[2].top);
  expect(layout.sportItems[0].left).toBeLessThan(layout.sportItems[1].left);
  expect(layout.sportItems[1].left).toBeLessThan(layout.sportItems[2].left);
  expect(layout.sportItems.every((item) => item.bottom <= layout.panelBottom)).toBe(true);
  expect(layout.backgroundImage).toContain("onboarding-charcoal-texture.jpg");

  const viewportLayout = await page.evaluate(() => {
    const athletePanel = document.querySelector(".athlete-panel").getBoundingClientRect();
    const profileMedia = document.querySelector(".profile-media").getBoundingClientRect();
    const profileCard = document.querySelector(".profile-card").getBoundingClientRect();
    const toolbar = document.querySelector(".discovery-toolbar").getBoundingClientRect();
    const filterButton = document.querySelector(".top-filter-button").getBoundingClientRect();
    const filterStrip = document.querySelector(".sport-filter-strip");
    const filterStripBox = filterStrip.getBoundingClientRect();
    const filterPillsFit = [...filterStrip.children].every((pill) => {
      const box = pill.getBoundingClientRect();
      return box.left >= filterStripBox.left && box.right <= filterStripBox.right;
    });
    const tabbar = document.querySelector(".tabbar").getBoundingClientRect();
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      athletePanelBottom: Math.round(athletePanel.bottom),
      athletePanelTop: Math.round(athletePanel.top),
      cardBottom: Math.round(profileCard.bottom),
      cardHeight: Math.round(profileCard.height),
      photoBottom: Math.round(profileMedia.bottom),
      photoHeight: Math.round(profileMedia.height),
      toolbarHeight: Math.round(toolbar.height),
      filterAligned: Math.abs((toolbar.top + toolbar.height / 2) - (filterButton.top + filterButton.height / 2)) < 1,
      filterStripFits: filterStrip.scrollWidth <= filterStrip.clientWidth && filterPillsFit,
      topbarDisplay: getComputedStyle(document.querySelector(".app-topbar")).display,
      tabbarTop: Math.round(tabbar.top),
    };
  });
  expect(viewportLayout.documentHeight).toBeLessThanOrEqual(viewportLayout.viewportHeight);
  expect(viewportLayout.athletePanelBottom).toBeLessThanOrEqual(viewportLayout.tabbarTop);
  expect(Math.abs(viewportLayout.photoHeight - viewportLayout.cardHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(viewportLayout.photoBottom - viewportLayout.cardBottom)).toBeLessThanOrEqual(2);
  expect(viewportLayout.athletePanelTop).toBeLessThan(viewportLayout.photoBottom);
  expect(viewportLayout.photoHeight).toBeGreaterThan(360);
  expect(viewportLayout.toolbarHeight).toBeGreaterThanOrEqual(44);
  expect(viewportLayout.filterAligned).toBe(true);
  expect(viewportLayout.filterStripFits).toBe(true);
  expect(viewportLayout.topbarDisplay).toBe("none");

  const expectedPhotos = ["maya-profile-01.jpg", "maya-profile-02.jpg", "maya-profile-03.jpg", "maya-profile-04.jpg"];
  for (const filename of expectedPhotos) {
    await expect(page.locator("[data-discovery-photo]")).toHaveCSS("background-image", new RegExp(filename));
    await page.locator('[data-action="next-discovery-photo"]').click();
  }
});

test("a new member can finish onboarding and see truthful free membership", async ({ page }) => {
  const browserErrors = await openApp(page);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.locator("#me-title")).toHaveCount(0);
  const profileNavigation = page.locator("nav.profile-section-tabs");
  await expect(profileNavigation.getByRole("tab")).toHaveCount(2);
  await expect(profileNavigation.getByRole("tab", { name: "My profile" })).toHaveClass(/active/);
  await expect(page.locator(".profile-identity-hero")).toContainText("Kevin");
  await expect(page.locator(".profile-overview-card")).toBeVisible();
  await expect(page.locator(".profile-action-list")).toHaveCount(0);
  await expect(page.locator(".profile-settings-shortcut")).toHaveCount(0);

  await page.locator(".profile-avatar-edit").click();
  await expect(page.locator("#edit-profile-view")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await page.getByPlaceholder(/Your ideal weekend/).fill("I enjoy running and tennis and would like to meet someone with a similar lifestyle.");
  await expect(page.locator('[name="heightUnit"]')).toHaveCount(2);
  await expect(page.locator('[name="heightUnit"][value="metric"]')).toBeChecked();
  await expect(page.locator('[name="heightCm"]')).toHaveJSProperty("tagName", "SELECT");
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await expect(page.locator(".profile-height-field").locator('[name="showHeight"]')).toHaveCount(1);
  await expect(page.locator(".personal-detail-control").locator('[name="showEthnicity"]')).toHaveCount(1);
  await expect(page.locator(".profile-editor-visibility")).toHaveCount(0);
  await page.locator('[name="heightCm"]').selectOption("180");
  await page.getByRole("radio", { name: "ft", exact: true }).click();
  await expect(page.locator('[name="heightImperial"]')).toHaveValue("71");
  await expect(page.locator('[name="heightFeet"]')).toHaveCount(0);
  await expect(page.locator('[name="heightInches"]')).toHaveCount(0);
  await page.locator(".height-unit-segments label", { hasText: "cm" }).click();
  await expect(page.locator('[name="heightCm"]')).toHaveValue("180");
  await page.locator('[name="showHeight"]').check();
  await page.getByRole("tab", { name: "View" }).click();
  await expect(page.locator(".profile-editor-preview-card")).toBeVisible();
  await expect(page.locator(".profile-editor-preview-details")).toContainText("180 cm");
  await expect(page.locator(".profile-editor-preview-card")).not.toContainText(/Visible on your discovery card|No personal details are visible/);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("#me-view")).toBeVisible();
  await expect(page.locator("#profile-card-details")).toContainText("180 cm");

  const settingsTrigger = profileNavigation.getByRole("tab", { name: /Settings & account/ });
  await settingsTrigger.click();
  await expect(settingsTrigger).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#profile-overview-panel")).toBeHidden();
  await expect(page.locator("#profile-settings-panel")).toBeVisible();
  await expect(page.locator(".profile-settings-intro .eyebrow")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await page.getByRole("button", { name: /Privacy & sport data/ }).click();
  await expect(page.locator(".settings-data-row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Garmin|Apple Health/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /Billing & subscription/ }).click();
  await expect(page.getByRole("heading", { name: "Your membership" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PACE Free", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage subscription", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "View Plus", exact: true }).click();
  await expect(page.getByRole("button", { name: "Available in the iOS app" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Restore purchases" })).toBeDisabled();
  await expect(page.locator('input[name="plus-plan"]')).toHaveCount(0);
  await expect(page.getByText("Renewal cancelled", { exact: false })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("a connected profile renders every supplied profile photo", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.locator('[data-tab="connect"]').click();
  await page.locator(".match-feature-button").click();
  await page.locator('[data-chat-section="profile"]').click();

  const photos = page.locator("#chat-profile-panel .chat-profile-gallery img");
  await expect(photos).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(photos.nth(index)).toHaveAttribute("src", `assets/maya-profile-0${index + 1}.jpg`);
  }
});

test("a matched-chat training invite is viewport-centered and scrolls inside the dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.locator('[data-tab="connect"]').click();
  await page.locator(".match-feature-button").click();
  await page.locator(".chat-invite-card").click();

  const dialogLayout = await page.locator("#modal").evaluate((dialog) => {
    const box = dialog.getBoundingClientRect();
    const form = dialog.querySelector("#invite-form");
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      viewportHeight: window.innerHeight,
      formScrollHeight: form.scrollHeight,
      formClientHeight: form.clientHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });
  expect(dialogLayout.top).toBeGreaterThanOrEqual(8);
  expect(dialogLayout.bottom).toBeLessThanOrEqual(dialogLayout.viewportHeight - 8);
  expect(dialogLayout.formScrollHeight).toBeGreaterThanOrEqual(dialogLayout.formClientHeight);
  expect(dialogLayout.bodyOverflow).toBe("hidden");
  await expect(page.locator("#invite-form .invite-submit")).toBeVisible();
  await expect(page.locator("#invite-form .invite-submit")).toBeDisabled();
  // Check the rendered label, not just the button's box: inherited flex alignment
  // previously left the label visibly off-centre inside a centred button.
  const centeredLabel = () => page.locator("#invite-form .invite-submit").evaluate((button) => {
    const range = document.createRange();
    range.selectNodeContents(button);
    const text = range.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    const row = button.parentElement.getBoundingClientRect();
    return { labelOffset: Math.abs(text.x + text.width / 2 - box.x - box.width / 2), buttonOffset: Math.abs(box.x + box.width / 2 - row.x - row.width / 2) };
  });
  expect((await centeredLabel()).labelOffset).toBeLessThanOrEqual(1);
  expect((await centeredLabel()).buttonOffset).toBeLessThanOrEqual(1);
  const inviteDate = page.locator('#invite-form [name="date"]');
  const dateValues = await inviteDate.evaluate((input) => ({ minimum: input.min, suggested: input.value }));
  expect(Date.parse(dateValues.suggested)).toBeGreaterThan(Date.parse(dateValues.minimum));
  await page.locator('#invite-form [name="sport"]').fill("Running · Easy 5K");
  await expect(page.locator("#invite-form .invite-submit")).toBeEnabled();
  expect((await centeredLabel()).labelOffset).toBeLessThanOrEqual(1);
  await inviteDate.fill("2020-01-01");
  await expect(page.locator("#invite-form .invite-submit")).toBeDisabled();
});

test("empty notifications use a quiet text-only status surface", async ({ page }) => {
  await openApp(page);
  await completeOnboarding(page);
  await page.locator('[data-tab="me"]').click();
  await expect(page.locator("[data-notification-dot]")).toBeHidden();
  await page.locator('[data-action="open-notifications"]').click();
  const toast = page.locator("#toast");
  await expect(toast).toBeVisible();
  await expect(toast.locator(".toast-icon")).toHaveCount(0);
  await expect(toast.locator(".toast-message")).toHaveText(/No new notifications|暂时没有新通知/);
  await expect(toast).toHaveCSS("border-radius", "999px");
});

test("discovery filters expose a truthful waitlist state", async ({ page }) => {
  const browserErrors = await openApp(page);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Others", exact: true }).click();
  await page.getByRole("button", { name: "Climbing", exact: true }).click();
  await page.getByRole("button", { name: "Apply sport filter" }).click();
  await expect(page.getByRole("heading", { name: "Make room for someone new" })).toBeVisible();
  await expect(page.getByText("Try another sport or widen your distance", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /waitlist/i })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("a member can like, comment on, and publish connection activity", async ({ page }) => {
  const browserErrors = await openApp(page);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Moments" }).click();
  await expect(page.locator(".moment-chat")).toHaveCount(0);
  await page.locator(".moment-avatar").first().click();
  await expect(page.getByRole("tab", { name: "Profile", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#chat-profile-panel")).toBeVisible();
  await expect(page.locator("#chat-profile-panel h2")).toHaveText("Maya · 28");
  await expect(page.locator("#chat-view")).not.toContainText("Matched on PACE");
  await expect(page.locator("#chat-profile-panel img")).toHaveCount(4);
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(page.locator("#chat-conversation-panel")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#moments-view")).toBeVisible();
  await page.locator(".moment-author-profile").nth(1).click();
  await expect(page.locator("#chat-profile-panel h2")).toHaveText("Noah");
  await expect(page.locator("#chat-profile-panel")).not.toContainText("Maya");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const emptyPost = page.locator(".moment-card").nth(2);
  await emptyPost.getByRole("button", { name: /Comments/ }).click();
  await expect(page.getByText("No comments", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close comments" }).click();

  const firstPost = page.locator(".moment-card").first();
  await firstPost.getByRole("button", { name: "Like" }).click();
  await expect(firstPost.getByRole("button", { name: "Unlike" })).toHaveAttribute("aria-pressed", "true");

  await firstPost.getByRole("button", { name: /Comments/ }).click();
  await expect(page.locator(".moment-comments-sheet")).toBeVisible();
  const commentSend = page.locator("#moment-comment-form").getByRole("button", { name: /Send/ });
  await expect(commentSend).toBeDisabled();
  await expect.poll(async () => page.locator(".moment-comments-sheet").evaluate((sheet) => {
    const modal = sheet.closest(".modal").getBoundingClientRect();
    const composer = sheet.querySelector("form").getBoundingClientRect();
    return Math.round(modal.bottom) === window.innerHeight && Math.round(composer.bottom) === window.innerHeight;
  })).toBe(true);
  await page.getByPlaceholder(/Say hello, ask a question/).fill("Easy run tomorrow morning?");
  await expect(commentSend).toBeEnabled();
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByText("Easy run tomorrow morning?")).toBeVisible();
  await expect(page.locator(".comments-sheet-close")).toHaveCount(0);
  const dragHandle = page.getByRole("button", { name: "Close comments" });
  const dragBox = await dragHandle.boundingBox();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2 + 120, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Share a moment" }).click();
  const shareButton = page.getByRole("button", { name: "Share", exact: true });
  await expect(shareButton).toBeDisabled();
  await page.getByPlaceholder("Where did you go, and what made you smile?").fill("Easy run after the rain. Legs felt great.");
  await expect(shareButton).toBeDisabled();
  await page.getByPlaceholder(/Type a sport/).fill("Running");
  await expect(shareButton).toBeEnabled();
  await shareButton.click();
  await expect(page.locator(".moment-card").first()).toContainText("Easy run after the rain. Legs felt great.");
  expect(browserErrors).toEqual([]);
});

test("a mutual like opens a match and the chat remains usable", async ({ page }) => {
  const browserErrors = await openApp(page);
  await completeOnboarding(page);

  const discoveryPhoto = page.locator("[data-discovery-photo]");
  await expect(discoveryPhoto).toHaveAttribute("aria-label", /Photo 1 of 4/);
  await page.getByRole("button", { name: /Next photo/ }).click();
  await expect(discoveryPhoto).toHaveAttribute("aria-label", /Photo 2 of 4/);
  await expect(discoveryPhoto).toHaveCSS("background-image", /maya-profile-02\.jpg/);
  await page.getByRole("button", { name: "Like this profile", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /You matched/i })).toBeVisible();
  await expect(page.locator(".match-maya-card")).toHaveCSS("background-image", /maya-profile-02\.jpg/);
  await expect.poll(async () => page.locator(".match-success-hero").evaluate((hero) => {
    const heroRect = hero.getBoundingClientRect();
    const cardRect = hero.querySelector(".match-maya-card").getBoundingClientRect();
    return {
      centered: Math.abs((heroRect.top + heroRect.height / 2) - (cardRect.top + cardRect.height / 2)) <= 3,
      largeEnough: cardRect.width / heroRect.width >= .45,
    };
  })).toEqual({ centered: true, largeEnough: true });
  await page.getByRole("button", { name: "Start the conversation" }).click();
  await expect(page.locator("#chat-view")).toBeVisible();
  const chatSend = page.getByRole("button", { name: "Send", exact: true });
  await expect(chatSend).toBeDisabled();
  await page.getByPlaceholder("Write a message…").fill("See you this weekend!");
  await expect(chatSend).toBeEnabled();
  await chatSend.click();
  await expect(chatSend).toBeDisabled();
  await expect(page.locator(".chat-thread")).toContainText("See you this weekend!");
  expect(browserErrors).toEqual([]);
});

test("the complete match card opens chat without a separate chat control", async ({ page }) => {
  const browserErrors = await openApp(page);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Chat", exact: true })).toHaveCount(0);
  const matchCard = page.locator(".match-feature-button");
  await expect(matchCard).toBeVisible();
  await expect(matchCard.locator(".match-feature-arrow")).toHaveCount(0);
  await matchCard.click({ position: { x: 12, y: 12 } });
  await expect(page.locator("#chat-view")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
