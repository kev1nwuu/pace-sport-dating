# PACE Plus, invitations, and Train API handoff

## Implementation status

`engagement_service.mjs` is an executable, DOM-free **reference service with an in-memory store**. It is not a deployed production backend. `pace_repository.mjs` provides the local preview adapter and the HTTP adapter; `api_client.mjs` defines the transport contract below. The local preview defaults to free membership and cannot activate Plus from a purchase callback, local storage, or profile fields.

The static preview server does not implement these `/api/v1` routes. HTTP mode requires a separately deployed authenticated backend. A failed or unavailable HTTP request rejects; it never falls back to seeded local data or grants access. Native StoreKit code, Apple signature verification, persistent billing records, subscription webhooks, and production invitation delivery are still integration work. See [Apple / StoreKit integration](./APPLE_STOREKIT_INTEGRATION.md) for that separate boundary.

The currently implemented product policy is:

- Everyone can browse and join public future activities, subject to blocks and capacity.
- Plus can create public activities and view incoming likes.
- Plus can send a session invitation to someone they have not matched with.
- An existing match can receive a session invitation without Plus. Only the server's match relationship determines this exception.
- Sending an invitation creates a `pending` invitation. It never creates a match or a chat conversation.
- The host counts toward activity capacity and cannot leave their own activity.

## Authentication and authority

All routes below require a valid PACE session. Route middleware derives `actorId` from that session, loads authoritative data, and binds it at service construction:

```js
const service = createEngagementService({
  actorId: authenticatedSession.userId,
  store: trustedStore,
  appleVerifier: serverAppleVerifier,
  appleConfig: serverAppleConfig,
});
```

`actorId`, `tier`, `entitlements`, `isMatched`, `host`, `isHost`, and `attendeeCount` in a request are never authority. The reference service ignores forged extra fields and builds its own result. The deployed HTTP schema should reject unknown fields. Profile-editing routes must not write membership, verification, match, or activity-ownership records.

The web client uses `credentials: "same-origin"`. The deployed server owns secure session cookies or its explicit native authentication scheme, session invalidation, origin/CSRF checks for cookie-authenticated mutations, and rate limiting. Never expose the reference store or a verifier-injection API to the browser. A disabled or unknown actor receives `UNAUTHENTICATED`.

## Routes

All paths have prefix `/api/v1`. Request and response bodies use JSON. Object fields use camelCase; the existing URL query parameters use snake_case where shown.

| Method and path | Input | Success body | Authorization |
| --- | --- | --- | --- |
| `GET /me/membership` | None | `Membership` | Signed in |
| `GET /me/likes` | None | `{ "items": IncomingLike[] }` | Current `seeLikes` entitlement |
| `GET /billing/apple/context` | None | `BillingContext` | Signed in |
| `POST /billing/apple/transactions` | `AppleTransactionRequest` | Current `Membership` after verified persistence | Signed in; transaction bound to this account |
| `GET /invitations/direct/access?recipient_id=maya` | Recipient ID | `{ "allowed": false, "matched": false }` | Signed in; recipient available and unblocked |
| `POST /invitations/direct` | `DirectInviteInput` + `Idempotency-Key` | `DirectInvite` | Existing match or current `directInvites` entitlement |
| `GET /activities?scope=discover&sport_id=running` | Optional `sport_id`; scope `discover`, `joined`, or `hosting` | `{ "items": Activity[] }` | Signed in |
| `GET /activities/:id` | URL-encoded activity ID | `Activity` | Signed in; host unblocked |
| `POST /activities` | `CreateActivityInput` + `Idempotency-Key` | `Activity` | Current `hostActivities` entitlement |
| `POST /activities/:id/join` | `{}` + `Idempotency-Key` | Updated `Activity` | Signed in; activity open, future, and not full |
| `POST /activities/:id/leave` | `{}` + `Idempotency-Key` | Updated `Activity` | Signed in; actor is not the host |

Return `200` for reads, updates, and verified Apple ingestion; use `201` for newly created activities/invitations. The service returns arrays for list methods; the route can wrap them in `{ items }`. The HTTP repository accepts either the envelope or an array and always gives UI callers an array. Activity lists exclude cancelled and already-started activities and sort by `startsAt`. `joined` includes hosted activities because the host is attending.

The access-check endpoint is a UI preflight, not an authorization token. A subscription can expire or someone can block the sender after that read; the mutation must check the authoritative state again.

## Public DTOs

### Membership

