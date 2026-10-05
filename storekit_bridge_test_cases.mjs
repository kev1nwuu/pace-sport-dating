import assert from "node:assert/strict";
import { createStoreKitBridge } from "./features/storekit_bridge.mjs";

const tests = [];
const test = (name, run) => tests.push([name, run]);
const token = "9711c88f-f0d9-4199-917f-8efe1e5bef78";
// Deliberately unsigned test fixtures: the bridge checks shape, never authenticity.
const jws = "dGVzdA.dGVzdA.dGVzdA";
const monthly = { id: "test.monthly", displayName: "Test Plus", displayPrice: "12,99 €", subscriptionPeriod: { unit: "month", value: 1 } };
const adapterWith = (overrides = {}) => ({
  products: async () => [monthly],
  purchase: async () => ({ status: "success", signedTransaction: jws }),
  restore: async () => ({ transactions: [jws] }),
  manageSubscriptions: async () => ({ status: "presented" }),
  ...overrides,
});

test("browser and partial native adapters fail closed", async () => {
  for (const adapter of [null, {}, { purchase: async () => ({ status: "success" }) }, adapterWith({ available: false })]) {
    const bridge = createStoreKitBridge({ adapter });
    assert.equal(bridge.isAvailable(), false);
    for (const run of [() => bridge.products([monthly.id]), () => bridge.purchase(monthly.id, { appAccountToken: token }), () => bridge.restore(), () => bridge.manageSubscriptions()]) {
      await assert.rejects(run, { code: "STOREKIT_UNAVAILABLE" });
    }
  }
});

test("native products preserve localized prices and are limited to requested subscription IDs", async () => {
  let received;
  const bridge = createStoreKitBridge({ adapter: adapterWith({ products: async (ids) => { received = ids; return [monthly]; } }) });
  assert.equal(bridge.isAvailable(), true);
  assert.deepEqual(await bridge.products([monthly.id]), [monthly]);
  assert.deepEqual(received, [monthly.id]);
  for (const products of [null, [null], [{ ...monthly, id: "another.product" }], [monthly, monthly], [{ ...monthly, displayPrice: "" }], [{ ...monthly, subscriptionPeriod: { unit: "month", value: 0 } }], [{ ...monthly, subscriptionPeriod: null }]]) {
    await assert.rejects(() => createStoreKitBridge({ adapter: adapterWith({ products: async () => products }) }).products([monthly.id]), { code: "STOREKIT_INVALID_RESPONSE" });
  }
});

test("unconfigured or malformed product IDs do not reach native purchase", async () => {
  let calls = 0;
  const bridge = createStoreKitBridge({ adapter: adapterWith({ products: async () => { calls += 1; return []; }, purchase: async () => { calls += 1; } }) });
  assert.deepEqual(await bridge.products([]), []);
  for (const ids of [null, [" "], [monthly.id, monthly.id], [2]]) await assert.rejects(() => bridge.products(ids), { code: "STOREKIT_INVALID_INPUT" });
  for (const appAccountToken of [undefined, "account_1", "00000000-0000-0000-0000-000000000000"]) {
    await assert.rejects(() => bridge.purchase(monthly.id, { appAccountToken }), { code: "STOREKIT_INVALID_INPUT" });
  }
  await assert.rejects(() => bridge.purchase("", { appAccountToken: token }), { code: "STOREKIT_INVALID_INPUT" });
  assert.equal(calls, 0);
});

test("purchase binds the backend account token and returns only signed transaction evidence", async () => {
  let received;
  const bridge = createStoreKitBridge({ adapter: adapterWith({ purchase: async (...args) => { received = args; return { status: "success", signedTransaction: jws, tier: "plus" }; } }) });
  assert.deepEqual(await bridge.purchase(monthly.id, { appAccountToken: token }), { status: "success", signedTransaction: jws });
  assert.deepEqual(received, [monthly.id, { appAccountToken: token }]);
});

test("pending and cancellation never return an entitlement or transaction", async () => {
  for (const status of ["pending", "cancelled"]) {
    const bridge = createStoreKitBridge({ adapter: adapterWith({ purchase: async () => ({ status }) }) });
    assert.deepEqual(await bridge.purchase(monthly.id, { appAccountToken: token }), { status });
  }
  for (const result of [null, { status: "verified" }, { status: "success" }, { status: "success", signedTransaction: "unsigned" }, { status: "pending", signedTransaction: jws }]) {
    const bridge = createStoreKitBridge({ adapter: adapterWith({ purchase: async () => result }) });
    await assert.rejects(() => bridge.purchase(monthly.id, { appAccountToken: token }), { code: "STOREKIT_INVALID_RESPONSE" });
  }
});

test("restore returns empty or unique transaction evidence and rejects malformed responses", async () => {
  for (const transactions of [[], [jws], [jws, jws]]) {
    const bridge = createStoreKitBridge({ adapter: adapterWith({ restore: async () => ({ transactions }) }) });
    assert.deepEqual(await bridge.restore(), { transactions: [...new Set(transactions)] });
  }
  for (const result of [null, { transactions: null }, { transactions: ["not-a-jws"] }, { tier: "plus" }]) {
    await assert.rejects(() => createStoreKitBridge({ adapter: adapterWith({ restore: async () => result }) }).restore(), { code: "STOREKIT_INVALID_RESPONSE" });
  }
});

test("manage subscriptions confirms only system presentation and propagates native errors", async () => {
  assert.deepEqual(await createStoreKitBridge({ adapter: adapterWith() }).manageSubscriptions(), { status: "presented" });
  await assert.rejects(() => createStoreKitBridge({ adapter: adapterWith({ manageSubscriptions: async () => ({ tier: "plus" }) }) }).manageSubscriptions(), { code: "STOREKIT_INVALID_RESPONSE" });
  const failure = new Error("App Store is unavailable");
  await assert.rejects(() => createStoreKitBridge({ adapter: adapterWith({ purchase: async () => { throw failure; } }) }).purchase(monthly.id, { appAccountToken: token }), (error) => error === failure);
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
console.log(`\n${tests.length - failures}/${tests.length} StoreKit bridge tests passed`);
