import { expect, test } from "@playwright/test";
import { createEngagementService, createEngagementStore } from "../../engagement_service.mjs";
import { openApp } from "./helpers.mjs";

async function signIn(page) {
  const errors = await openApp(page);
  await page.getByRole("button", { name: /Already moving with us/ }).click();
  await page.getByLabel("Email").fill("member@example.com");
  await page.getByLabel("Password").fill("pace-member-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("#discover-view")).toBeVisible();
  await expect(page.locator("#onboarding-root")).toBeHidden();
  return errors;
}

async function futureLocalTime(page) {
  return page.evaluate(() => {
    const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
}

async function fillDirectInvite(page) {
  const form = page.locator("#direct-invite-form");
  await expect(form).toBeVisible();
  await form.getByLabel("Sport", { exact: true }).selectOption("running");
  await form.getByLabel("Date & time").fill(await futureLocalTime(page));
  await form.getByLabel("Meeting place").fill("High Park main entrance");
  await form.getByLabel("A short note (optional)").fill("Easy 5K and coffee afterwards?");
  return form;
}

// The browser uses the real HTTP adapter. Only the server transport is supplied
// by this fixture, backed by the same trusted policy service as the backend seam.
async function httpFixture(page, { plus = true } = {}) {
  const actor = { id: "user_kevin", name: "Kevin", verified: true };
  const host = { id: "host_alex", name: "Alex", verified: true };
  const membership = { tier: "plus", status: "active", source: "apple", expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), autoRenews: true };
  const store = createEngagementStore({
    users: [actor, host, { id: "maya", name: "Maya", verified: true }],
    memberships: plus ? { [actor.id]: membership } : {},
    activities: [{
      id: "fixture-run", title: "An easy morning loop", sportId: "running",
      startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      location: "High Park main entrance", distanceKm: 5, pace: "Easy pace",
      description: "An easy 5K with time to regroup.", capacity: 8,
      attendeeIds: [host.id], host, status: "open",
    }],
  });
  const service = createEngagementService({ actorId: actor.id, store });
  const fixture = { store, service, mutations: [], expireOnInvite: false, expireOnCreate: false, failNextList: false };
  await page.route("**/", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace('name="pace-data-adapter" content="local"', 'name="pace-data-adapter" content="http"');
    await route.fulfill({ response, body });
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;
    const options = { idempotencyKey: request.headers()["idempotency-key"] };
    const respond = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    const expire = () => store.memberships.set(actor.id, { ...membership, status: "expired", expiresAt: new Date(Date.now() - 1000).toISOString() });
    if (method === "POST" && ["/invitations/direct", "/activities"].includes(path)) fixture.mutations.push({ path, body, idempotencyKey: options.idempotencyKey });
    try {
      if (path === "/auth/session") return respond({ error: { code: "UNAUTHENTICATED" } }, 401);
      if (path === "/auth/login") return respond({ email: body.email });
      if (path === "/discover") return respond({ state: "results", candidates: [{ id: "maya", distanceKm: 9, sportIds: ["running"] }] });
      if (path === "/connections/feed") return respond({ items: [] });
      if (path === "/me/membership") return respond(await service.getMembership());
      if (path === "/me/likes") return respond(await service.listIncomingLikes());
      if (path === "/billing/apple/context") return respond({ appAccountToken: null, products: [] });
      if (path === "/invitations/direct/access") return respond(await service.getDirectInviteAccess(url.searchParams.get("recipient_id")));
      if (path === "/invitations/direct" && method === "POST") {
        if (fixture.expireOnInvite) expire();
        return respond(await service.sendDirectInvite(body, options), 201);
      }
      if (path === "/activities" && method === "GET") {
        if (fixture.failNextList) { fixture.failNextList = false; return respond({ error: { code: "UNAVAILABLE", message: "Temporarily unavailable" } }, 503); }
        return respond({ items: await service.listActivities({ scope: url.searchParams.get("scope") || "discover", sportId: url.searchParams.get("sport_id") }) });
      }
      if (path === "/activities" && method === "POST") {
        if (fixture.expireOnCreate) expire();
        return respond(await service.createActivity(body, options), 201);
      }
      const activityRoute = path.match(/^\/activities\/([^/]+)(?:\/(join|leave))?$/);
      if (activityRoute) {
        const id = decodeURIComponent(activityRoute[1]);
        if (activityRoute[2] === "join") return respond(await service.joinActivity(id, options));
        if (activityRoute[2] === "leave") return respond(await service.leaveActivity(id, options));
        return respond(await service.getActivity(id));
      }
      return respond({ error: { code: "NOT_FOUND", message: "Unexpected fixture endpoint" } }, 404);
    } catch (error) {
      return respond({ error: { code: error.code ?? "API_ERROR", message: error.message } }, error.status ?? 500);
    }
  });
  return fixture;
}

test("an unmatched free member sees Plus instead of an invitation composer", async ({ page }) => {
  const errors = await signIn(page);
  const invite = page.getByRole("button", { name: "Invite to meet" });
  await expect(invite).not.toContainText("PLUS");
  const target = await invite.boundingBox();
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
  await invite.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Inviting someone before you match is a Plus benefit.", { exact: true })).toBeVisible();
  await expect(page.locator("#direct-invite-form, #invite-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Available in the iOS app" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Restore purchases" })).toBeDisabled();
  await expect(page.getByText("Matching, chatting with matches and joining public activities stay free.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Invite to meet" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("a free member can filter sessions, join, find Going, and leave", async ({ page }) => {
  const errors = await signIn(page);
  await page.getByRole("button", { name: "Meet up", exact: true }).click();
  const train = page.locator("#train-view");
  await expect(train.locator(".train-featured")).toContainText("High Park morning run");
  const sportFilter = train.locator(".train-sports");
  await sportFilter.locator("summary").click();
  await expect(sportFilter.getByRole("radio")).toHaveCount(44);
  await sportFilter.getByRole("searchbox", { name: "Search sports" }).fill("cycl");
  await sportFilter.getByRole("radiogroup").getByText("Cycling", { exact: true }).click();
  await expect(sportFilter).not.toHaveAttribute("open", "");
  await expect(sportFilter.locator("summary")).toContainText("Cycling");
  await expect(train.locator(".train-featured")).toContainText("Lakeside, at your pace");
  await expect(train.getByText("High Park morning run", { exact: true })).toHaveCount(0);
  await sportFilter.locator("summary").click();
  await sportFilter.getByRole("searchbox", { name: "Search sports" }).fill("pickle");
  await expect(sportFilter.getByRole("radio", { name: "Pickleball", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sportFilter).not.toHaveAttribute("open", "");
  await expect(sportFilter.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await sportFilter.getByRole("radiogroup").getByText("All sports", { exact: true }).click();
  await train.locator('[data-activity-id="high-park-run"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "High Park morning run" })).toBeVisible();
  await expect(dialog.locator(".train-detail-facts")).toContainText("12 / 20");
  await dialog.getByRole("button", { name: "Join session", exact: true }).click();
  await expect(dialog.locator(".train-detail-facts")).toContainText("13 / 20");
  await expect(dialog.getByRole("button", { name: "Leave session", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await train.getByRole("button", { name: "Going", exact: true }).click();
  await expect(train.locator(".train-featured")).toContainText("High Park morning run");
  await expect(train.locator(".train-featured")).toContainText("You’re going");
  await train.locator(".train-featured").click();
  await dialog.getByRole("button", { name: "Leave session", exact: true }).click();
  await expect(dialog.locator(".train-detail-facts")).toContainText("12 / 20");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(train.getByRole("heading", { name: "Your calendar is open." })).toBeVisible();
  await train.getByRole("button", { name: "Explore sessions", exact: true }).click();
  await expect(train.locator(".train-featured")).toContainText("High Park morning run");
  expect(errors).toEqual([]);
});

test("hosting requires Plus while browsing public sessions stays available", async ({ page }) => {
  const errors = await signIn(page);
  await page.getByRole("button", { name: "Meet up", exact: true }).click();
  await page.locator(".train-host").getByRole("button", { name: "Host a session" }).click();
  await expect(page.getByText("Host your next activity with Plus.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-train-create-form]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Available in the iOS app" })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".train-featured")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Plus direct invitations reach the API with an idempotency key and remain pending", async ({ page }) => {
  const fixture = await httpFixture(page);
  await signIn(page);
  await page.getByRole("button", { name: "Invite to meet" }).click();
  const form = await fillDirectInvite(page);
  await form.getByRole("button", { name: "Send invitation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Invitation sent", exact: true })).toBeVisible();
  await expect(page.getByText("Your invitation is pending. They can accept or decline your plan.", { exact: true })).toBeVisible();
  expect(fixture.mutations).toHaveLength(1);
  expect(fixture.mutations[0].idempotencyKey).toBeTruthy();
  expect(fixture.mutations[0].body).toMatchObject({ recipientId: "maya", sportId: "running", location: "High Park main entrance" });
  expect(Date.parse(fixture.mutations[0].body.startsAt)).toBeGreaterThan(Date.now());
  expect(Object.keys(fixture.mutations[0].body).sort()).toEqual(["location", "note", "recipientId", "sportId", "startsAt"]);
  expect([...fixture.store.invites.values()]).toHaveLength(1);
  expect([...fixture.store.invites.values()][0].status).toBe("pending");
  expect(fixture.store.matches.size).toBe(0);
});

test("an expired membership at send time returns to Plus without recording an invitation", async ({ page }) => {
  const fixture = await httpFixture(page);
  await signIn(page);
  await page.getByRole("button", { name: "Invite to meet" }).click();
  const form = await fillDirectInvite(page);
  fixture.expireOnInvite = true;
  await form.getByRole("button", { name: "Send invitation", exact: true }).click();
  await expect(page.getByText("Inviting someone before you match is a Plus benefit.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Available in the iOS app" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Invitation sent", exact: true })).toHaveCount(0);
  await expect(page.locator("#direct-invite-form")).toHaveCount(0);
  expect(fixture.mutations).toHaveLength(1);
  expect(fixture.store.invites.size).toBe(0);
});

test("a Plus host publishes a valid public session and finds it in Going", async ({ page }) => {
  const fixture = await httpFixture(page);
  await signIn(page);
  await page.getByRole("button", { name: "Meet up", exact: true }).click();
  await page.locator(".train-host").getByRole("button", { name: "Host a session" }).click();
  const form = page.locator("[data-train-create-form]");
  await expect(form).toBeVisible();
  await form.getByLabel("Session name", { exact: true }).fill("Coffee and a relaxed 5K");
  await form.getByLabel("Sport", { exact: true }).selectOption("running");
  await form.locator('[name="startsAt"]').fill(await futureLocalTime(page));
  await form.getByLabel("Public meeting point", { exact: true }).fill("High Park main entrance");
  await form.getByLabel("Group size (including you)", { exact: true }).fill("8");
  await form.locator('[name="description"]').fill("Meet by the entrance. Bring water; coffee is optional.");
  await form.getByRole("button", { name: "Publish session", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#train-view").getByRole("button", { name: "Going", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".train-featured")).toContainText("Coffee and a relaxed 5K");
  await expect(page.locator(".train-featured")).toContainText("You’re hosting");
  expect(fixture.mutations).toHaveLength(1);
  expect(fixture.mutations[0].idempotencyKey).toBeTruthy();
  expect(fixture.mutations[0].body).toMatchObject({ title: "Coffee and a relaxed 5K", capacity: 8, sportId: "running" });
  expect(fixture.mutations[0].body).not.toHaveProperty("host");
  expect(fixture.mutations[0].body).not.toHaveProperty("attendeeCount");
  const sessions = await fixture.service.listActivities({ scope: "hosting" });
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ isHost: true, joined: true, attendeeCount: 1, host: { id: "user_kevin" } });
  await page.locator(".train-featured").click();
  await expect(page.getByRole("button", { name: "You’re hosting", exact: true })).toBeDisabled();
});

test("Train retries a failed list request and preserves the real full-session state", async ({ page }) => {
  const fixture = await httpFixture(page, { plus: false });
  fixture.failNextList = true;
  await signIn(page);
  await page.getByRole("button", { name: "Meet up", exact: true }).click();
  await expect(page.getByRole("heading", { name: "We couldn’t load the sessions.", exact: true })).toBeVisible();
  await page.locator("#train-view").getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".train-featured")).toContainText("An easy morning loop");
  await page.locator(".train-featured").click();
  const activity = fixture.store.activities.get("fixture-run");
  activity.capacity = activity.attendeeIds.size;
  await page.getByRole("button", { name: "Join session", exact: true }).click();
  await expect(page.getByText("This session just filled up. Choose another session.", { exact: true })).toBeVisible();
  expect(activity.attendeeIds.has("user_kevin")).toBe(false);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".train-featured").click();
  await expect(page.getByRole("button", { name: "Session full", exact: true })).toBeDisabled();
});
