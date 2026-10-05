import assert from "node:assert/strict";
import { membershipCopy } from "./features/membership_copy.mjs";
import { readFile } from "node:fs/promises";
import { PaceApiClient, buildDiscoveryQuery } from "./api_client.mjs";
import {
  chatRoomCopy,
  discoveryFilterCopy,
  flowCopy,
  momentsCopy,
  profileCopy,
  translations,
  verificationCopy,
} from "./features/app_copy.mjs";
import { SPORTS, SPORT_CATALOG_VERSION, normalizeSportIds, searchSports } from "./sport_catalog.mjs";

const tests = [];
const test = (name, run) => tests.push([name, run]);
const languages = ["zh-CN", "en", "fr", "es", "de"];

test("sport catalog exposes stable unique IDs and localized labels", () => {
  assert.ok(SPORTS.length >= 40);
  assert.equal(new Set(SPORTS.map((sport) => sport.id)).size, SPORTS.length);
  assert.ok(SPORTS.every((sport) => languages.every((language) => sport.labels[language]?.trim())));
  assert.match(SPORT_CATALOG_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("sport catalog normalizes persisted IDs and searches presentation labels", () => {
  assert.deepEqual(normalizeSportIds(["running", "running", "invalid", "cycling"]), ["running", "cycling"]);
  assert.deepEqual(normalizeSportIds("running"), []);
  assert.equal(searchSports("攀岩", "zh-CN")[0].id, "climbing");
  assert.equal(searchSports("HYROX", "en")[0].id, "hyrox");
});

test("discovery query uses stable backend parameters", () => {
  const query = buildDiscoveryQuery({ distanceKm: 18, sportId: "climbing", goal: "social", schedule: "weekends" });
  assert.equal(query.toString(), "distance_km=18&sport_id=climbing&goal=social&schedule=weekends");
  assert.throws(() => buildDiscoveryQuery({ distanceKm: Number.NaN }), /distanceKm/);
});

test("HTTP client owns transport details for every repository operation", async () => {
  const requests = [];
  const client = new PaceApiClient({
    baseUrl: "/api/v1/",
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  await client.authenticate({ email: "member@example.com", password: "correct-horse-battery" });
  await client.signOut();
  await client.discover({ distanceKm: 18, sportId: "climbing" });
  await client.getConnectionFeed({ cursor: "cursor_2", limit: 10 });
  await client.setConnectionPostLike("post/42", true);
  await client.createConnectionPostComment("post/42", "Great session");
  await client.createConnectionPost({ sport_id: "running", visibility: "connections" });
  await client.updateProfile({ sport_ids: ["running"] });

  assert.deepEqual(requests.map(({ url }) => url), [
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/discover?distance_km=18&sport_id=climbing",
    "/api/v1/connections/feed?limit=10&cursor=cursor_2",
    "/api/v1/connections/feed/post%2F42/like",
    "/api/v1/connections/feed/post%2F42/comments",
    "/api/v1/connections/feed",
    "/api/v1/me/profile",
  ]);
  assert.equal(requests[0].options.headers.get("Accept"), "application/json");
  assert.equal(requests[0].options.headers.get("Content-Type"), "application/json");
  assert.equal(requests[1].options.headers.has("Content-Type"), false);
  assert.equal(requests[2].options.headers.has("Content-Type"), false);
  assert.equal(requests[4].options.headers.get("Content-Type"), "application/json");
});

test("HTTP client exposes actionable transport errors", async () => {
  const client = new PaceApiClient({
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  await assert.rejects(() => client.getConnectionFeed(), /GET \/connections\/feed.*503/);
});

test("HTTP session endpoints use uncached verification and an existing server session", async () => {
  const requests = [];
  const client = new PaceApiClient({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ authenticated: true }) };
  } });
  await client.getSession();
  await client.completeOnboarding();
  assert.deepEqual(requests.map(({ url }) => url), ["/api/v1/auth/session", "/api/v1/auth/onboarding/complete"]);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.cache, "no-store");
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.equal(requests[0].options.signal.aborted, false);
  assert.equal(requests[1].options.method, "POST");
  for (const { options } of requests) {
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.body, undefined);
    assert.equal(options.headers.has("Authorization"), false);
  }
});

test("every supported language provides the same top-level translation interface", () => {
  const referenceKeys = Object.keys(translations.en).sort();
  for (const language of languages) assert.deepEqual(Object.keys(translations[language]).sort(), referenceKeys);
});

test("feature copy modules cover every supported language", () => {
  for (const copy of [chatRoomCopy, discoveryFilterCopy, flowCopy, momentsCopy, profileCopy, verificationCopy]) {
    assert.deepEqual(Object.keys(copy).sort(), [...languages].sort());
  }
});

test("membership copy covers billing and invite controls in all supported languages", () => {
  for (const language of languages) {
    assert.deepEqual(Object.keys(membershipCopy(language)).sort(), Object.keys(membershipCopy("en")).sort());
    assert.ok(Object.values(membershipCopy(language)).every(value => typeof value === "object" || (typeof value === "string" && value.length > 0)));
  }
});

test("production assets share one release cache stamp", async () => {
  const productionImportFiles = [
    "index.html",
    "styles.css",
    "app.js",
    "pace_repository.mjs",
    "features/account.mjs",
    "features/chat.mjs",
    "features/moments.mjs",
    "features/onboarding.mjs",
    "features/train.mjs",
    "features/membership.mjs",
    "engagement_service.mjs",
  ];
  const sourceFiles = await Promise.all(productionImportFiles.map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  const stampsByFile = sourceFiles.map((source) => source.match(/pace-release-audit-\d+/g) ?? []);
  assert.ok(stampsByFile.every((stamps) => stamps.length > 0), "Every production import file must carry a release cache stamp");
  const uniqueStamps = [...new Set(stampsByFile.flat())];
  assert.equal(uniqueStamps.length, 1, `Mixed release cache stamps found: ${uniqueStamps.join(", ")}`);
});

let failures = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${error.message}`);
  }
}
if (failures) process.exitCode = 1;
console.log(`\n${tests.length - failures}/${tests.length} contract tests passed`);
