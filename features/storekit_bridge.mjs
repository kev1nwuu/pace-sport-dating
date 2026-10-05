/**
 * Boundary for a future native StoreKit 2 wrapper injected as PaceStoreKit.
 * Shape checks here do not verify Apple signatures or grant entitlements.
 * Only the authenticated backend can authorize PACE Plus features.
 */
export class StoreKitBridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StoreKitBridgeError";
    this.code = code;
  }
}

const methods = ["products", "purchase", "restore", "manageSubscriptions"];
const periodUnits = new Set(["day", "week", "month", "year"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jwsPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isProductId = (value) => isText(value) && value === value.trim() && value.length <= 255 && !/\s/.test(value);
const isJws = (value) => typeof value === "string" && value.length <= 65_536 && jwsPattern.test(value);

function requireShape(condition) {
  if (!condition) throw new StoreKitBridgeError("STOREKIT_INVALID_RESPONSE", "The App Store response could not be read. Please try again.");
}

export function createStoreKitBridge({ adapter = globalThis.PaceStoreKit } = {}) {
  function isAvailable() {
    return Boolean(adapter && adapter.available !== false && methods.every((method) => typeof adapter[method] === "function"));
  }

  function requireAvailable() {
    if (!isAvailable()) throw new StoreKitBridgeError("STOREKIT_UNAVAILABLE", "App Store purchases are available in the PACE iOS app when billing is connected.");
  }

  return Object.freeze({
    isAvailable,

    async products(productIds) {
      requireAvailable();
      if (!Array.isArray(productIds) || productIds.length > 100 || !productIds.every(isProductId) || new Set(productIds).size !== productIds.length) {
        throw new StoreKitBridgeError("STOREKIT_INVALID_INPUT", "Provide a unique list of configured App Store product IDs.");
      }
      if (!productIds.length) return [];
      const products = await adapter.products([...productIds]);
      requireShape(Array.isArray(products));
      const seen = new Set();
      return products.map((product) => {
        requireShape(product && isProductId(product.id) && productIds.includes(product.id) && !seen.has(product.id));
        requireShape(isText(product.displayName) && isText(product.displayPrice));
        const period = product.subscriptionPeriod;
        requireShape(period && periodUnits.has(period.unit) && Number.isSafeInteger(period.value) && period.value > 0);
        seen.add(product.id);
        return {
          id: product.id,
          displayName: product.displayName,
          displayPrice: product.displayPrice,
          subscriptionPeriod: { unit: period.unit, value: period.value },
        };
      });
    },

    async purchase(productId, { appAccountToken } = {}) {
      requireAvailable();
      if (!isProductId(productId) || typeof appAccountToken !== "string" || !uuidPattern.test(appAccountToken) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(appAccountToken)) {
        throw new StoreKitBridgeError("STOREKIT_INVALID_INPUT", "A configured product and the signed-in account's billing token are required.");
      }
      const result = await adapter.purchase(productId, { appAccountToken });
      requireShape(result && ["success", "pending", "cancelled"].includes(result.status));
      if (result.status === "success") {
        requireShape(isJws(result.signedTransaction));
        return { status: "success", signedTransaction: result.signedTransaction };
      }
      requireShape(result.signedTransaction == null);
      return { status: result.status };
    },

    async restore() {
      requireAvailable();
      const result = await adapter.restore();
      requireShape(result && Array.isArray(result.transactions) && result.transactions.every(isJws));
      return { transactions: [...new Set(result.transactions)] };
    },

    async manageSubscriptions() {
      requireAvailable();
      const result = await adapter.manageSubscriptions();
      requireShape(result?.status === "presented");
      return { status: "presented" };
    },
  });
}
