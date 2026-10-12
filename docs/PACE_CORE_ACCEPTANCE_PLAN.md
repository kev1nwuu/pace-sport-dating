# PACE core acceptance inventory — planned tests

Date: 2026-10-11. Test specifications only. None of the following backend tests has run against a service. Existing passing prototype checks do not establish these outcomes.

Fixtures: A and B eligible verified adults; C adult pending selfie; D banned; E incomplete; F deleting; separate devices/sessions for A; controlled clock and failures. Every test uses real HTTP and a persistent isolated database. Concurrency tests use separate connections/workers, not an in-memory reference service.

| Slice | Existing audit cases | Additional / focused acceptance |
| --- | --- | --- |
| Infrastructure/auth | BE-01–08, BE-60–61 | Invalid actor cannot write; lost-response retry preserves identity; credential rotation, revoke-all and independent devices; concurrent refresh follows explicit policy; cookie CSRF and native bearer flows separately; no credential/precise location/message body in logs |
| Eligibility/profile | BE-09–12 | Under-18 direct completion denied; exact eighteenth-birthday boundary/leap-day policy tested; pending/rejected/expired selfie cannot appear, Like or chat; owner edits/retries/deletion remain available; no min bio/max sports invented; same canonical ID across devices |
| Media | BE-13–17 | Foreign asset bind/delete denied; six-photo concurrency; disguised/corrupt files; sensitive metadata removal; restricted media URLs/expiry; no quarantined asset becomes public; orphan cleanup restart and ownership preservation |
| Trust/safety/privacy | BE-52–57; BE-23/27 regression | Forged badge/signature/replayed event denied; moderator authorization and reporter anonymity; deletion deactivates/revokes synchronously; cleanup retries; export only permitted user data; consent rechecked at final delivery |
| Discovery/matching | BE-18–23 | No self/banned/deleted/unverified/out-of-radius candidates; stable scoped cursor with changed permissions; honest empty state; one-sided Like persists without match; concurrent mutual Likes yield one match/conversation; quota final-slot race; block/Like race follows transaction order |
| Chat | BE-24–27 | Unauthorized guessed IDs reveal nothing; sender-scoped client_message_id replay; changed-text replay conflicts; stable per-conversation sequence; blocked replay cannot expose old result; websocket handshake and outbound authorization; restart/reconnect catch-up and monotonic read cursors |
| Notifications/mobile | BE-58 | APNs and Android provider token binding; account switch and delayed event; invalid token cleanup; event committed even when push fails; deduplication/retry; restricted deep link cannot leak data; lock-screen content obeys approved privacy preference |
| Release | BE-60–62 | Two real accounts on both platforms; cold start/session expiry; background/foreground; offline send/retry; provider failure; actual backup restore/rollback; load only against approved volume/p95/budget; configured support and operational monitoring |

## First executable test package

1. BE-01: unauthenticated and forged-actor requests cause zero writes and expose no private resource existence.
2. BE-03: create and verify a synthetic account, restart service and restore the same ID; no plaintext secret storage/logging.
3. BE-06: restore/renew from two clients with controlled expiry; invalid session yields 401, network failure remains retryable.
4. BE-07: current-device logout and revoke-all invalidate the exact intended scope immediately.
5. BE-61: capture synthetic error logs and assert tokens/passwords are absent.

Auth linking/password/rotation policy must be finalized before these tests become exact executable expectations. Test fixture creation is an internal isolated harness, not a publicly deployed admin/backdoor endpoint.

## Evidence required per delivery

Record commit/diff, runtime/database versions, migrations, command, environment, exact results, concurrency setup, omitted cases and pending decisions. For external providers, distinguish controllable-verifier integration tests from real provider/device acceptance. Contract/reference tests, staged HTTP tests and physical-device tests are separate evidence.

Keep the existing audit's deferred cases BE-28–51 and BE-59 for future invitations/community/activities/billing/fitness work. Do not count them as passed or silently delete them from project history. Reassess the release inventory whenever feature scope changes.
