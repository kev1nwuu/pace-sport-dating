# PACE free-core backend design — review draft

Date: 2026-10-11. Stage: Steps 0–1, contract and data design. No server, database migration, provider integration, or deployment has been executed.

## Confirmed decisions

- iPhone and Android launch together.
- Free onboarding, profiles, discovery, mutual matching and text chat are the initial product scope.
- Plus, incoming-like premium views, purchases, structured invitations, Moments, public activities and fitness integrations are deferred. Ordinary matched chat can be used to make plans.
- Minimum age: 18. The server computes eligibility from a private date of birth and a defined calendar policy; a client-supplied age is never authoritative.
- Selfie verification is required before appearing to other people, liking or chatting. Draft profile editing, uploads, verification retries, settings, reporting/blocking and account deletion remain available to restricted accounts. Verification is a server/provider result.
- Market/languages remain deferred. Do not preselect a hosting region or launch-language list.

## Access matrix

| Actor state | Permitted | Denied |
| --- | --- | --- |
| Anonymous | Registration, login, verification/reset-link redemption | Private profiles, discovery, matches, messages, uploads |
| Signed in, email not verified or onboarding incomplete | Own profile draft, email flow, eligible uploads, selfie flow, settings and deletion | Discovery, public visibility, Likes, match creation and chat |
| Profile complete, selfie pending/rejected/expired | Own profile, verification retry, safety/settings/deletion | Public visibility, discovery/Like/chat; proposed discovery restriction follows the conservative verification gate |
| Active, age eligible, email verified, onboarding complete, selfie verified | Free discovery, Like/Pass, mutual-match chat and safety/account tools | Stranger chat; any deferred product action |
| Blocked relationship or ended match | Own account tools, report/block/unmatch as applicable | Discovery visibility and new chat writes between the pair; history retention visibility still needs a policy |
| Banned or deleting/deleted | Dedicated restricted support/deletion-status access when permitted | Normal authenticated business operations and discoverability |
| Moderator | Only assigned moderation resources, through separate administrative authorization | Unrestricted general user-data access |

Public-profile reads require an authorized context: an eligible discovery candidate or permitted active match. An arbitrary known user ID never grants access. Precise location, date of birth, email, authentication data and hidden height/ethnicity are never public fields.

## Architecture proposal

Use a single modular backend service with an independently runnable background worker and one transactional relational database. Keep account, profile/media, trust/safety, discovery/matching, chat and notification modules separate inside the service. Do not start with microservices.

