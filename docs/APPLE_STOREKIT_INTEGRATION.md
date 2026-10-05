# PACE Plus: App Store integration contract

Checked against Apple's official documentation on **2026-09-12**.

This repository is a web prototype. There is no native iOS target, StoreKit implementation, deployed authenticated billing backend, or configured App Store Connect product in this repository. The JavaScript bridge, HTTP client contracts, and reference engagement service are integration scaffolding. They do not make the app App Store ready and cannot collect payment in an ordinary browser.

## Implemented boundary

`features/storekit_bridge.mjs` exports `createStoreKitBridge({ adapter = globalThis.PaceStoreKit } = {})`. The iOS container must inject a real native adapter before constructing the feature. The factory does not create a mock adapter. `isAvailable()` checks that all four native methods exist and `adapter.available !== false`; this checks capability presence, not connectivity or purchase authorization.

| Method | Adapter and bridge result |
| --- | --- |
| `products(productIds)` | Array of `{ id, displayName, displayPrice, subscriptionPeriod: { unit, value } }`. Unit is `day`, `week`, `month`, or `year`; value is a positive integer. Only requested IDs may be returned. Missing products may be omitted; an empty list means no purchasable plans. |
| `purchase(productId, { appAccountToken })` | `{ status: "success", signedTransaction }`, `{ status: "pending" }`, or `{ status: "cancelled" }`. Token must be a nonzero UUID issued by the backend for the signed-in PACE account. |
| `restore()` | `{ transactions: [signedTransaction, ...] }`, including an empty array when StoreKit has no current entitlements. |
| `manageSubscriptions()` | `{ status: "presented" }` after presenting the native management sheet. This result never means a subscription changed. |

Every method except `isAvailable()` is asynchronous. Missing native integration throws `STOREKIT_UNAVAILABLE`; malformed inputs throw `STOREKIT_INVALID_INPUT`; malformed native responses throw `STOREKIT_INVALID_RESPONSE`. Native errors propagate. Product DTOs and purchase results are copied into these exact public shapes; additional native fields cannot become membership state. Signed-transaction strings are checked only for compact JWS shape and size. **This is not cryptographic verification.**

Run the isolated checks with `node storekit_bridge_test_cases.mjs`. The unsigned strings in those tests are explicitly test fixtures and must never be accepted by a production verifier.

## App Store Connect configuration still required

