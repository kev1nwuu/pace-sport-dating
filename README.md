# PACE sport-dating prototype

PACE is a mobile-first browser prototype for meeting people through a shared active lifestyle. The runtime uses plain HTML, CSS, and native JavaScript modules; Playwright is the only development dependency.

**New collaborators and Codex agents: start with [PROJECT_HANDOFF.txt](./PROJECT_HANDOFF.txt).** It contains the Chinese handoff covering product decisions, current design, prototype limitations, architecture, security, tests, and collaboration rules. [AGENTS.md](./AGENTS.md) routes agents to the relevant files. Backend implementation remains gated on Kevin reviewing the backlog/test cases and explicitly authorizing it; this repository handoff does not start that work.

Read [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) alongside the handoff: some early visual descriptions and onboarding constraints differ from later decisions. Current audit deliverables are the [18-module backend backlog and 62 acceptance cases](./docs/BACKEND_AUDIT_DRAFT_2026-09-26.md) and [68 frontend test scenarios](./docs/FRONTEND_TEST_PLAN_2026-09-26.md). These are test specifications, not a claim that production integration has passed.

## Run and verify

Prerequisites: Node.js 20+ and Python 3.

```sh
npm ci
npx playwright install chromium
npm start
```

In a second terminal:

```sh
npm run verify
```

Open <http://127.0.0.1:4173>, rather than opening `index.html` via `file://`. The verification command runs syntax checks, domain and API-contract tests, real-browser journeys, accessibility contracts, and visual regression snapshots. Existing visual baselines are macOS (`darwin`) only; other platforms need deliberately reviewed platform baselines. Do not bulk-accept new screenshots simply to make the suite green.

The current suite has 20 production syntax checks, 94 Node checks, and 36 browser test declarations. Recent scoped checks and their limits are recorded in the handoff and `design-qa.md`; the full E2E suite has not been rerun for release 58. A passing local reference test does not prove deployed authentication, payments, persistence, or real-device behavior.

Historical verified baseline (2026-09-08): 13/13 production-module syntax checks, 29/29 domain/repository/photo/API/localization/cache-contract tests, and 21/21 browser/accessibility/offline-asset/responsive/visual tests.

## Architecture

```text
index.html
   │
   ├── styles.css ── ordered imports from styles/
   │
   └── app.js ───── application composition, discovery, navigation, localization
          │
          ├── features/onboarding.mjs ── account setup workflow
          ├── features/chat.mjs ──────── chat and training invitations
          ├── features/moments.mjs ───── connected feed UI and operations
          ├── features/account.mjs ───── profile and settings UI
          ├── features/membership.mjs ── Plus, billing and direct invitations
          ├── features/train.mjs ─────── activities, details and hosting
          ├── features/storekit_bridge.mjs ── native StoreKit boundary
          └── pace_repository.mjs ────── stable application data interface
                    ├── local adapter ─── deterministic prototype data
                    └── HTTP adapter ──── api_client.mjs → /api/v1

Pure domain modules:
  app_logic.mjs · sport_catalog.mjs · connection_feed.mjs · engagement_service.mjs
```

Dependency direction is one-way: feature modules use the repository interface; the repository selects local or HTTP infrastructure; pure domain modules never import browser DOM or transport code. Localized labels are presentation data, while stable sport IDs are persisted and sent to APIs.

The root stylesheet declares local fonts and imports feature styles in explicit cascade order:

1. `styles/base.css`
2. `styles/discovery.css`
3. `styles/activity.css`
4. `styles/onboarding.css`
5. `styles/conversation.css`
6. `styles/train.css`
7. `styles/membership.css`

Add a rule to its owning feature file. Do not append general overrides to `styles.css`, reorder imports, or introduce a new cross-feature selector without a visual-regression test.

## Backend integration

The app uses the local repository by default:

```html
<meta name="pace-data-adapter" content="local" />
```

