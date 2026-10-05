import assert from "node:assert/strict";
import { createHttpPaceRepository, createLocalPaceRepository } from "./pace_repository.mjs";
import { PaceApiClient } from "./api_client.mjs";

const candidate = {
  id: "maya",
  distanceKm: 9,
  sportIds: ["running", "cycling"],
};

const post = {
  id: "post_1",
  author_id: "user_maya",
  author: { name: "Maya", connection_status: "connected" },
  visibility: "connections",
  sport_id: "running",
  reaction_count: 1,
  liked_by_me: false,
  comments: [],
};

const local = createLocalPaceRepository({ candidates: [candidate], posts: [post] });
assert.deepEqual(await local.authenticate({ email: "member@example.com" }), { email: "member@example.com" });
assert.equal(await local.signOut(), null);
assert.deepEqual(await local.discover({ distanceKm: 12, sportId: "running" }), {
  state: "results",
  candidates: [candidate],
});
assert.deepEqual(await local.discover({ distanceKm: 5, sportId: "running" }), {
  state: "waitlist",
  candidates: [],
});
assert.equal((await local.listFeed())[0].liked_by_me, false);
assert.equal((await local.setPostLike("post_1", true)).liked_by_me, true);
assert.equal((await local.addComment("post_1", "  Great run  ")).text, "Great run");
assert.equal((await local.publish({
  id: "post_2",
  author_id: "user_kevin",
  visibility: "connections",
  sport_id: "cycling",
})).id, "post_2");
assert.deepEqual(await local.saveProfile({ sport_ids: ["running"] }), { sport_ids: ["running"] });

const calls = [];
const client = {
  authenticate: async (credentials) => { calls.push(["authenticate", credentials]); return { email: credentials.email }; },
  signOut: async () => { calls.push(["signOut"]); return null; },
  discover: async (filters) => { calls.push(["discover", filters]); return { state: "results", candidates: [candidate] }; },
  getConnectionFeed: async () => { calls.push(["listFeed"]); return { items: [post] }; },
  setConnectionPostLike: async (postId, liked) => { calls.push(["setPostLike", postId, liked]); return { ...post, liked_by_me: liked }; },
  createConnectionPostComment: async (postId, text) => { calls.push(["addComment", postId, text]); return { id: "comment_1", text }; },
  createConnectionPost: async (value) => { calls.push(["publish", value]); return value; },
  updateProfile: async (value) => { calls.push(["saveProfile", value]); return value; },
};
const http = createHttpPaceRepository(client);
assert.equal((await http.authenticate({ email: "member@example.com" })).email, "member@example.com");
assert.equal(await http.signOut(), null);
assert.equal((await http.discover({ distanceKm: 12 })).candidates[0].id, "maya");
assert.equal((await http.listFeed())[0].id, "post_1");
assert.equal((await http.setPostLike("post_1", true)).liked_by_me, true);
assert.equal((await http.addComment("post_1", "Ready")).text, "Ready");
assert.equal((await http.publish({ id: "post_2" })).id, "post_2");
assert.deepEqual(await http.saveProfile({ sport_ids: ["running"] }), { sport_ids: ["running"] });
assert.deepEqual(calls.map(([name]) => name), ["authenticate", "signOut", "discover", "listFeed", "setPostLike", "addComment", "publish", "saveProfile"]);

const sessionTests = [];
const test = (name, run) => sessionTests.push([name, run]);
const sessionKey = "pace-preview-session-v1";
const ttl = 30 * 24 * 60 * 60 * 1000;
const clockStart = Date.UTC(2026, 8, 15);

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    entries() { return [...data.entries()]; },
  };
}

test("login restores in a new preview instance without storing credentials or profile", async () => {
  const storage = memoryStorage();
  const options = { sessionStorage: storage, now: () => clockStart };
  const first = createLocalPaceRepository({ ...options, profile: { name: "Private member" } });
  assert.equal(await first.restoreSession(), null);
  assert.equal(storage.getItem(sessionKey), null);
  await first.authenticate({ email: "private@example.com", password: "never-persist-this" });
  await first.saveProfile({ name: "Private member", email: "private@example.com" });
  assert.deepEqual(storage.entries(), [[sessionKey, JSON.stringify({ version: 1, expiresAt: clockStart + ttl })]]);
  const reopened = createLocalPaceRepository(options);
  assert.deepEqual(await reopened.restoreSession(), { authenticated: true });
});

