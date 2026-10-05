import assert from "node:assert/strict";
import { createEngagementService, createEngagementStore, resolveMembership } from "./engagement_service.mjs";
import { createHttpPaceRepository, createLocalPaceRepository } from "./pace_repository.mjs";
import { PaceApiClient } from "./api_client.mjs";

const tests = [];
const test = (name, run) => tests.push([name, run]);
const NOW = Date.parse("2030-09-12T12:00:00Z");
const FUTURE = "2030-09-13T12:00:00Z";
const EXPIRY = "2030-10-12T12:00:00Z";
const plus = { tier: "plus", status: "active", expiresAt: EXPIRY, autoRenews: true, source: "app_store" };
const users = [{ id: "kevin", name: "Kevin", verified: true }, { id: "maya", name: "Maya", verified: true }, { id: "alex", name: "Alex" }];
const activity = {
  id: "run", title: "Morning 5K", sportId: "running", startsAt: FUTURE,
  location: "High Park main gate", description: "An easy social run.", pace: "Easy pace", distanceKm: 3,
  capacity: 2, attendeeIds: ["maya"], host: users[1],
};
const invite = { recipientId: "maya", sportId: "running", startsAt: FUTURE, location: "High Park main gate", note: "Easy 5K?" };
const newActivity = { title: "Morning 5K", sportId: "running", startsAt: FUTURE, location: "High Park main gate", capacity: 8, description: "All paces welcome", pace: "Easy" };
const key = (idempotencyKey) => ({ idempotencyKey });
const rejectsCode = (run, code) => assert.rejects(run, (error) => error.code === code);

function setup(seed = {}) {
  let time = NOW;
  const store = createEngagementStore({ users, activities: [activity], ...seed });
  return { store, service: createEngagementService({ actorId: "kevin", store, now: () => time }), setTime: (value) => { time = value; } };
}

test("free is the default and caller-supplied membership cannot grant direct invitations", async () => {
  const { service, store } = setup();
  assert.equal((await service.getMembership()).tier, "free");
  await rejectsCode(() => service.sendDirectInvite({ ...invite, tier: "plus", isMatched: true, actorId: "maya", entitlements: { directInvites: true } }, key("free")), "PLUS_REQUIRED");
  assert.equal(store.invites.size, 0);
  await rejectsCode(() => service.createActivity(newActivity, key("create")), "PLUS_REQUIRED");
});

test("incoming likes require Plus and only reveal unblocked incoming profiles", async () => {
  const { service, store } = setup({ likes: [["maya", "kevin"], ["maya", "kevin"], ["alex", "kevin"], ["kevin", "maya"]], blocks: [["alex", "kevin"]] });
  await rejectsCode(() => service.listIncomingLikes(), "PLUS_REQUIRED");
  store.memberships.set("kevin", plus);
  const likes = await service.listIncomingLikes();
  assert.deepEqual(likes.map((person) => person.id), ["maya"]);
  assert.equal(likes[0].name, "Maya");
  assert.equal(likes[0].verified, true);
  store.memberships.set("kevin", { ...plus, status: "revoked" });
  await rejectsCode(() => service.listIncomingLikes(), "PLUS_REQUIRED");
});

test("invite access reads trusted match state and does not substitute for mutation authorization", async () => {
  const { service, store } = setup();
  assert.deepEqual(await service.getDirectInviteAccess("maya"), { allowed: false, matched: false });
  const matched = setup({ matches: [["maya", "kevin"]] });
  assert.deepEqual(await matched.service.getDirectInviteAccess("maya"), { allowed: true, matched: true });
  store.memberships.set("kevin", plus);
  assert.deepEqual(await service.getDirectInviteAccess("maya"), { allowed: true, matched: false });
  store.memberships.delete("kevin");
  await rejectsCode(() => service.sendDirectInvite(invite, key("stale-precheck")), "PLUS_REQUIRED");
});

test("membership expires at the boundary and ignores forged entitlement flags", () => {
  assert.equal(resolveMembership(plus, NOW).entitlements.directInvites, true);
  assert.equal(resolveMembership(plus, Date.parse(EXPIRY)).tier, "free");
  assert.equal(resolveMembership({ tier: "free", entitlements: { directInvites: true } }, NOW).entitlements.directInvites, false);
  assert.equal(resolveMembership({ ...plus, expiresAt: "invalid" }, NOW).tier, "free");
  assert.equal(resolveMembership({ ...plus, status: "billing_retry" }, NOW).tier, "free");
});