```json
{
  "tier": "plus",
  "status": "cancelled",
  "expiresAt": "2030-10-12T12:00:00.000Z",
  "autoRenews": false,
  "entitlements": {
    "directInvites": true,
    "hostActivities": true,
    "seeLikes": true
  },
  "source": "app_store"
}
```

`tier` is effective access (`free` or `plus`), not the submitted or historical plan. Access requires a trusted Plus record, an allowed status, a future effective expiry according to server time, and no revocation. `active`, `cancelled`, and `grace_period` may retain access. Cancelled means renewal is off; paid time remains available. The expiry boundary is exclusive. A revoked or expired record denies new Plus operations immediately. Billing retry without verified paid access or grace must normalize to `expired`.

Free default: `tier: "free"`, `status: "free"`, `expiresAt: null`, `autoRenews: false`, all entitlements false, `source: "none"`. `expiresAt` in a grace record is the verified effective access deadline; the backend retains the original paid expiry separately.

### Activity

```json
{
  "id": "activity_123",
  "title": "Easy morning run",
  "sportId": "running",
  "startsAt": "2030-09-13T12:00:00.000Z",
  "location": "High Park, main entrance",
  "description": "An easy 5K, followed by coffee.",
  "pace": "Conversational pace",
  "distanceKm": null,
  "capacity": 12,
  "attendeeCount": 1,
  "status": "open",
  "joined": true,
  "isHost": true,
  "host": { "id": "user_kevin", "name": "Kevin", "verified": false }
}
```

`joined` and `isHost` are relative to the authenticated actor. `attendeeCount` comes from unique attendee records and includes the host. `distanceKm` is an optional server-computed distance to the activity, not the length of the route; new reference activities use `null`. The public DTO omits attendee IDs, private host fields, moderation data, and other internal columns.

### CreateActivityInput

```json
{
  "title": "Easy morning run",
  "sportId": "running",
  "startsAt": "2030-09-13T12:00:00.000Z",
  "location": "High Park, main entrance",
  "capacity": 12,
  "description": "An easy 5K, followed by coffee.",
  "pace": "Conversational pace"
}
```

Trimmed title: 1–80 characters. Location: 1–160. Capacity: integer 2–100, including the host. Description: optional, at most 1,200 characters. Pace: optional, at most 80. `sportId` must exist in the shared sport catalog. `startsAt` must be a valid future ISO timestamp with an explicit timezone (`Z` or offset); persist normalized UTC. The server chooses ID, host identity, host verification, attendance, status, and timestamps.

### DirectInviteInput and DirectInvite

```json
{
  "recipientId": "maya",
  "sportId": "running",
  "startsAt": "2030-09-13T12:00:00.000Z",
  "location": "High Park, main entrance",
  "note": "Want to join an easy 5K?"
}
```

Recipient ID: 1–128 characters; cannot equal the actor ID. Sport, time, and location use the same validation as activities. Note is optional and at most 300 characters. Disabled, missing, or blocked recipients receive the same `RECIPIENT_UNAVAILABLE` result. Block checks apply in both directions.

The success body contains the normalized input plus server-owned `id`, `senderId`, `status: "pending"`, and `createdAt`. Only one future pending invitation from a sender to a recipient is allowed, independent of sport or start time. A retry with the original key returns the original result if current authorization still permits access. A different key while the invitation is pending returns `ALREADY_INVITED`.

The deployed recipient inbox, accept/decline lifecycle, notification transport, moderation controls, and invitation-expiry worker are not supplied by this reference module. Persist the invitation and a delivery-outbox entry atomically before notifying the recipient. Do not mark an invitation accepted or create a chat merely because delivery succeeded.

### IncomingLike

```json
{
  "id": "maya",
  "name": "Maya",
  "age": 28,
  "verified": true,
  "photoUrl": null,
  "sportIds": ["running", "cycling"],
  "bio": "Training for a 10K.",
  "distanceKm": 9
}
```

Only the listed public fields are returned. Duplicate incoming likes are collapsed by sender. Outgoing likes, the actor, disabled users, and either direction of a blocked relationship are excluded. The reference constructor accepts trusted directional `likes: [[senderId, recipientId]]` seeds; it defaults to an empty list.

## Apple billing boundary

### BillingContext

```json
{
  "appAccountToken": "server-issued-account-uuid",
  "products": [
    { "id": "configured.plus.monthly.product", "period": "month" },
    { "id": "configured.plus.yearly.product", "period": "year" }
  ],
  "termsUrl": "https://your-real-domain.example/terms",
  "privacyUrl": "https://your-real-domain.example/privacy"
}
```