Proposed implementation: TypeScript on Node.js, Fastify for the HTTP layer, PostgreSQL for persistence, and private object storage for media. This is a technical proposal, not an installed or deployed stack. Fastify documents request validation and response serialization through schemas ([official documentation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)). PostgreSQL documents constraints and isolation mechanisms useful for transactional consistency ([constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [isolation](https://www.postgresql.org/docs/current/transaction-iso.html)). These capabilities still require correct transaction design and concurrency tests.

| Approach | Benefit for this project | Tradeoff |
| --- | --- | --- |
| Modular Node/Fastify + PostgreSQL service (proposed) | Familiar JavaScript ecosystem; explicit domain rules, API contracts and transactions | Team owns authentication/security integration, workers, deployment and recovery |
| Managed auth/database/storage with an application service | Less initial infrastructure and potentially faster provider setup | Provider limits/costs and authorization integration must be reviewed; client access cannot bypass domain transactions |
| Separate services from day one | Independent deployment boundaries | More failure modes and operational work before a demonstrated need |

Choose exact versions, hosting, ORM/query layer, email/verification/storage providers and prices at implementation setup after checking supported releases and budget. Costs include compute/database, storage/egress, email, verification checks, monitoring and store accounts; no numerical estimate is justified yet. Native versus hybrid clients remain open. Preserve the current browser prototype and repository/API boundary; client strategy must be chosen before building the two mobile clients.

Decision record ADR-001: Proposed. Rationale: mutual matches, quota consumption, messages and committed events need explicit consistency; one service keeps these transactions reviewable. Reversal: preserve OpenAPI/domain interfaces, replace infrastructure adapters deliberately; portability still requires real data/credential migration work. Do not assume provider-managed identities can be moved without user impact.

## Logical database model

This is a logical relational design, not executable SQL or an applied migration. IDs are opaque canonical server IDs, never display names or demo IDs. Store timestamps as UTC instants; calendar fields such as date of birth remain dates. Exact location lives in a private access-controlled relation.

| Relation | Main fields | Required keys / rules |
| --- | --- | --- |
| users | id, status, created_at, deactivated_at, deleted_at | PK id; status active/banned/deleting/deleted; deletion immediately removes eligibility |
| auth_identities | id, user_id, provider, provider_subject, normalized_email, email_verified_at, password_hash | FK user; unique provider+subject; reviewed normalized-email ownership/linking policy; no plaintext secrets |
| sessions | id, user_id, client_type, credential_hash, family_id, expires_at, revoked_at | FK user; unique credential hash; device/family rotation and revocation; do not log credentials |
| auth_challenges | id, user_id, kind, token_hash, expires_at, consumed_at | Unique token hash; single-use verification/reset, atomically consumed |
| profiles | user_id, version, display_name, birth_date, city, identity, intent, bio, height_cm, ethnicity, show_height, show_ethnicity, weekly_frequency | PK/FK user; version >= 1; owner-only birth_date; nullable optional fields; no invented minimum bio length or maximum sport count |
| profile_locations | user_id, private_coordinates, updated_at, source | PK/FK user; private; coarse public distance derived on authorized reads; location source/precision policy pending |
| sports / profile_sports | sport_id; user_id, sport_id | Catalog stable IDs from sport_catalog.mjs; composite user+sport uniqueness; custom-sport handling pending |
| profile_photos | user_id, media_id, position, focal_x, focal_y | Unique user+position and user+media; positions 0–5; enforce six-photo limit and ownership transactionally |
| discovery_preferences | user_id, version, distance_km, sport_ids, goal, schedule, additional_preferences | One per user; positive distance; only approved preference fields; referenced stable sports |
| media_assets | id, owner_id, purpose, object_key, state, actual_mime, size_bytes, created_at | FK owner; unique object key; uploading/processing/ready/rejected/deleting; moderation/ownership before binding |
| verification_sessions | id, user_id, provider_ref, state, verified_at, expires_at | Unique provider ref; none/pending/verified/rejected/expired state; trusted callbacks only; sensitive evidence separate with retention |
| provider_events | provider, external_event_id, digest, processed_at | Composite unique key; signature verification before state change; duplicate/replayed events safe |
| like_decisions | actor_id, target_id, decision, created_at | Composite unique pair; no self-Like; like/pass; unlike/re-Like behavior pending |
| quota_buckets | user_id, action, window_start, used_count, policy_version | Composite unique bucket; atomically consume under confirmed quota policy; no prototype-derived quota |
| matches | id, user_low_id, user_high_id, state, created_at, ended_at, ended_by | Unique canonical ordered pair; no self-match; active/ended; proposed no automatic reactivation after unmatch |
| conversations | id, match_id, next_sequence | Unique FK match; two-party membership derived from match; only authorized active pair may write |
| messages | id, conversation_id, sender_id, client_message_id, sequence, text, created_at | Unique conversation+sequence and conversation+sender+client_message_id; canonical immutable result on retry |
| read_cursors | conversation_id, user_id, read_sequence | Composite unique key; member-only, monotonic, no higher than committed visible sequence |
| blocks | blocker_id, blocked_id, created_at | Composite unique pair; no self-block; either direction restricts relationship |
| reports / moderation_actions | id, reporter_id, target_type, target_id, reason_code, restricted_evidence_ref, state; moderator_id, action, audit_time | Authorization on referenced evidence; controlled moderator role; reporter identity hidden from reported person |
| policy_acceptances / consents | user_id, policy_type, version, accepted_at; user_id, purpose, granted_at, withdrawn_at | Explicit versions; marketing off without opt-in; recheck consent before delivery |
| deletion_jobs / export_jobs | id, user_id, state, attempts, next_attempt_at, deadline, error_code | Durable retries; immediate deactivation separate from asynchronous cleanup; export only requester-authorized data |
| device_tokens | id, user_id, session_id, platform, token_ciphertext, token_digest, invalidated_at | Unique active token binding; account switch atomically rebinds; iOS and Android explicit |
| outbox_events / notification_deliveries | id, kind, aggregate_id, aggregate_version, recipient_id, created_at; event_id, device_id, state, attempts | Event committed with business transaction; unique event+recipient/channel delivery key; durable retry/recheck recipient authorization |
| idempotency_records | actor_id, operation, key, request_digest, result_ref, expires_at | Unique actor+operation+key; changed payload conflicts; authentication and current resource permission checked on replay |

Cross-table eligibility, photo count, reciprocal Likes and conversation membership require service transactions; foreign keys alone do not enforce them. Retained report evidence and surviving peer messages need a deletion/retention decision before production migrations are finalized.

## Critical transactions

**Mutual Like:** lock a persistent canonical user-pair guard (create/upsert guard before locking; locking a nonexistent Like is insufficient); recheck eligibility/blocks; consume the actor quota atomically; save the decision; read reciprocal Like; create the unique match and conversation and outbox events in one transaction. Handle serialization/deadlock retries with a bounded policy. Pair locking ensures concurrent first Likes cannot both miss the other. Block/unmatch/ban operations share an explicitly documented lock order with these writes.

**Message:** resolve authenticated sender, lock/recheck active pair and conversation, validate text, use sender-scoped client_message_id, allocate sequence, persist message and outbox event atomically. Same key plus changed text returns conflict; lost ACK retry returns the existing message only if currently authorized. A message may commit before a concurrent block; after a block has committed no new message may commit. Revoke realtime subscriptions and recheck outbound delivery authorization.

**Profile/photo update:** compare version; validate only allowlisted fields and ownership; lock profile while enforcing six eligible photo bindings; update and increment version atomically. Late processing results cannot publish quarantined or deleting media.

**Delete:** mark deleting, revoke all sessions, remove discovery eligibility, suppress marketing and enqueue cleanup in one transaction. Cleanup remains restartable. Separate restricted deletion-status credentials are proposed; ordinary revoked sessions cannot read private data.

## API and frontend compatibility

See PACE_CORE_API_DRAFT.json for the OpenAPI draft. Common protocol: HTTPS JSON under `/api/v1`, non-cacheable private/session responses, UTC timestamp strings, opaque IDs and signed scoped cursors. Proposed pagination limit is 20 by default, capped at 100; technical bounds are proposals. Reject unknown request fields; no actor/author/verified/membership input is trusted.

Web proposal: HttpOnly secure session cookie plus CSRF protection on state-changing cookie requests. Native proposal: short-lived bearer access credential plus rotated refresh credential in OS secure storage. Separate native exchange/refresh endpoints prevent browser JSON responses from exposing refresh credentials. Cookie name/header, credential lifetimes, refresh race window and bridge approach remain design decisions. Mixed cookie/bearer identity requests should be rejected. Tokens never go in URL query strings or browser localStorage.

| Current contract | Draft handling / required client change |
| --- | --- |
| POST /auth/login; GET /auth/session; POST /auth/logout | Preserve paths; keep literal authenticated:true session result. Formalize login payload and add signup/email/native flows. |
| POST /auth/onboarding/complete | Preserve body-free request and authenticated:true result; server loads saved draft/media/verification and validates eligibility. |
| PATCH /me/profile | Preserve path; replace prototype field shapes/blob photos with allowlisted canonical fields/media IDs and explicit version. Add GET /me/profile. |
| GET /discover with distance_km/sport_id/goal/schedule | Preserve filters/path; keep state/candidates result, add next_cursor and canonical public profile fields. Proposed empty state is empty; adapt old waitlist state explicitly. |
| Discovery card/Like action | Render actual candidate IDs/photos and call decision API; remove immediate demo Match. New repository methods required. |
| Chat/Profile UI | Load canonical conversation/member/history; add send/read/reconnect operations; remove sample messages and fixed IDs. |
| Startup membership calls / Plus / Community / Train / invite / fitness badges | Remove or gate deferred entry points and unnecessary startup requests before switching to HTTP. Main prototype currently requests more than free-core APIs. |

No current frontend adapter is switched. The draft is not drop-in compatible; integration needs scoped client changes and tests. `/sports` remains a catalog contract; Plus/feed/activity endpoints are omitted deliberately.

Errors use `{error:{code,message,fieldErrors,requestId,retryable}}`. 401 means missing/invalid credentials; 403 means known eligibility/role denial; unrelated private object IDs return a consistent 404 without existence disclosure; 409 handles version/idempotency conflicts; 422 handles semantic validation; 429 includes Retry-After; 503 is retryable infrastructure failure. Message is human-readable fallback; clients localize stable codes.

## Open decisions and next work

| ID | Decision | Proposed treatment | Blocks |
| --- | --- | --- | --- |
| D01 | Native or hybrid phone clients | Compare effort, secure credential handling, camera/verification, push and maintenance; current HTML remains reference | Mobile implementation and native auth bridge |
| D02 | Required profile fields and identity/intent/preference vocabulary | Display name, private DOB, city, >=1 catalog sport, >=1 eligible photo; optional identity; no minimum bio length | Final onboarding schemas and matching filters |
| D03 | Like quota and reset rule | Configured server policy; no hardcoded 12 from prototype | Quota acceptance tests |
| D04 | Verification provider, validity and retry handling | Mandatory gate confirmed; provider details open | Real verification and eligibility completion |
| D05 | Location and hidden-field policy | Private coordinates; coarse distance; define precision and stale-location behavior | Geographic discovery acceptance |
| D06 | Email/OAuth linking, password and session policy | Verified identity linking only; safe device rotation and revoke-all | Auth implementation tests |
| D07 | Unmatch/block history and rematch behavior | New writes denied immediately; historical access and retention unresolved | Chat/history/deletion acceptance |
| D08 | Report operator, retention, deletion/export timing | Named owner and written policy required | Safety/privacy release acceptance |
| D09 | Provider/hosting budget, region and scale | Defer paid provisioning; architecture proposal above | Infrastructure provider commitment |
| D10 | Market, languages and supported OS versions | Deferred by user; revisit before provider commitment/release | Regional/legal/provider and mobile acceptance |

Next implementation-sized package: settle ADR-001 and auth/profile blocking choices, then establish a server skeleton, migrations for identity/session/profile, synthetic accounts and real HTTP/database integration tests for BE-01/03/06/07/61. This package must not claim working discovery/chat before their later slices pass.

Current stage: scope drafted and confirmed decisions recorded; API/data design in review; implementation not started. No deployment, paid provisioning, store publication or push to GitHub has occurred.