Change the value to `http` only after the compatible authentication, discovery, connection-feed, and profile endpoints are available. Those covered UI features do not need to change: both adapters implement `authenticate`, `restoreSession`, `completeOnboarding`, `signOut`, `discover`, `listFeed`, `setPostLike`, `addComment`, `publish`, and `saveProfile`. `PaceApiClient` owns `/api/v1` URLs, JSON headers, encoding, and transport errors; its request contract is tested in `contract_test_cases.mjs`.

Returning users pass through the loading screen to Discovery after a successful session check. The local preview remembers only a versioned, 30-day demo-session marker in injected browser storage; no credentials, profiles, or membership are stored by that marker. HTTP mode checks `GET /auth/session` with server credentials and never trusts the preview marker. [Session restoration and production handoff](./docs/AUTH_SESSION.md) documents expiry, logout, retry behavior, the authenticated onboarding-completion contract, and the remaining native session work.

The adapter now also covers membership, incoming likes, direct invitation eligibility/submission, public activities and Apple billing context/transaction ingestion. [Engagement API contracts](./docs/ENGAGEMENT_API.md) describe those operations. The local reference service enforces the same policy for preview/testing; a deployed authenticated backend remains necessary.

The adapter switch does **not** yet cover account creation, OAuth exchange, session refresh, discovery decisions and match creation, realtime chat, recipient invitation responses, notifications, Apple signature/notification processing, verification/fitness connections, account deletion, or the completed media-upload flow. The session-check and onboarding-completion contracts do not provide a deployed authentication backend. Define the remaining server contracts and add them behind the same repository boundary before enabling the HTTP adapter for the full app. The current integration gate and verified rollout order are documented in [BACKEND_READINESS.md](./BACKEND_READINESS.md); the final standards and maintainability review is in [CODEBASE_HEALTH.md](./CODEBASE_HEALTH.md), and the user-journey evidence is in [UX_AUDIT_2026-09-08.md](./UX_AUDIT_2026-09-08.md).

This repository still does not provide the server, database, authentication, payment provider, or media storage. Before production rollout, implement and publish an OpenAPI contract for the client endpoints and enforce authentication, authorization, mutual-like rules, visibility, rate limits, upload validation, deletion, and marketing suppression on the server. Client-side checks are not security controls.

## Development standard

For every feature or UI adjustment:

1. Put product invariants in a DOM-independent domain module and test them first.
2. Add UI behavior inside the owning `features/` module; keep `app.js` as composition and navigation.
3. Access data only through `pace_repository.mjs`; never call `fetch` from a feature.
4. Update contract tests when an API path, payload, locale key, or stable ID changes.
5. Update a Playwright journey for user-visible behavior and a snapshot for visual changes.
6. Preserve accessible names, labeled controls, modal focus/inert behavior, keyboard escape behavior, and reduced motion.
7. Run `npm run verify` before review. Update snapshots intentionally with `npm run test:e2e:update`, then inspect the changed PNGs.

Generated Playwright reports and failure artifacts are ignored; visual baselines under `tests/e2e/visual.spec.mjs-snapshots/` are source-controlled quality gates.

## Plus and Train integration (2026-09-13)

The default preview account is free. Public activity browsing/joining are free; an unmatched invitation requires Plus, and hosting requires Plus plus verified host status. No browser storage flag or native purchase callback grants membership. The sample activity schedule is generated in `features/activity_seed.mjs` and is never substituted when HTTP mode fails.

Purchase and restoration are wired through a validated native bridge and server transaction ingestion. This repo has no native iOS target, real StoreKit adapter, Apple credentials, signed-JWS verifier, or deployed subscription webhook. Configure these using [the Apple integration handoff](./docs/APPLE_STOREKIT_INTEGRATION.md). Prices come from the StoreKit product catalog after it is connected.

Scoped verification and screenshots for this change are recorded in [design-qa.md](./design-qa.md). The independent [member UI fixture](./tests/fixtures/engagement-preview.html) uses an explicitly seeded test repository to verify premium and expired states; it does not change the main app's account or entitlements.