test("turning off renewal retains paid access; revocation removes it immediately", () => {
  const cancelled = resolveMembership({ ...plus, status: "cancelled", autoRenews: false }, NOW);
  assert.equal(cancelled.tier, "plus");
  assert.equal(cancelled.autoRenews, false);
  assert.equal(cancelled.expiresAt, EXPIRY);
  const revoked = resolveMembership({ ...plus, revokedAt: new Date(NOW).toISOString() }, NOW);
  assert.equal(revoked.tier, "free");
  assert.equal(revoked.entitlements.hostActivities, false);
});

test("every new premium mutation checks current authoritative entitlement", async () => {
  const { service, setTime, store } = setup({ memberships: { kevin: plus } });
  await service.getMembership();
  setTime(Date.parse(EXPIRY));
  await rejectsCode(() => service.sendDirectInvite({ ...invite, startsAt: "2030-11-01T12:00:00Z" }, key("expired")), "PLUS_REQUIRED");
  store.memberships.set("kevin", { ...plus, revokedAt: "2030-09-12T12:00:00Z" });
  setTime(NOW);
  await rejectsCode(() => service.createActivity(newActivity, key("revoked")), "PLUS_REQUIRED");
});

test("a trusted existing match may receive a free invitation, without creating a new match", async () => {
  const { service, store } = setup({ matches: [["kevin", "maya"]] });
  const result = await service.sendDirectInvite(invite, key("matched"));
  assert.equal(result.status, "pending");
  assert.equal(result.senderId, "kevin");
  assert.equal(store.matches.size, 1);
  const unmatched = setup({ memberships: { kevin: plus } });
  await unmatched.service.sendDirectInvite(invite, key("plus"));
  assert.equal(unmatched.store.matches.size, 0);
});

test("both block directions and self-invitations are rejected even for Plus", async () => {
  for (const pair of [["kevin", "maya"], ["maya", "kevin"]]) {
    const { service } = setup({ memberships: { kevin: plus }, blocks: [pair] });
    await rejectsCode(() => service.sendDirectInvite(invite, key("blocked")), "RECIPIENT_UNAVAILABLE");
    assert.deepEqual(await service.listActivities(), []);
    await rejectsCode(() => service.joinActivity("run", key("blocked-join")), "ACTIVITY_NOT_FOUND");
  }
  const { service } = setup({ memberships: { kevin: plus } });
  await rejectsCode(() => service.sendDirectInvite({ ...invite, recipientId: "kevin" }, key("self")), "VALIDATION_ERROR");
  await rejectsCode(() => service.sendDirectInvite({ ...invite, recipientId: "missing" }, key("missing")), "RECIPIENT_UNAVAILABLE");
});

test("invitation retry is idempotent and another request cannot duplicate a pending invitation", async () => {
  const { service, store } = setup({ memberships: { kevin: plus } });
  const first = await service.sendDirectInvite(invite, key("one"));
  assert.deepEqual(await service.sendDirectInvite(invite, key("one")), first);
  assert.equal(store.invites.size, 1);
  await rejectsCode(() => service.sendDirectInvite(invite, key("two")), "ALREADY_INVITED");
  await rejectsCode(() => service.sendDirectInvite({ ...invite, note: "Different" }, key("one")), "IDEMPOTENCY_CONFLICT");
});

test("a paid request replay after expiry cannot bypass current authorization or create duplicate data", async () => {
  const { service, store, setTime } = setup({ memberships: { kevin: plus } });
  await service.sendDirectInvite(invite, key("invite-replay"));
  await service.createActivity(newActivity, key("activity-replay"));
  setTime(Date.parse(EXPIRY));
  await rejectsCode(() => service.sendDirectInvite(invite, key("invite-replay")), "PLUS_REQUIRED");
  await rejectsCode(() => service.createActivity(newActivity, key("activity-replay")), "PLUS_REQUIRED");
  assert.equal(store.invites.size, 1);
  assert.equal(store.activities.size, 2);
});

test("cached responses cannot bypass a later block or disabled account", async () => {
  const { service, store } = setup({ memberships: { kevin: plus } });
  await service.sendDirectInvite(invite, key("invite-replay"));
  await service.joinActivity("run", key("join-replay"));
  store.blocks.add(JSON.stringify(["kevin", "maya"]));
  await rejectsCode(() => service.sendDirectInvite(invite, key("invite-replay")), "RECIPIENT_UNAVAILABLE");
  await rejectsCode(() => service.joinActivity("run", key("join-replay")), "ACTIVITY_NOT_FOUND");
  store.users.get("kevin").disabled = true;
  await rejectsCode(() => service.joinActivity("run", key("join-replay")), "UNAUTHENTICATED");
});