test("completed preview onboarding survives reopening and never grants Plus", async () => {
  const storage = memoryStorage();
  const options = { sessionStorage: storage, now: () => clockStart };
  const first = createLocalPaceRepository(options);
  assert.deepEqual(await first.completeOnboarding(), { authenticated: true });
  const reopened = createLocalPaceRepository(options);
  assert.deepEqual(await reopened.restoreSession(), { authenticated: true });
  const fresh = createLocalPaceRepository({ now: () => clockStart });
  assert.deepEqual(await reopened.getMembership(), await fresh.getMembership());
});

test("sign-out clears the marker and is observed by existing and reopened instances", async () => {
  const storage = memoryStorage();
  const options = { sessionStorage: storage, now: () => clockStart };
  const first = createLocalPaceRepository(options);
  await first.authenticate({ email: "member@example.com" });
  const reopened = createLocalPaceRepository(options);
  assert.deepEqual(await reopened.restoreSession(), { authenticated: true });
  assert.equal(await first.signOut(), null);
  assert.equal(storage.getItem(sessionKey), null);
  assert.equal(await first.restoreSession(), null);
  assert.equal(await reopened.restoreSession(), null);
  assert.equal(await createLocalPaceRepository(options).restoreSession(), null);
});

test("session expires at 30 days and restoration does not extend it", async () => {
  let time = clockStart;
  const storage = memoryStorage();
  const repository = createLocalPaceRepository({ sessionStorage: storage, now: () => time });
  await repository.authenticate({ email: "member@example.com" });
  time += ttl - 1;
  assert.deepEqual(await repository.restoreSession(), { authenticated: true });
  assert.equal(JSON.parse(storage.getItem(sessionKey)).expiresAt, clockStart + ttl);
  time += 1;
  assert.equal(await repository.restoreSession(), null);
  assert.equal(storage.getItem(sessionKey), null);
});

test("malformed and obsolete preview markers are removed", async () => {
  for (const marker of [
    "not-json", "null", "false", "[]", '"a string"', "{}",
    JSON.stringify({ version: 2, expiresAt: clockStart + ttl }),
    JSON.stringify({ version: 1, expiresAt: String(clockStart + ttl) }),
    JSON.stringify({ version: 1, expiresAt: clockStart - 1 }),
    JSON.stringify({ version: 1, expiresAt: clockStart + ttl, membership: "plus" }),
  ]) {
    const storage = memoryStorage();
    storage.setItem(sessionKey, marker);
    const repository = createLocalPaceRepository({ sessionStorage: storage, now: () => clockStart });
    assert.equal(await repository.restoreSession(), null);
    assert.equal(storage.getItem(sessionKey), null);
  }
});

test("without injected storage, only the current instance remembers login", async () => {
  const repository = createLocalPaceRepository({ now: () => clockStart });
  assert.equal(await repository.restoreSession(), null);
  await repository.authenticate({ email: "member@example.com" });
  assert.deepEqual(await repository.restoreSession(), { authenticated: true });
  assert.equal(await createLocalPaceRepository({ now: () => clockStart }).restoreSession(), null);
  await repository.signOut();
  assert.equal(await repository.restoreSession(), null);
});

test("blocked storage falls back to expiring in-memory sessions without throwing", async () => {
  let time = clockStart;
  const storage = {
    getItem() { throw new Error("Storage blocked"); },
    setItem() { throw new Error("Storage blocked"); },
    removeItem() { throw new Error("Storage blocked"); },
  };
  const repository = createLocalPaceRepository({ sessionStorage: storage, now: () => time });
  assert.equal(await repository.restoreSession(), null);
  await repository.authenticate({ email: "member@example.com" });
  assert.deepEqual(await repository.restoreSession(), { authenticated: true });
  time += ttl;
  assert.equal(await repository.restoreSession(), null);
  await repository.completeOnboarding();
  assert.deepEqual(await repository.restoreSession(), { authenticated: true });
  await repository.signOut();
  assert.equal(await repository.restoreSession(), null);
});