1. Register the production bundle identifier, create the iOS target and app record, enable its In-App Purchase capability, and complete the applicable developer agreements, tax, and banking setup. Use the same bundle identifier throughout native signing and server validation. Follow Apple's [In-App Purchase setup workflow](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases).
2. Create a single PACE Plus auto-renewable subscription group. Monthly and annual options, if offered, should provide the same Plus benefits and belong to the same level. Set real immutable product IDs, duration, localized name/description, pricing, availability, and review information in Connect. Do not invent launch IDs or prices in frontend code. Apple's [subscription configuration](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions) and [subscription information reference](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/auto-renewable-subscription-information) describe these fields.
3. Decide billing grace-period settings and test them in sandbox before production. The server must use Apple's actual grace deadline, not a hard-coded duration. See [Billing Grace Period configuration](https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions).
4. Keep Family Sharing disabled for the initial account-bound PACE design unless its separate ownership model has been implemented and tested. This is a PACE implementation choice: the current one-subscription-chain-to-one-account rule does not support family entitlements. Apple notes that enabling Family Sharing cannot be undone in its [subscription guidance](https://developer.apple.com/app-store/subscriptions/).
5. Create an In-App Purchase API key and store its private key, key ID, and issuer ID exclusively in the backend secret store. Configure bundle ID, production app Apple ID, environment, subscription-group ID, and allowed product IDs server-side. Install the official [App Store Server Library](https://github.com/apple/app-store-server-library-node) and Apple root certificates. Never place the `.p8` key in the web build or native JavaScript bridge.
6. Publish separate HTTPS production/sandbox notification URLs, select **Version 2**, and configure both in Connect. Exercise Apple's test-notification endpoint. [Configure notification URLs](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications).

## Native purchase and recovery lifecycle

The native adapter fetches products using StoreKit `Product.products(for:)`; `displayPrice` must come directly from StoreKit. Its formatting follows the App Store storefront, which may differ from the phone's language. Display that price with the actual billing period; never replace it with a hard-coded currency or convert it from an API price. Missing/unavailable products disable checkout. [Localized product prices](https://developer.apple.com/documentation/storekit/product/displayprice).

The web paywall obtains `{ appAccountToken, products }` from authenticated `GET /api/v1/billing/apple/context`, passes configured product IDs into `bridge.products(...)`, and lets the person select an available product. Native code must also enforce the configured product allowlist and restrict its webview message bridge to trusted app content.

On explicit purchase, native code passes the backend UUID through StoreKit's `appAccountToken` purchase option and presents the StoreKit system confirmation sheet. Apple returns that UUID in the signed transaction, enabling backend ownership checks. [App account token](https://developer.apple.com/documentation/storekit/product/purchaseoption/appaccounttoken(_:)).

Native code maps `.success(.verified(transaction))` to the bridge's `success` plus its JWS representation. `.success(.unverified(...))` is an error; it must not be mapped to success. Map StoreKit `.pending` to `pending` and `.userCancelled` to `cancelled`. Pending purchases keep the UI usable and grant no benefits. Cancellation is a normal return to the paywall. [Purchase result cases](https://developer.apple.com/documentation/storekit/product/purchaseresult/usercancelled).

After bridge success, send the evidence to `POST /api/v1/billing/apple/transactions` as `{ signedTransaction, appAccountToken }`. Only after backend verification and durable persistence does the app reload `GET /api/v1/me/membership`. UI success alone cannot unlock Plus. On network failure, show that purchase verification is still processing; do not invite another payment for the same pending transaction.

Native code must start a `Transaction.updates` listener at app launch and reconcile `currentEntitlements` and `unfinished`, including when the app resumes. Transactions approved later or purchased elsewhere need the same authenticated server ingestion. The listener is native lifecycle work still to implement; the web bridge does not supply it. [Transaction updates](https://developer.apple.com/documentation/storekit/transaction/updates) and [processing unfinished transactions](https://developer.apple.com/documentation/storekit/supporting-offer-codes-in-your-app).

For this minimal bridge contract, use a durable backend outbox to call Apple's **Finish Transaction** endpoint after verified entitlement delivery has committed. Retry outbox failures. This avoids needing a JavaScript `finish` callback; native code must still retain/retry unprocessed StoreKit transactions. Alternatively, the native implementation can call `transaction.finish()` after server delivery is acknowledged. Pick one owner; do not finish before persistence/delivery. Apple explicitly supports server-managed completion through [Finish Transaction](https://developer.apple.com/documentation/appstoreserverapi/finish-transaction).

The Restore Purchases button calls `AppStore.sync()` only in direct response to a tap, then iterates verified `Transaction.currentEntitlements` and returns their JWS strings. Apple's sync may prompt for authentication. Normal launch reconciliation uses current entitlements without forcing sync. [Restore synchronization](https://developer.apple.com/documentation/storekit/appstore/sync()).

Send restored transactions through the same backend ingestion and reload server membership even when the list is empty. Empty device results are not authority to erase a server subscription; backend reconciliation must query Apple and determine current state. Apple excludes revoked/refunded items and includes subscriptions in grace from [current entitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements).

Expose Manage Subscription from the paywall/account screen and invoke `AppStore.showManageSubscriptions(in:)` in the active native scene. Refresh membership afterward; dismissal does not itself cancel access. [Native subscription management](https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)).

## Production backend ownership and validation

The existing `PaceApiClient` methods and `createEngagementService` define the integration seam. The service's in-memory store must be replaced by transactional persistent storage behind authenticated routes. Its `appleVerifier.verifyAndGetSubscription({ signedTransaction })` dependency is intentionally absent; a browser-injected verifier or local membership flag is never a production security boundary.

Implementation requirements for that verifier and route:

1. Derive the PACE actor from the authenticated session, never request `actorId`. Load that actor's persisted billing UUID. Compare the supplied token with it, but treat the supplied token as untrusted until the signed Apple data has been verified.
2. Verify the JWS certificate chain and signature with Apple's official server library and trusted Apple root CAs. Configure the expected bundle ID, environment and production app Apple ID; do not derive these trusted values from the submitted JWS. Reject untrusted chains, malformed payloads, or identity/environment mismatches. Decoding Base64 is insufficient. [Official verifier configuration](https://github.com/apple/app-store-server-library-node).
3. Validate product allowlist, subscription group/type, signed `appAccountToken`, transaction ID, original transaction ID, expiry, signed time, and revocation data. Bind the original transaction chain to one PACE account using a database uniqueness constraint. A transaction belonging to a different account returns `TRANSACTION_ACCOUNT_MISMATCH`; never silently transfer it during restore. A missing Apple account token needs an explicit server-mediated recovery policy, not assignment to the current caller. [Signed transaction fields](https://developer.apple.com/documentation/appstoreserverapi/jwstransactiondecodedpayload).
4. Query Apple's current subscription state, verify its signed transaction and renewal information, and normalize the effective entitlement. An old correctly signed purchase can have since expired or been refunded. Use [Get All Subscription Statuses](https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses) for reconciliation, including after outages.
5. Atomically persist ownership, verified transaction evidence, latest authoritative status and resulting entitlement. Deduplicate transaction replays and reconcile by authoritative Apple state, not HTTP arrival order. An old restore must not overwrite a newer refund, renewal, or plan change. Store audit timestamps and make duplicate successful ingestion return the current membership.
6. Check the server entitlement on each protected mutation, including an invitation to an unmatched person and Plus hosting tools. Recheck the match/block relationship and entitlement inside the mutation transaction. Neither a displayed Plus badge nor cached browser state authorizes an invitation.

Keep sandbox and production records isolated. A production verifier must not automatically accept sandbox data after a failed check. Server API keys, verification internals, transaction JWS, and account tokens must not appear in client analytics or routine logs.

## Subscription state normalization

PACE's reference service currently consumes `{ bundleId, environment, productId, appAccountToken, transactionId, originalTransactionId, status, expiresAt, signedAt, statusCheckedAt, autoRenews, revokedAt }` from the trusted verifier. Dates are ISO timestamps. This is a PACE DTO, not Apple's raw API response. `statusCheckedAt` is generated by the trusted verifier when it obtains current Apple state, not taken from the client. The reference requires a fresh observation (5-second request tolerance, at most 60 seconds old). `signedAt` represents the newest verified evidence supporting that status. See [the exact service contract](./ENGAGEMENT_API.md) for reconciliation and conflict behavior.

| Verified Apple state | PACE normalization and access |
| --- | --- |
| Active, renewal enabled | `active`; allow until verified paid expiry. |
| Active, auto-renew disabled | `cancelled`; allow until paid expiry. Cancellation prevents future renewal and must not immediately remove paid access. |
| In billing grace period | `grace_period`; set effective `expiresAt` to verified `gracePeriodExpiresDate`, retain original paid expiry separately in persistent billing data. |
| Billing retry without unexpired paid access or grace | `expired`; deny new Plus actions. Retrying billing alone does not authorize service. |
| Expired | `expired`; deny Plus actions using server time even if no webhook has arrived. |
| Refunded/revoked entitlement | `revoked`; deny affected entitlement immediately, then recompute any other legitimate current entitlement. |

Use the verified renewal information for grace and auto-renew state. [Apple renewal information](https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfodecodedpayload) and [subscription lifecycle events](https://developer.apple.com/documentation/appstoreservernotifications/notificationtype).

## Notifications V2 and reconciliation

Implement a dedicated public webhook authenticated by Apple's verified signature, separate from session-authenticated purchase ingestion. The outer `signedPayload` and applicable nested `signedTransactionInfo` / `signedRenewalInfo` are signed JWS objects and must be verified before use. [V2 response format](https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2).

Persist `notificationUUID` with a unique constraint and acknowledge only after durable acceptance into the processing queue. Return success for duplicates. Handle temporary ingestion failures with a retryable server failure and retry queued processing independently. Apple documents `notificationUUID` as the duplicate identifier in the [decoded notification payload](https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2decodedpayload).

Handle initial purchase/renewal, auto-renew changes, grace entry/exit, expiry, refund/revoke and refund reversal. Recompute access from verified current state; a refund of an older transaction must not blindly erase a later valid renewal. `REFUND_REVERSED` requires reconsidering the affected access with its unchanged expiry, not granting a new full period. Quarantine valid but unbound transactions for account reconciliation. Unknown future event types must be recorded without granting access. [Apple notification meanings](https://developer.apple.com/documentation/appstoreservernotifications/notificationtype).

Add scheduled reconciliation for active/grace subscriptions and recover missed notifications through Apple's notification-history API. Alert on processing backlog, verification failures and unexpected identity mismatches. These workers, webhook routes and database constraints are required future backend work.

## Paywall and release verification

The paywall must clearly show included Plus benefits, actual localized price, duration, and renewal behavior before subscription. Provide Restore Purchases and Manage Subscription. Provide working Terms of Use and Privacy Policy links both in-app and in App Store metadata; launch must not rely on placeholder dialogs. Do not advertise trials or savings without configured eligible offers. [Apple subscription presentation requirements](https://developer.apple.com/app-store/subscriptions/) and [App Review subscription guidance](https://developer.apple.com/app-store/review/guidelines/#subscriptions).

Before release, test on a signed native build with StoreKit testing and sandbox: successful purchase; user cancellation; pending approval later resolved; interruption after Apple payment but before backend receipt; duplicate ingestion; restore on another device; restore under a different PACE account; unavailable products; multiple storefront currencies; renewal disabled while still paid; grace expiry/recovery; refund/revocation/reversal; duplicate and out-of-order notifications; logout while purchase is processing; expired membership during an invite request; and application relaunch with unfinished transactions. These are release acceptance scenarios, not claims that browser tests have verified Apple billing.