test("invalid session fields never persist an invitation or activity", async () => {
  const { service, store } = setup({ memberships: { kevin: plus } });
  for (const [index, invalid] of [{ startsAt: "2030-09-01T12:00:00Z" }, { startsAt: "2030-09-13T12:00" }, { sportId: "invented" }, { location: " " }, { note: "x".repeat(301) }].entries()) {
    await rejectsCode(() => service.sendDirectInvite({ ...invite, ...invalid }, key(`bad-invite-${index}`)), "VALIDATION_ERROR");
  }
  for (const capacity of [1, 101, 2.5, "12"]) {
    await rejectsCode(() => service.createActivity({ ...newActivity, capacity }, key(`bad-capacity-${capacity}`)), "VALIDATION_ERROR");
  }
  assert.equal(store.invites.size, 0);
  assert.equal(store.activities.size, 1);
});

test("Plus does not bypass trusted host verification, including cached creation", async () => {
  const { service, store } = setup({ memberships: { kevin: plus } });
  store.users.get("kevin").verified = false;
  await rejectsCode(() => service.createActivity({ ...newActivity, verified: true, host: { id: "kevin", verified: true } }, key("unverified")), "HOST_VERIFICATION_REQUIRED");
  assert.equal(store.activities.size, 1);
  store.users.get("kevin").verified = true;
  await service.createActivity(newActivity, key("verified"));
  store.users.get("kevin").verified = false;
  await rejectsCode(() => service.createActivity(newActivity, key("verified")), "HOST_VERIFICATION_REQUIRED");
});

test("activity creation binds the host to the session and counts the host once", async () => {
  const { service } = setup({ memberships: { kevin: plus } });
  const result = await service.createActivity({ ...newActivity, host: { id: "maya", verified: true }, attendeeCount: 90, isHost: false }, key("host"));
  assert.deepEqual(result.host, { id: "kevin", name: "Kevin", verified: true });
  assert.equal(result.attendeeCount, 1);
  assert.equal(result.joined, true);
  assert.equal(result.isHost, true);
  assert.equal(result.attendeeIds, undefined);
  assert.equal((await service.listActivities({ scope: "hosting" })).length, 1);
  await rejectsCode(() => service.leaveActivity(result.id, key("leave-own")), "HOST_CANNOT_LEAVE");
});

test("activity responses expose only the public DTO, including on cached mutation responses", async () => {
  const privateActivity = { ...activity, moderationNotes: "private", host: { ...activity.host, email: "private@example.com" } };
  const { service } = setup({ activities: [privateActivity] });
  const response = await service.joinActivity("run", key("join"));
  for (const result of [response, await service.getActivity("run"), await service.joinActivity("run", key("join"))]) {
    assert.equal(result.moderationNotes, undefined);
    assert.equal(result.host.email, undefined);
    assert.equal(result.attendeeIds, undefined);
    assert.equal(result.attendeeCount, 2);
  }
});

test("concurrent joins cannot exceed capacity and a duplicate join never adds a seat", async () => {
  const { service, store } = setup();
  const alex = createEngagementService({ actorId: "alex", store, now: () => NOW });
  const results = await Promise.allSettled([service.joinActivity("run", key("join")), alex.joinActivity("run", key("join"))]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "ACTIVITY_FULL");
  assert.equal((await service.joinActivity("run", key("join-again"))).attendeeCount, 2);
  assert.equal((await service.joinActivity("run", key("join"))).attendeeCount, 2);
  assert.equal((await service.getActivity("run")).attendeeCount, 2);
});

test("leaving releases exactly one seat; joined list and sport filters reflect stored state", async () => {
  const { service } = setup();
  await service.joinActivity("run", key("join"));
  assert.equal((await service.listActivities({ scope: "joined" })).length, 1);
  assert.equal((await service.listActivities({ sportId: "cycling" })).length, 0);
  assert.equal((await service.leaveActivity("run", key("leave"))).attendeeCount, 1);
  assert.equal((await service.leaveActivity("run", key("leave-again"))).attendeeCount, 1);
  assert.deepEqual(await service.listActivities({ scope: "joined" }), []);
});

test("closed and past activities reject joins, and request keys cannot be omitted", async () => {
  const { service, setTime } = setup();
  await rejectsCode(() => service.joinActivity("run"), "VALIDATION_ERROR");
  setTime(Date.parse(FUTURE));
  await rejectsCode(() => service.joinActivity("run", key("past")), "ACTIVITY_CLOSED");
  assert.deepEqual(await service.listActivities(), []);
});