test("a quota failure and a later storage read failure preserve current-instance continuity", async () => {
  const quotaStorage = memoryStorage();
  quotaStorage.setItem = () => { throw new Error("Quota exceeded"); };
  const quotaRepository = createLocalPaceRepository({ sessionStorage: quotaStorage, now: () => clockStart });
  await quotaRepository.authenticate({ email: "member@example.com" });
  assert.deepEqual(await quotaRepository.restoreSession(), { authenticated: true });
  assert.equal(await createLocalPaceRepository({ sessionStorage: quotaStorage, now: () => clockStart }).restoreSession(), null);

  const readStorage = memoryStorage();
  const readRepository = createLocalPaceRepository({ sessionStorage: readStorage, now: () => clockStart });
  await readRepository.completeOnboarding();
  const originalGetItem = readStorage.getItem;
  readStorage.getItem = () => { throw new Error("Storage unavailable"); };
  assert.deepEqual(await readRepository.restoreSession(), { authenticated: true });
  await readRepository.signOut();
  assert.equal(await readRepository.restoreSession(), null);
  assert.equal(originalGetItem(sessionKey), null);
});

test("sign-out still clears memory when storage removal fails", async () => {
  const storage = memoryStorage();
  const repository = createLocalPaceRepository({ sessionStorage: storage, now: () => clockStart });
  await repository.completeOnboarding();
  storage.removeItem = () => { throw new Error("Storage became unavailable"); };
  await repository.signOut();
  assert.equal(await repository.restoreSession(), null);
});

test("HTTP restoration accepts only a verified boolean authenticated response", async () => {
  for (const payload of [{ authenticated: true, email: "member@example.com" }, { authenticated: false }, { authenticated: "true" }, { ok: true }, null]) {
    const requests = [];
    const api = new PaceApiClient({ fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => payload };
    } });
    const repository = createHttpPaceRepository(api);
    assert.deepEqual(await repository.restoreSession(), payload?.authenticated === true ? { authenticated: true } : null);
    assert.equal(requests[0].url, "/api/v1/auth/session");
    assert.equal(requests[0].options.cache, "no-store");
    assert.equal(requests[0].options.credentials, "same-origin");
  }
});

test("HTTP restoration treats only 401 as signed out and preserves retryable errors", async () => {
  for (const status of [401, 403, 500, 503]) {
    const api = new PaceApiClient({ fetchImpl: async () => ({ ok: false, status }) });
    const repository = createHttpPaceRepository(api);
    if (status === 401) assert.equal(await repository.restoreSession(), null);
    else await assert.rejects(() => repository.restoreSession(), (error) => error.status === status);
  }
  for (const failure of [new TypeError("Network unavailable"), new DOMException("Timed out", "TimeoutError")]) {
    const repository = createHttpPaceRepository(new PaceApiClient({ fetchImpl: async () => { throw failure; } }));
    await assert.rejects(() => repository.restoreSession(), (error) => error === failure);
  }
});

test("HTTP onboarding completion forwards the existing authenticated session without credentials", async () => {
  const requests = [];
  const repository = createHttpPaceRepository(new PaceApiClient({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ authenticated: true }) };
  } }));
  assert.deepEqual(await repository.completeOnboarding(), { authenticated: true });
  assert.equal(requests[0].url, "/api/v1/auth/onboarding/complete");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].options.body, undefined);
});

test("HTTP onboarding cannot authenticate from an empty or malformed successful response", async () => {
  for (const payload of [null, {}, { authenticated: false }, { authenticated: "true" }]) {
    const repository = createHttpPaceRepository(new PaceApiClient({ fetchImpl: async () => ({
      ok: true, status: 200, json: async () => payload,
    }) }));
    await assert.rejects(() => repository.completeOnboarding(), /did not confirm an authenticated account/);
  }
});

for (const [name, run] of sessionTests) {
  await run();
  console.log(`✓ ${name}`);
}
console.log(`\n${7 + sessionTests.length}/${7 + sessionTests.length} repository interface and session tests passed`);