The example URLs and product IDs are illustrative configuration, not live PACE assets. The deployed backend provides the user's stable billing UUID and allowlisted product IDs. Native StoreKit supplies actual localized product prices and display strings. Backend legal links must point to working HTTPS policy pages; the UI keeps purchase disabled until required context, products, and legal links are available. Never include credentials or arbitrary internal product configuration in this DTO.

Configure `appleConfig` on the server with `bundleId`, exact `environment` (`Sandbox` or `Production`), `products: [{ id, period }]`, `termsUrl`, and `privacyUrl`. With no usable verifier/configuration, the local reference returns `{ "appAccountToken": null, "products": [] }` and rejects purchase ingestion with `APP_STORE_UNAVAILABLE`.

### AppleTransactionRequest

```json
{
  "signedTransaction": "the-StoreKit-transaction-JWS",
  "appAccountToken": "the-current-account-billing-uuid"
}
```

`signedTransaction` is a non-empty string of at most 65,536 characters. The submitted account token is only an assertion to compare with the account's server record; it does not prove ownership. Native success or a decoded JWS must never directly set membership.

The injected server-only `appleVerifier.verifyAndGetSubscription({ signedTransaction })` must verify the submitted transaction, query the **current** subscription state for its original transaction chain, verify the returned signed transaction and renewal evidence, and return this PACE-normalized DTO:

```js
{
  bundleId, environment, productId, appAccountToken,
  originalTransactionId, transactionId,
  status, expiresAt, signedAt, statusCheckedAt,
  autoRenews, revokedAt // revokedAt is optional/null when not revoked
}
```

Dates are ISO timestamps. `signedAt` identifies the newest verified signed evidence supporting the normalized state, which may be renewal/notification evidence; it is not blindly copied from an old submitted purchase. `statusCheckedAt` is set by the trusted verifier when it actually obtains and verifies current state, not by the request or the submitted JWS. The reference requires that observation to be recent relative to the current request (5 seconds of tolerance and at most 60 seconds old). Production clocks must be synchronized. The verifier must ensure that current state and the submitted transaction belong to the same original chain, expected app, environment, subscription type/group, and PACE account. These cryptographic and Apple API checks are obligations of the injected verifier, not implemented JWS verification in this module.

The service additionally validates the returned app/environment/product/account, field completeness, freshness, immutable original-transaction ownership, and account-token binding again after asynchronous verification. A token changed during verification fails before any entitlement write. The reference orders each chain by signed evidence and observation time, ignores older state, and refuses to restore revoked access from contradictory evidence with the same signed version. Newer verified reversal evidence can restore only the remaining effective access period.

Membership is recomputed across the actor's stored verified subscription chains. An old chain's refund does not erase another legitimate active chain. All snapshots and ownership links must survive restarts. The production verifier, notification worker, and scheduled reconciliation must keep every relevant chain current; the in-memory ordering guard cannot repair missing Apple events or replace current-state verification. See [Apple / StoreKit integration](./APPLE_STOREKIT_INTEGRATION.md) for signature libraries, notifications, finishing transactions, restoration, and release scenarios.

## Idempotency and database transactions

`Idempotency-Key` is required on activity create/join/leave and direct invitation create. Use a new opaque key (for example, UUID) for a new user action; retain that key and exact request payload for a retry after an uncertain response. The reference limits keys to 1–128 trimmed characters and binds them to actor + operation. Reusing a key with a changed serialized payload returns `IDEMPOTENCY_CONFLICT`.

Authentication, current entitlement, recipient availability, and relevant activity permissions are rechecked before a cached response is returned. A replay after Plus expiry returns `PLUS_REQUIRED` even if the first request had succeeded. This does not undo the original activity/invitation; it prevents the cache from bypassing current permission. A successful retry causes no second mutation. Joining twice with different keys still counts one attendee; leaving twice removes at most one attendance.

The reference makes its checks and writes synchronously without an `await`, so a shared in-process store cannot oversubscribe a seat. This is **not** sufficient for multiple server workers. A production database implementation must execute authorization, idempotency lookup, uniqueness/capacity checks, the mutation, and idempotency-result persistence in one transaction. Concurrent retries must wait for or return the committed first result. Do not reserve the last seat using a frontend count or a separate unchecked `COUNT` and `INSERT`.

Recommended persistence invariants:

| Record | Required invariant |
| --- | --- |
| Account billing identity | Stable server-issued UUID; unique across accounts. Rotation/recovery is a server workflow. |
| Subscription chain | Unique `(environment, bundle_id, original_transaction_id)` with immutable `owner_user_id`; persist latest verified signed version, observation time, expiry/revocation and normalized state. |
| Verified transaction/event | Durable evidence and deduplication by transaction identity; deduplicate notification deliveries by notification UUID separately. Namespace sandbox and production. |
| Effective membership | Server-maintained projection from current verified chains; never writable through profile or client membership fields. |
| Match | One normalized user pair with authoritative current match status. |
| Block | Unique directional blocker/blocked pair; check both directions on reads and mutations. |
| Activity | Host references an existing user; capacity constraint 2–100; valid sport/time/status; lock this row during joins. |
| Activity attendee | Unique `(activity_id, user_id)`; foreign keys to activity and user; host membership inserted atomically on create. |
| Pending direct invitation | At most one pending sender/recipient pair. Transition elapsed pending invitations to `expired` inside the locked operation/worker before allowing another; do not use volatile wall-clock predicates as a uniqueness substitute. |
| Idempotency result | Unique `(actor_id, operation, key)` with request fingerprint, committed status/body and resource ID; store result atomically with side effects. |
| Delivery outbox | Invitation notification entry committed with its invitation, processed with deduplication and retries. |

Use appropriate row locks or serializable transactions for membership/block changes and capacity/duplicate checks. Verify failures roll back both resource and idempotency writes. If hosting is extended with edit/cancel endpoints, require `host_id === authenticated actor` on every mutation; no such edit/cancel route is currently implemented. The existing host cannot leave endpoint protects that invariant but does not substitute for future cancellation policy.

## Errors and client behavior

HTTP error envelope:

```json
{
  "error": {
    "code": "PLUS_REQUIRED",
    "message": "PACE Plus is required for this feature."
  }
}
```

`PaceApiClient` preserves `code`, `message`, and HTTP `status` on `PaceApiError`. It also accepts an unwrapped `{ code, message }` error. If a server returns non-JSON, it still rejects with `API_ERROR` and the HTTP status. A transport failure rejects without local fallback. Protected UI must not turn these failures into success or grant a temporary membership.

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Actor missing, disabled, or session invalid. |
| `PLUS_REQUIRED` | 403 | Required current entitlement is unavailable. |
| `HOST_VERIFICATION_REQUIRED` | 403 | Current actor must complete verified-host requirements before creating an activity. |
| `RECIPIENT_UNAVAILABLE` | 403 | Recipient missing, disabled, or blocked. |
| `ACTIVITY_NOT_FOUND` | 404 | Activity missing or hidden by a blocked host relationship. |
| `ACTIVITY_CLOSED` | 409 | Activity cancelled or already started. |
| `ACTIVITY_FULL` | 409 | No seat remains at mutation time. |
| `HOST_CANNOT_LEAVE` | 409 | Actor is the activity host. |
| `ALREADY_INVITED` | 409 | A future pending sender/recipient invitation exists. |
| `IDEMPOTENCY_CONFLICT` | 409 | Key reused for a different payload. |
| `VALIDATION_ERROR` | 400 | Missing/invalid field, unsupported sport, invalid time, or missing request key. |
| `APP_STORE_UNAVAILABLE` | 503 | No usable trusted Apple verifier/configuration. |
| `TRANSACTION_ACCOUNT_MISMATCH` | 403 | Billing token or original-chain ownership mismatch. |
| `TRANSACTION_INVALID` | 403 | Returned verification state fails binding, completeness, or freshness checks. |
| `API_ERROR` | Response status | Transport adapter fallback for an unstructured server error. |

Do not expose verifier exceptions, signing secrets, raw transaction JWS, account tokens, stack traces, or database errors in public error responses. A deployed route should map expected verifier failures to `TRANSACTION_INVALID` and transient Apple/network failures to a retryable 503; it must not update entitlement on failure.

## Verification

`node engagement_test_cases.mjs` exercises authorization spoofing, expiry/revocation/cancellation, blocked and matched recipients, duplicate and cached requests, DTO privacy, activity ownership/capacity, unknown actors, Apple current-state binding and replay, account-token rotation, multiple subscription chains, and HTTP failure behavior. These are reference-policy/transport tests, not evidence that an Apple sandbox purchase or deployed database integration has run successfully.

Before production, run the same policy cases through actual HTTP authentication and the real database using concurrent clients and restarted workers. Add signed native StoreKit/sandbox lifecycle cases from the Apple integration document and recipient-side delivery/acceptance tests once those routes exist.

Hosting requires both active Plus and server-owned `actor.verified === true`, including cached request replay. The client cannot supply this flag.
