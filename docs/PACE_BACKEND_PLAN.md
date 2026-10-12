# PACE backend execution plan

Planning date: 2026-10-11. This document organizes future work; it does not implement or deploy a backend.

## Confirmed scope

- Launch on iPhone and Android together.
- First release: free onboarding, profiles, discovery, mutual matching, and persistent chat.
- Defer Plus, unmatched invitations, Moments, public activities, and fitness integrations. Do not expose purchase actions or misleading connected states in this release.
- Launch market and languages: deferred by the user. Do not assume Toronto or the prototype's language defaults.
- Confirmed on 2026-10-11: age 18+; trusted selfie verification required before public visibility, Likes and chat.
- Safety, privacy, account deletion, verification policy, and operational readiness remain release requirements even for a free release.

## Evidence and boundaries

The inspected repository is a browser prototype. It has a local/HTTP repository interface and reference tests, but no application server, database, real authentication, or native iOS/Android targets. Existing syntax and Node reference checks passed during intake; browser, backend, and physical-device acceptance have not been established.

Sources: AGENTS.md; PROJECT_HANDOFF.txt; docs/BACKEND_AUDIT_DRAFT_2026-09-26.md (B01–B18, BE-01–BE-62); api_client.mjs; pace_repository.mjs. The roadmap reuses these identifiers. Acceptance cases are specifications, not passing backend evidence.

## Delivery sequence

| Step | Work and concrete deliverable | Prerequisites / decisions | Acceptance gate |
| --- | --- | --- | --- |
| 0 | Record release scope, a decision register, a feature access matrix, and a trimmed release checklist. | Confirmed scope above; leave deferred decisions explicitly open. | Every visible first-release action maps to a real service; deferred features have a removal/hiding plan. |
| 1 | Design the API and data model: OpenAPI under `/api/v1`, private/public profile schemas, canonical IDs, errors, pagination, permission rules, and state transitions. Produce an architecture decision record comparing implementation options and costs. | Session/client approach, minimum-age policy, verification access rules, profile requirements, Like quota/reset rules. Market can remain open for design, but region-dependent provider decisions stay provisional. | Reviewable schemas and test matrix exist; existing client paths are retained where suitable, and additions are clearly identified. B01/B02/B04; BE-01 and BE-61 cross-cutting. |
| 2 | Establish the server, persistent database, versioned migrations, synthetic fixtures, CI, health checks, staging configuration, secret handling, and structured redacted logs. Establish durable event/outbox and worker foundations. | Agreed runtime/database/hosting plan; any external account or paid resource setup handled separately. | Clean setup and migrations are reproducible; database-backed integration tests run in CI; service restart preserves records. B01/B17; BE-01, BE-60–61. |
| 3 | Implement registration, verification/recovery, login, session restore/renewal, device sign-out and revoke-all. Add Google/Apple sign-in if retained in the release UI. | Account-linking and session policies; approved provider configuration for each mobile client. | Real identity persists across restart/devices; invalid tokens and reused links fail; revoked sessions cannot act; throttling and retries work. B02; BE-02–08. |
| 4 | Implement private/public profile reads, draft onboarding, profile updates, preferences, accepted policy versions, and conflict handling. Final onboarding completion remains gated on eligible media and verification policy. | Required fields, minimum age, optional-field visibility, bio/sports constraints. | Owner data restores on a second device; public APIs omit hidden/private fields; incomplete users cannot bypass access rules. B03/B04; BE-09–12. |
| 5 | Implement upload grants, ownership checks, decoded-content validation, photo ordering/focal points, thumbnails, metadata stripping, moderation status, and orphan cleanup. | Storage/moderation choice; size/dimension limits and retention policy. | Up to six eligible photos; foreign media, corrupt files and blob URLs rejected; no public precise-location metadata; interrupted uploads clean up safely. B05; BE-13–17. |
| 6 | Complete onboarding eligibility and authoritative verification state. Build blocking, reports, unmatching, administrator access, and audit trail. Implement immediate deactivation/session revocation and deletion/export/consent workflows. | Verification timing/provider, report operator and escalation process, retention/deletion policy. These decisions must be resolved before external-user access. | Forged badges fail; blocks apply in both directions; reports are traceable; deletion revokes access immediately and cleanup is retryable. B12/B13/B14; BE-52–57; exercise BE-23/27 again after discovery/chat exist. |
| 7 | Implement discovery using real candidates, geographic/preference filtering, pagination, Like/Pass records, server quotas, and atomic mutual match/conversation creation. | Eligible profiles/media/safety state; confirmed distance and Like policies. | One-sided Like creates no match; simultaneous reciprocal Likes create exactly one match/conversation; empty results are honest; blocked/deleted users are excluded. B06; BE-18–23. |
| 8 | Implement authorized conversation lists, persistent message history, idempotent sends, read cursors, unread counts, realtime updates, and reconnect catch-up. | Real matches; transactional permission checks; agreed content/attachment limits. | Restart/offline recovery loses no committed messages; retries create no duplicates; strangers and blocked users cannot read/send; cursors stay consistent across devices. B07; BE-24–27. |
| 9 | Implement transactional notifications: durable outbox processing, retry/deduplication, preferences, APNs and Android push-provider integration, device-token binding and authorized deep links. | Events committed by matching/chat; mobile application identity and provider configuration. | Account switching cannot leak another account's notifications; failed delivery does not lose messages; events are delivered without duplicate user-visible notifications. B15; BE-58 plus added Android/device-token and duplicate-delivery tests. |
| 10 | Integrate real API flows through the repository interface, replace fixed demo identities and messages, and handle loading/empty/error/retry states. Choose and build the mobile client approach for both platforms; retire deferred entry points and demo badges. | Native versus hybrid strategy still pending; no native targets currently exist. Integrate each completed backend slice incrementally before this final end-to-end pass. | Separate real accounts complete onboarding → discovery → mutual match → chat on both platforms; no HTTP failure falls back to demo data. Client browser tests and new iOS/Android journeys cover failures as well as success. |
| 11 | Complete release acceptance: staging multi-account journeys, device/network/background tests, load/recovery checks, backup restore drill, monitoring, rollback, and store submission prerequisites. | Market/languages, capacity/budget/SLO, support owner, policy texts and platform requirements resolved. Publication requires an explicit release instruction. | Evidence for both mobile platforms, approved performance targets, recovery and operational ownership; no claim of readiness based only on reference unit tests. B17/B18; BE-60–62 plus platform-specific cases. |