test("unknown authenticated identity cannot read membership or mutate activities", async () => {
  const service = createEngagementService({ actorId: "intruder", store: createEngagementStore({ users, activities: [activity] }), now: () => NOW });
  await rejectsCode(() => service.getMembership(), "UNAUTHENTICATED");
  await rejectsCode(() => service.joinActivity("run", key("join")), "UNAUTHENTICATED");
});

test("local preview never grants a subscription from a native callback or unverified signed text", async () => {
  const local = createLocalPaceRepository({ candidates: [{ id: "maya" }], now: () => NOW });
  assert.deepEqual(await local.getBillingContext(), { appAccountToken: null, products: [] });
  await rejectsCode(() => local.syncAppleTransaction({ signedTransaction: "fake.jws.text", appAccountToken: "fake" }), "APP_STORE_UNAVAILABLE");
  await local.saveProfile({ tier: "plus", entitlements: { directInvites: true } });
  assert.equal((await local.getMembership()).tier, "free");
  await rejectsCode(() => local.sendDirectInvite(invite, key("local-free")), "PLUS_REQUIRED");
});

const appleConfig = { bundleId: "app.pace.sport", environment: "Sandbox", products: [{ id: "pace.plus.monthly", period: "month" }] };
const verifiedTransaction = {
  bundleId: appleConfig.bundleId, environment: "Sandbox", productId: "pace.plus.monthly", appAccountToken: "server-kevin-token",
  originalTransactionId: "original-1", transactionId: "transaction-1", status: "active",
  expiresAt: EXPIRY, signedAt: new Date(NOW).toISOString(), statusCheckedAt: new Date(NOW).toISOString(), autoRenews: true,
};

test("only an injected trusted verifier can grant Apple access, with app/account/product binding", async () => {
  for (const invalid of [{ appAccountToken: "other" }, { bundleId: "wrong.bundle" }, { productId: "unrelated.product" }, { environment: "Production" }, { signedAt: "bad-date" }]) {
    const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
    const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => ({ ...verifiedTransaction, ...invalid }) } });
    await rejectsCode(() => service.syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-kevin-token" }), "TRANSACTION_INVALID");
    assert.equal((await service.getMembership()).tier, "free");
  }
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
  const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => verifiedTransaction } });
  assert.equal((await service.syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-kevin-token" })).tier, "plus");
  await rejectsCode(() => service.syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "other" }), "TRANSACTION_ACCOUNT_MISMATCH");
});

test("a later verified refund revokes access and replaying an older purchase cannot restore it", async () => {
  let verified = { ...verifiedTransaction, statusCheckedAt: new Date(NOW + 10000).toISOString() };
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
  const service = createEngagementService({ actorId: "kevin", store, now: () => NOW + 10000, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => verified } });
  const request = { signedTransaction: "signed", appAccountToken: "server-kevin-token" };
  await service.syncAppleTransaction(request);
  verified = { ...verifiedTransaction, status: "revoked", signedAt: new Date(NOW + 1000).toISOString(), statusCheckedAt: new Date(NOW + 10000).toISOString() };
  assert.equal((await service.syncAppleTransaction(request)).tier, "free");
  verified = { ...verifiedTransaction, statusCheckedAt: new Date(NOW + 10000).toISOString() };
  assert.equal((await service.syncAppleTransaction(request)).tier, "free");
  await rejectsCode(() => service.sendDirectInvite(invite, key("refunded")), "PLUS_REQUIRED");
});

test("signed history without a fresh current subscription lookup cannot grant access", async () => {
  for (const statusCheckedAt of [undefined, "bad", new Date(NOW - 60001).toISOString(), new Date(NOW + 60001).toISOString()]) {
    const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
    const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => ({ ...verifiedTransaction, statusCheckedAt }) } });
    await rejectsCode(() => service.syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-kevin-token" }), "TRANSACTION_INVALID");
    assert.equal((await service.getMembership()).tier, "free");
  }
});

test("billing identity rotation during asynchronous verification fails before entitlement writes", async () => {
  let release;
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
  const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: () => new Promise((resolve) => { release = resolve; }) } });
  const pending = service.syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-kevin-token" });
  store.appAccountTokens.set("kevin", "rotated-token");
  release(verifiedTransaction);
  await rejectsCode(() => pending, "TRANSACTION_ACCOUNT_MISMATCH");
  assert.equal(store.appleEvents.size, 0);
  assert.equal((await service.getMembership()).tier, "free");
});

