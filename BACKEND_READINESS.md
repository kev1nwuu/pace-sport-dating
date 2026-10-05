# PACE backend integration readiness

**Latest handoff — 2026-10-04:** Start with [PROJECT_HANDOFF.txt](./PROJECT_HANDOFF.txt) and the [backend audit, backlog and test cases](./docs/BACKEND_AUDIT_DRAFT_2026-09-26.md). The counts and completed checks below are historical. Backend implementation requires Kevin's explicit instruction after review; the current repository remains a local prototype, not a launch-ready service.

**Reviewed:** 2026-09-08  
**Status:** Frontend baseline verified and ready for staged backend integration. Public production launch remains blocked on server-owned authentication, persistence, realtime, billing, safety, and observability.

## Plus and Train update — 2026-09-13

The 2026-09-08 baseline below is historical. This update adds a DOM-independent `engagement_service.mjs` reference policy, typed API errors, and local/HTTP repository contracts for Plus status, protected incoming likes, direct invitations, activity listing/details/join/leave/create, and Apple transaction ingestion. The UI now uses these contracts.

[Engagement API handoff](./docs/ENGAGEMENT_API.md) provides exact DTOs, routes, authorization and database requirements. [Apple handoff](./docs/APPLE_STOREKIT_INTEGRATION.md) describes StoreKit, purchase/restore/manage, current-state verification and Notifications V2. No native iOS application, actual Apple verifier, webhook deployment or persistent production service is included. The local preview is explicitly free and cannot grant membership from a purchase callback.

The service is executable reference code for authenticated server handlers and a local preview, not a security boundary when run in a browser. Actual production enforcement requires session-derived identity and database transactions. Recipient invitation acceptance/decline, notification delivery and conversation creation remain separate backend workflows; sending an invitation only creates a pending record.

## Historical verified frontend baseline

- All 13 production JavaScript modules pass syntax validation.
- Domain, repository, photo-presentation, localization, cache-stamp, and HTTP-contract suites pass: 29/29.
- Browser journeys, accessibility contracts, offline-asset checks, responsive containment, and visual regressions pass: 21/21.
- Discovery is protected at 320 px and 480 px widths with no horizontal overflow or clipped athletic summary.
- The complete user journey was also exercised manually: returning login, photo gallery, filters/empty state, match, chat, invitation, connected profile gallery, feed likes/comments/publishing, Train, profile edit/preview/save, settings, privacy, billing, notifications, localization, and Home navigation.
- Feature code does not call `fetch` directly. Transport stays behind `PaceApiClient` and `pace_repository.mjs`.
- Stable sport IDs, not translated labels, are used for persistence and API requests.
- Fonts, profile photos, feed images, and decorative assets are served locally; core visuals do not depend on third-party runtime requests.
- Repository-backed discovery, profile, like, comment, and publishing actions now recover from request failures without leaving controls stuck in a loading state.
- Static asset and module cache stamps are consistent across the complete production import graph.

## Current dependency direction

```mermaid
flowchart TD
  HTML[index.html] --> APP[app.js composition root]
  APP --> FEATURES[feature modules]
  APP --> REPO[pace_repository.mjs]
  FEATURES --> DOMAIN[domain and catalog modules]
  FEATURES --> REPO
  REPO --> DOMAIN
  REPO --> API[api_client.mjs]
  API --> SERVER[/api/v1]
```

The direction is one-way. `app.js` is the composition root, feature modules own UI behavior, domain modules stay independent of the DOM and transport, and the repository selects local or HTTP infrastructure. No circular production-module dependency was found.

## HTTP seam already covered

| Frontend operation | HTTP contract |
|---|---|
| Log in | `POST /api/v1/auth/login` |
| Restore login on app launch | `GET /api/v1/auth/session` |
| Confirm completed onboarding for an authenticated signup session | `POST /api/v1/auth/onboarding/complete` |
| Log out | `POST /api/v1/auth/logout` |
| Discover candidates | `GET /api/v1/discover` |
| Load connection feed | `GET /api/v1/connections/feed` |
| Like/unlike a feed post | `PUT /api/v1/connections/feed/{postId}/like` |
| Add a feed comment | `POST /api/v1/connections/feed/{postId}/comments` |
| Request feed-media upload | `POST /api/v1/connections/feed/media-uploads` |
| Publish a feed post | `POST /api/v1/connections/feed` |
| Save profile | `PATCH /api/v1/me/profile` |

## Contracts required before switching the full app to HTTP

1. Complete authentication and account creation, including session refresh, server-owned age eligibility, and the request/response schemas for the login/logout endpoints. The frontend now restores a valid session during the launch screen and handles expired sessions and retryable errors; deploy the session and onboarding-completion routes described in [AUTH_SESSION.md](./docs/AUTH_SESSION.md). The preview marker does not replace server authentication or native credential storage.
2. Discovery decisions and mutual-match creation. A match must be created by the server only after a real reciprocal decision.
3. Match lists, conversations, message delivery, unread state, and training invitations. Choose polling, SSE, or WebSocket semantics before implementing the client port.
4. Deploy the new subscription contracts with a real Apple verifier, durable state, lifecycle notifications and native StoreKit adapter. The reference entitlement implementation and client seams are present; production operation is not.
5. Account deletion and privacy/export operations, including async deletion status where required.
6. Media upload completion, validation, ordering, focal-point metadata, deletion, and durable public URLs.
7. Notification delivery and unread-state contracts. The current notification surface intentionally shows an empty text-only state.

Do not invent these URLs in UI modules. Add each operation to `PaceApiClient`, expose it through the repository interface, then inject it into the owning feature.

## Required server guarantees

- Publish an OpenAPI contract and validate both request and response bodies.
- Enforce authentication, resource ownership, connection visibility, mutual-like rules, and subscription entitlements server-side.
- Add rate limits and abuse controls for login, decisions, messages, comments, uploads, and verification attempts.
- Validate file type, decoded content, size, count, and image dimensions; scan uploads before making them available.
- Use idempotency for decisions, publishing, invitations, subscription changes, and destructive account operations.
- Return a stable error envelope with a machine code, safe message, field errors where relevant, and a request ID.
- Add session token/cookie handling, request timeouts/cancellation, a typed error envelope, and request IDs to the client before the HTTP adapter becomes the default.
- Add structured logs, metrics, traces, alerting, backup/restore drills, and incident ownership on the server.
- Keep secrets, provider keys, payment verification, moderation rules, and authorization decisions off the client.

## Recommended integration order

1. Freeze and publish the OpenAPI schemas plus the common error envelope.
2. Implement server authentication/session handling behind the existing `PaceApiClient.authenticate` and `PaceApiClient.signOut` seams.
3. Connect profile and discovery reads, then run the existing contract and browser suites against a test server using seeded data.
4. Connect decisions/matches, then chat and training invitations.
5. Connect feed writes and the complete media-upload lifecycle.
6. Connect billing, privacy, deletion, and notification delivery.
7. Add a CI job that runs the same syntax, domain, contract, browser, accessibility, offline-asset, and visual gates used locally.
8. Complete security/privacy review, production monitoring, rollback, backups, legal copy, abuse reporting, and app-store/web deployment checks.

Keep `<meta name="pace-data-adapter" content="local" />` until authentication and the first server-backed read/write flows pass in a non-production environment. Switching this one value today would connect only the nine operations in the table; it would not make account creation, match, chat, billing, verification, or deletion flows real.