Infrastructure, safety checks, client integration, and observability are maintained throughout the sequence. Step 6 completes their workflows before real-user testing; it is not the first point at which authorization is enforced. Step 9 adds push delivery; the outbox is established earlier so committed events remain durable.

## How each work item is executed

1. Define observable success, failure, permissions, and retry outcomes.
2. Write failing HTTP/database integration tests with synthetic accounts and controlled time.
3. Implement the smallest complete service slice and versioned schema changes.
4. Integrate its UI path through pace_repository.mjs and api_client.mjs.
5. Verify real persistence, denied access, retries and concurrency where relevant.
6. Deliver a scoped branch/PR with test evidence, migration impact, and unresolved limits. Record the result before moving to the next dependent slice.

Task status vocabulary: Planned → Ready → In progress → In review → Accepted; Blocked requires a named dependency. Each task records its step/Bxx identifier, owner, prerequisites, API/schema changes, acceptance cases, evidence, and remaining decisions. No dates or effort estimates are committed before the implementation/client approach and delivery capacity are known.

## Decisions staged by dependency

- Before Step 1 is finalized: mobile client strategy; minimum age and eligibility; verification timing; required profile fields; bio/sports constraint conflicts; Like quota/reset policy; session and account-linking rules. Technical choices are explained in an architecture decision record before adoption.
- Before providers/infrastructure are committed: budget, region/data placement, anticipated scale, email/media/verification providers and credentials.
- Before Step 6 is accepted: report handling owner, response/escalation process, evidence access and retention/deletion policy.
- Before release acceptance: market/languages, supported OS/device versions, performance targets, support destinations and approved policy text. Recheck current official platform requirements at that point.
- Later expansion: subscription products and purchase policy; unmatched-invitation acceptance semantics/quotas; activities and Moments scope. These do not block the free core design.

## Deferred backlog

B08 invitations, B09 Moments, B10 activities, B11 subscriptions and B16 fitness integrations are deferred. If matched activity invitations remain visible, either defer that UI too or explicitly expand scope and implement B08's matched path; a success toast is not a completed invitation.

BE-28–51 and BE-59 remain deferred as release features, with their existing specifications preserved for later work. Paid entitlement behavior and Apple Sandbox purchase tests are not required for a release with no purchases. Future Android Plus needs a separate Google Play billing design and acceptance suite; existing Apple-only cases do not cover it.

All other audit cases are retained, adapted to the free scope where necessary. Add explicit Android coverage, mobile secure-session storage, realtime authorization, native lifecycle and notification integration cases; the existing 62 cases are not a complete dual-platform mobile acceptance suite.

## First concrete work package

Produce the Step 0 scope/access matrix and the Step 1 draft API/data model, decision register, and integration test inventory. Review those concrete artifacts and resolve their blocking product choices before server implementation begins. The user's current request authorizes organization and planning; this delivery contains no backend implementation or deployment.