test("conflicting same-version status cannot regrant revoked access; newer signed reversal may restore remaining time", async () => {
  let verified = verifiedTransaction;
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
  const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => verified } });
  const request = { signedTransaction: "signed", appAccountToken: "server-kevin-token" };
  await service.syncAppleTransaction(request);
  verified = { ...verifiedTransaction, status: "revoked" };
  assert.equal((await service.syncAppleTransaction(request)).tier, "free");
  verified = verifiedTransaction;
  assert.equal((await service.syncAppleTransaction(request)).tier, "free");
  verified = { ...verifiedTransaction, signedAt: new Date(NOW + 1000).toISOString() };
  const restored = await service.syncAppleTransaction(request);
  assert.equal(restored.tier, "plus");
  assert.equal(restored.expiresAt, EXPIRY);
});

test("refunding an old subscription chain does not revoke another legitimate current subscription", async () => {
  let verified = verifiedTransaction;
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
  const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => verified } });
  const request = { signedTransaction: "signed", appAccountToken: "server-kevin-token" };
  await service.syncAppleTransaction(request);
  verified = { ...verifiedTransaction, originalTransactionId: "original-2", transactionId: "transaction-2", expiresAt: "2030-11-12T12:00:00Z", signedAt: new Date(NOW + 1000).toISOString() };
  await service.syncAppleTransaction(request);
  verified = { ...verifiedTransaction, status: "revoked", signedAt: new Date(NOW + 2000).toISOString() };
  const current = await service.syncAppleTransaction(request);
  assert.equal(current.tier, "plus");
  assert.equal(current.expiresAt, "2030-11-12T12:00:00Z");
});

test("billing context includes legal URLs but never leaks verifier or product configuration secrets", async () => {
  const config = { ...appleConfig, termsUrl: "https://pace.example/terms", privacyUrl: "https://pace.example/privacy", products: [{ ...appleConfig.products[0], internalSecret: "private" }] };
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token" } });
  const service = createEngagementService({ actorId: "kevin", store, now: () => NOW, appleConfig: config, appleVerifier: { verifyAndGetSubscription: async () => verifiedTransaction } });
  const context = await service.getBillingContext();
  assert.equal(context.termsUrl, config.termsUrl);
  assert.equal(context.privacyUrl, config.privacyUrl);
  assert.equal(context.products[0].internalSecret, undefined);
  const invalid = createEngagementService({ actorId: "kevin", store, appleConfig: config, appleVerifier: { verifyAndGetSubscription: true } });
  assert.deepEqual(await invalid.getBillingContext(), { appAccountToken: null, products: [] });
  await rejectsCode(() => invalid.syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-kevin-token" }), "APP_STORE_UNAVAILABLE");
});

test("subscription transaction ownership prevents restoring the same subscription onto another account", async () => {
  const store = createEngagementStore({ users, appAccountTokens: { kevin: "server-kevin-token", alex: "server-alex-token" } });
  const make = (actorId, appAccountToken) => createEngagementService({ actorId, store, now: () => NOW, appleConfig, appleVerifier: { verifyAndGetSubscription: async () => ({ ...verifiedTransaction, appAccountToken }) } });
  await make("kevin", "server-kevin-token").syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-kevin-token" });
  await rejectsCode(() => make("alex", "server-alex-token").syncAppleTransaction({ signedTransaction: "signed", appAccountToken: "server-alex-token" }), "TRANSACTION_ACCOUNT_MISMATCH");
});

test("HTTP repository forwards mutation identity keys and preserves authoritative Plus denial", async () => {
  const requests = [];
  const repo = createHttpPaceRepository(new PaceApiClient({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: false, status: 403, json: async () => ({ error: { code: "PLUS_REQUIRED", message: "Subscription expired." } }) };
  } }));
  await rejectsCode(() => repo.sendDirectInvite(invite, key("request-1")), "PLUS_REQUIRED");
  assert.equal(requests[0].url, "/api/v1/invitations/direct");
  assert.equal(requests[0].options.headers.get("Idempotency-Key"), "request-1");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.deepEqual(JSON.parse(requests[0].options.body), invite);
});

test("HTTP mode fails closed on unavailable backend and never substitutes a local paid state", async () => {
  const failure = new Error("Network unavailable");
  const repo = createHttpPaceRepository(new PaceApiClient({ fetchImpl: async () => { throw failure; } }));
  await assert.rejects(() => repo.getMembership(), (error) => error === failure);
  await assert.rejects(() => repo.createActivity(newActivity, key("create")), (error) => error === failure);
});

let failures = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${error.stack}`);
  }
}
if (failures) process.exitCode = 1;
console.log(`\n${tests.length - failures}/${tests.length} engagement tests passed`);
