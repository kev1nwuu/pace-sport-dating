# PACE Frontend Flow Audit and Test Cases

Audit date: 2026-09-26. Scope: the current `index.html`, `app.js`, `features/`, repository/API boundaries, existing automated tests, and handoff documents. This document was produced through read-only code review; the review changed no business implementation and wrote no backend code.

**Conclusion: the prototype has all major screens and some HTTP integration interfaces, but this does not establish that real account, matching, chat, invitation, media, or account-deletion flows are complete.** All 94 Node tests passed in this review. “Existing” browser tests means they have been written, not that they ran in this review. Actual UI checks performed in the main task must be recorded separately and must not be counted as part of these results.

## Checks Run and Existing Coverage

| Check | Result in this review | What it proves / limitations |
| --- | --- | --- |
| `node --run check` | Passed | Current production JS modules have valid syntax; this does not prove correct interactions |
| `node --run test:unit` | 94/94 passed | The pure-logic, interface, and startup-state tests listed below |
| Playwright E2E | Not run in this review | 36 existing test declarations: core 13, engagement 7, session 7, visual 7, accessibility 2 |
| Physical mobile devices / iOS / Safari / VoiceOver | Not run | Follow-up device testing is required |
| Real backend / App Store Sandbox | Not run | There is currently no deployed real service or native purchase test environment |

Before running Node scripts, add the local Node runtime to `PATH`. Specifying only the Node executable without updating PATH causes child commands to fail with `node: command not found`; the checks passed after the environment was corrected and they were rerun.

| Existing file | Count | Coverage |
| --- | ---: | --- |
| `contract_test_cases.mjs` | 10 | Sport IDs, localization dictionary interfaces, HTTP parameters, error wrapping, and session/cache/import constraints |
| `user_test_cases.mjs` | 11 | Pure matching functions, basic entitlements, visible moments, comments/likes, bio constraints, and local dates |
| `repository_test_cases.mjs` | 20 | Adapters, persistent preview markers, expired/corrupt/disabled storage, and strict HTTP sessions |
| `photo_presentation_test_cases.mjs` | 3 | Avatar cropping and focal-point data |
| `engagement_test_cases.mjs` | 30 | Reference-service authorization, duplicate requests, capacity, membership lifecycle, and the Apple signature-verification seam |
| `storekit_bridge_test_cases.mjs` | 7 | Native bridge contracts, cancelled/pending outcomes, restore, account binding, and refusal to grant entitlements when unavailable |
| `onboarding_startup_test_cases.mjs` | 8 | Startup gate, retries, late responses after logout, asset readiness, and reduced motion |
| `launch_assets_test_cases.mjs` | 5 | Font and image readiness, memoization, and releasing the startup wait on failure/timeout |

`engagement_test_cases.mjs` uses an in-process reference service; it does not prove database locking, real purchase verification, or authorization in a deployed API. `accessibility.spec.mjs` checks basic DOM constraints and is not a complete accessibility audit. `visual.spec.mjs` uses `animations: "disabled"`, so passing screenshots cannot demonstrate smooth startup animations. Older counts and “passed” statements in `CODEBASE_HEALTH.md` and `BACKEND_READINESS.md` are historical records, not acceptance results for this review.

## Code Review Findings

Priorities: P0 = must be resolved before public release; P1 = important flows that must be covered during integration; P2 = routine quality improvements. All evidence below comes from local code, not browser reproduction.

| ID | Priority | Finding and user impact | Code evidence | Verification cases |
| --- | --- | --- | --- | --- |
| F01 | P0 | Discovery candidates only control whether the card is visible; the displayed person is still fixed to Maya. Clicking Like unconditionally schedules the match-success dialog and does not prove a server-confirmed mutual like. | `setDiscoveryState` and `performDiscoveryDecision` in `app.js`; the static discovery card in `index.html` | D02–D05 |
| F02 | P0 | Sending a chat message only appends to the DOM; it disappears when the chat reopens. Opening Chat for any author produces the same preset exchange, with no conversation ID or history loading. | `features/chat.mjs:63`, `:80`, `:93` | C02–C05 |
| F03 | P0 | There are two invitation paths: Discovery/Plus calls `sendDirectInvite`; Chat's `openInvite` only closes the dialog and shows a sent notification, without a recipient ID or write request. | `features/chat.mjs:126`; `renderInvite` in `features/membership.mjs` | I03–I07 |
| F04 | P0 | The first signup step only validates and stores email in memory. Apple/Google buttons fill in a demo email and continue directly. Completing signup over HTTP requires an existing authenticated session, but real account creation/identity exchange is missing. | `features/onboarding.mjs:303`, `:538`; `docs/AUTH_SESSION.md` | A04–A07 |
| F05 | P0 | Account deletion only sets an in-memory `deletedAt` value and shows a toast. It does not call a deletion API, log out, or revoke the persistent session. | `features/account.mjs:164` | S01–S02 |
| F06 | P0 | Publishing a moment passes local `blob:` image URLs and hardcoded `user_kevin`/`verified:true` values to publish; there is no completed upload flow. Other devices cannot access these images, and identity must be derived from the session. | `features/moments.mjs:242`, `:274`; this flow does not call the upload methods in `api_client.mjs` | M04–M07 |
| F07 | P1 | The current user's profile starts from local defaults, with no GET me/profile during startup; the local session marker does not store the profile. Reopening may show default details and cannot be described as restoring the user's profile. | `features/account.mjs:22`, `:107`; `onAuthenticated` in `app.js`; `docs/AUTH_SESSION.md` | P02–P03 |
| F08 | P1 | Any `person.verified` value other than an explicit false displays a verification badge, including a missing field. Maya also has two demo IDs: `maya` and `user_maya`. | `features/chat.mjs:67`, `:77`, `:83`; `initialCandidates` in `app.js` | C01, C06 |
| F09 | P1 | An initial feed-load failure clears the list and shows only a brief toast, without a persistent error/retry state. There is no shared interceptor that routes expired sessions back to the login gate. | `start` in `features/moments.mjs`; `request` in `api_client.mjs` | R01–R03, M08 |
| F10 | P1 | Most signup/login fields and errors are hardcoded in English, as are profile frequency options. Top-level dictionary-completeness tests cannot detect these omissions. | `features/onboarding.mjs:90`, `:233`, `:277`; `features/account.mjs:278` | L01–L03 |
| F11 | P1 | Standard modals have a focus trap, but the separate match-success dialog lacks an equivalent Tab trap. Chat tabs lack roving tabindex and arrow-key handling. | Document keydown handling in `app.js`; `features/chat.mjs:39`, `:78` | X02–X04 |
| F12 | P1 | Profile uploads only filter MIME type and count, with no feedback for dimensions, file size, or decoding failures. Moments filters with `image/*`, has no count limit, and does not release preview URLs when publishing is cancelled. | `features/account.mjs:355`; `features/moments.mjs:242`, `openMomentPublisher` | P06, M05, R06 |
| F13 | Decision pending | Profile editing allows empty/short bios, explicitly covered by a unit test; signup requires at least 12 characters. Product confirmation is needed on whether to unify the rule or define different requirements by stage. | UT-09 in `user_test_cases.mjs`; the prompts branch in `features/onboarding.mjs` | P07 |

These findings form a pre-delivery backlog; they do not authorize backend implementation now. In particular, F01–F06 cannot be resolved through frontend styling or additional success toasts.

## Test Execution Conventions

- In the tables below, “Existing” means the repository contains relevant assertions; “New” means a test specification written in advance but not yet automated or executed; “Integration” means expected acceptance that depends on a backend/native contract. After the user authorizes implementation, write a test that can fail before implementing the feature.
- Use a fixed clock; independent users A/B and a third user C; underage profiles; Free/Plus/expired/revoked states; matched/unmatched relationships, blocks in both directions, and unavailable authors. Do not use real personal data or send messages to real users.
- Add a failure/retry/double-click check to every success case. Use controlled server fixtures so demo defaults cannot mask missing fields.
- The current browser baseline is single-worker Chromium at 480×844. Add 320×700, 390×640, the user's 440×702, and 710×752, plus physical iOS safe-area/keyboard checks. Changing a desktop viewport does not replace iOS WebKit or physical-device testing.

## Test Cases: Current Invitation Design

| ID / priority | Preconditions and steps | Required result | Coverage status |
| --- | --- | --- | --- |
| I01 / P1 | Open Discovery at all five viewport sizes above, in Chinese and English; inspect the invitation control in normal, focus, hover, and pressed states | Icon and text align as a whole; the old floating PLUS badge does not overlap the border; card/navigation does not cover the control; touch target is at least 44×44 CSS px; an accessible name describes its purpose | New; verify after this round of UI changes |
| I02 / P1 | Open an invitation from Chat at 390×640 and 440×702; enter valid/invalid values and scroll to the submit area; measure button and label centers | Button outer-box center differs from the submit-row center by ≤1 CSS px; label center differs from the button content-area center by ≤1 px; disabled/enabled/submitting states do not shift; the submit button remains reachable by scrolling with the keyboard open | Existing dialog-containment test; new button/label centering assertions |
| I03 / P0 | An unmatched Free user taps invite and closes it; simulate a matched Free user and tap again | Unmatched users see only Plus and cannot send; matched users can invite for free; both UI entry points use the same recipient/authorization rules | Some Free/Plus E2E exists; connecting Chat is integration work |
| I04 / P0 | A opens B's Profile from B's moment avatar, switches to Chat, and sends an invitation; C repeats the flow | The request recipient is the person being viewed; only the corresponding conversation receives a pending invitation; it cannot be fixed to Maya or addressed to the sender | New, integration |
| I05 / P0 | Complete a valid invitation and double-click Send; simulate a timeout and retry; then change the payload and send again | One valid request creates one invitation; retries of the same content use the same key; new content uses a new key; failures preserve input and do not show a sent state | Direct invite has reference + API E2E coverage; new for Chat |
| I06 / P0 | Plus is active when the composer opens but expires before sending; the recipient blocks the sender or is deactivated; the server returns the corresponding rejection | No invitation is created; expiration returns to Plus; unavailability produces an understandable message; the button recovers; private reasons about the other user are not exposed | Some direct-invite coverage exists; new UI rejection matrix |
| I07 / P0 | Open an invitation for an earlier time today, a valid time tomorrow, a DST transition day, and after a timezone change | Past times cannot be submitted; the request stores explicit UTC and the agreed timezone; local display is consistent; validating only date>=today is insufficient | Some direct-invite coverage exists; Chat/DST integration |
| I08 / P1 | Submit with Enter, cancel with Escape, and cycle with Tab; fill in the form, cancel, and reopen | Submit occurs once; cancellation sends nothing; focus returns to the trigger; draft retention/clearing follows the confirmed rule | New |

## Test Cases: Accounts and Startup

| ID / priority | Preconditions and steps | Required result | Coverage status |
| --- | --- | --- | --- |
| A01 / P0 | Cold start/refresh/new tab with no session, a valid session, and an expired session | Show the welcome page, loading then Discovery, or login again respectively; the main region is inert before verification and private content does not flash | Existing unit + 7 session E2E tests |
| A02 / P0 | Retry after a session 503/timeout; log out or switch accounts while waiting | A network failure is not treated as logout; retry is available; an old request cannot unlock the app again or populate data from the previous account | Some startup unit coverage exists; account-switch data cleanup is new integration work |
| A03 / P1 | Uncached fonts/images, failed images, reduced motion, and a slow CPU on a low-end device | Brand screen transitions smoothly to the destination; the fixed bottom bar does not jump; asset failure cannot block entry indefinitely | Existing asset-gate unit coverage; new real-motion/device checks |
| A04 / P0 | Sign up with a genuinely new email, an existing email, a weak password/incorrect confirmation, and an unverified email | Registration occurs once; server errors map to fields; email/password/confirmation are not stored in localStorage; an unauthenticated user cannot call the completion endpoint to unlock the app | Preview only at present; integration |
| A05 / P0 | Google/Apple login succeeds, is cancelled, has expired state, encounters an account conflict, or uses a hidden email | Use a real provider exchange; cancellation keeps the original screen; no hardcoded identity or silent creation of a second account | Integration |
| A06 / P0 | The day of/before the 18th birthday, a leap-day birthday, a future birthday, and a tampered client date | The age rule is explicit and consistent across frontend/backend; the server rejects ineligible users | Client restrictions exist; boundary and server integration coverage needed |
| A07 / P1 | Forgot password; expired/reused reset link; sessions on other devices after reset | The account can be recovered; the token is single-use; old devices follow an explicit session policy | Integration; no current flow |
| A08 / P0 | Login/signup-completion request fails, then retry; logout request fails, then retry | Buttons recover, usable input is preserved, and success enters the app only once; failed logout cannot claim that all sessions were revoked | Some coverage exists; new complete failure matrix |

## Test Cases: Discovery, Matching, and Conversations

| ID / priority | Preconditions and steps | Required result | Coverage status |
| --- | --- | --- | --- |
| D01 / P1 | Change sports/distance/goal/schedule, switch rapidly, and return empty results/503 | Only the latest request updates the page; empty results differ from request failure; retry is available; stable sport IDs are stored | Some query/unit coverage exists; goal/schedule display and error states are new |
| D02 / P0 | The API returns different names/photos/ages/frequencies for A/B/C; advance through cards | Each card matches the API identity; invite/like/pass bind to that ID; no Maya data remains | Integration |
| D03 / P0 | Only A likes B; B has already liked A; both users like concurrently | No match-success dialog for a one-sided like; a mutual like produces it once, with a unique match ID; the connections list is consistent | Pure-function coverage exists; real UI/server integration is missing |
| D04 / P0 | Double-click Like, click after a swipe, exhaust the quota, go offline, and receive 500 | No duplicate decisions/quota deductions; failure supports retry without a false match; touch cancellation is handled | New, integration |
| D05 / P1 | Return/refresh after Pass, exhaust candidates, and rediscover after unmatching | Candidate cursor and exclusion rules are consistent; the same demo card does not replay forever; empty state is recoverable | Integration |
| C01 / P1 | Tap avatar/name for Maya, Noah, and authors with the same name but different IDs, then return | Open the correct Profile tab with matching photos/identity; return to Moments; the current user's author entry opens Me | Existing Maya/Noah E2E; same-name/self cases are new |
| C02 / P0 | A/B are matched and A/C are unmatched; switch between their chats | History comes from the correct conversation ID; unauthorized reads/writes are blocked; the same demo exchange is not copied | Integration |
| C03 / P0 | Send text, navigate away and back, refresh, and open on a second device | Messages persist in a consistent order; pending/sent/failed states are explicit; delivery is not claimed before server confirmation | New, integration |
| C04 / P0 | Message-send timeout, reconnect after going offline, duplicate events, and out-of-order events | One message per client message ID; retry preserves text; messages are not lost or displayed in another conversation | New, integration |
| C05 / P1 | Whitespace, emoji, multiple lines, the 1,000-character boundary, HTML characters, and keyboard occlusion | Whitespace cannot be sent; text renders as text; errors do not clear input; autoscroll does not pull the user away from older messages | Existing blank/DOM-bubble E2E; other cases are new |
| C06 / P0 | Author verified is true/false/missing/null; author is blocked/deleted | A badge appears only for an explicitly trusted verified=true value; deletion/blocking is fully handled without showing Maya's default private information | New, integration |

## Test Cases: Profiles and Moments

| ID / priority | Preconditions and steps | Required result | Coverage status |
| --- | --- | --- | --- |
| P01 / P1 | Edit/preview/cancel/save; open and close 10 times | Cancel writes nothing; preview uses the draft; save occurs once; no duplicate event listeners; the Photos helper text already requested for removal does not reappear | Main paths exist; cancellation/repetition are new |
| P02 / P0 | Save name/bio/photos/sports and other fields; restore after refresh and on another device | The page reads the same complete profile from the server; server rejection preserves the draft; default Kevin data does not overwrite it | Integration |
| P03 / P0 | Toggle height/ethnicity visibility; B views A | Disabled fields are not leaked through the public API, rather than merely hidden by CSS; the owner can still see them while editing | Local hiding exists; public DTO integration needed |
| P04 / P1 | Switch cm↔ft repeatedly; test minimum/maximum values and an empty field | Conversion uses agreed rounding without NaN/lost values; empty does not become 0; privacy toggles do not turn on automatically | Main E2E exists; boundaries are new |
| P05 / P1 | Select 0/1/43 sports, add a custom sport, switch language, then save | At least one sport; stable IDs rather than translated labels as IDs; custom values survive a round trip | Catalog unit coverage exists; custom-value round trip is new |
| P06 / P1 | 0/6/7 photos; oversized/corrupt/spoofed-MIME images; cancel/remove; upload failure | Enforce limits, give clear rejection feedback, decode safely, and support retry; do not claim saved before durable upload; removal releases resources | Some count unit coverage exists; file/upload coverage is new |
| P07 / Pending | Submit empty/2-character/12-character/300-character bios during signup and editing | Apply the confirmed rule consistently; one test cannot require no minimum while another silently enforces 12 characters | Existing conflict; confirmation required first |
| M01 / P0 | Mix self/connected/pending/public/blocked authors into the feed | Only authorized content is visible, with isolation enforced by server queries; returning author data does not automatically grant chat access | Pure-function coverage exists; cross-account integration needed |
| M02 / P1 | Rapidly like/unlike, reverse delayed response order, and retry failures | UI eventually agrees with the server; counts do not become negative or change twice; focus is retained | Unit/single-action E2E exists; race cases are new |
| M03 / P1 | Empty/280-character/281-character comments; close the dialog while sending; fail and retry | No duplicate comments; an old response does not reopen comments after closure; the draft can be recovered after an error | Normal comments covered; late-response cases are new |
| M04 / P0 | A/B publish and try to forge author_id/verified/visibility | Author and permissions come from the session; only permitted visibility is accepted; hardcoded local Kevin data does not enter production | Integration |
| M05 / P0 | Publish with photos: successful upload, one-photo failure, publish failure, refresh, and a device in another location | Submit only durable media IDs/URLs; failure preserves the draft; orphan uploads are cleaned up; photos work across devices | Integration |
| M06 / P1 | Cancel and reopen the publisher, delete an image, and repeat 20 operations | Preview URLs are released at the right time; their count does not grow without limit; unpublished photos are not leaked | New |
| M07 / P1 | Caption/sport/metrics contain HTML; a response post ID is missing or contains quotes | Escape text and validate DTOs; no arbitrary HTML or incorrectly bound buttons; one bad record does not crash the entire feed | New |
| M08 / P1 | Initial feed 503, empty list, pagination failure, and refetch after blocking | Persistent error + retry differs from a genuinely empty feed; pagination has no duplicates; invalid content is removed | New; pagination depends on integration |

## Test Cases: Membership, Meet Up, and Settings

| ID / priority | Preconditions and steps | Required result | Coverage status |
| --- | --- | --- | --- |
| B01 / P0 | Free, active Plus, cancelled renewal before expiry, expired, and refunded | Show real entitlements; cancelling renewal retains entitlements until expiry; a refund revokes them immediately; the UI cannot grant itself membership | Reference coverage exists; real Apple integration needed |
| B02 / P0 | Web without a bridge, unavailable iOS products, missing legal URLs, and non-localized prices | Do not offer a purchase that cannot be completed; show clear unavailability; purchase information comes from StoreKit | Bridge unit coverage exists; paid UI fixtures are new |
| B03 / P0 | Sandbox purchase succeeds/is pending/is cancelled; background and foreground the app | Upgrade only after server verification; pending grants no entitlement; closing the dialog does not interrupt required recovery; refresh on return | Bridge/reference coverage exists; native integration needed |
| B04 / P0 | Restore on another device, restore under a different PACE account, duplicate transaction, and out-of-order refund events | Ownership is enforced; duplicates do not grant entitlements twice; older state does not overwrite newer state | Reference coverage exists; database/Apple integration needed |
| T01 / P1 | Use the collapsible All sports filter; search Chinese/English labels; no results; Escape; select then open Going | The full catalog is discoverable; single selection is clear; selection collapses the control and restores focus; Going preserves query semantics | API/domain and standard E2E exist; keyboard cases are new |
| T02 / P0 | Two users join the last available spot concurrently; duplicate join; leave/rejoin | Total attendance never exceeds capacity; the user occupies only one spot; Going and details agree; the host cannot use ordinary leave | Reference + API fixtures exist; database integration needed |
| T03 / P0 | Create as Free, Plus with an unverified host, and Plus with a verified host; submit repeatedly | Backend determines authorization; create once; host binds to the session; errors preserve the draft | Reference + API fixtures exist; real-service integration needed |
| T04 / P1 | Reopen details or join after cancellation/change, after start time, or after the organizer is banned | Show current state and disable invalid actions; cancelled activities no longer appear in upcoming | Some error codes exist; complete lifecycle integration needed |
| T05 / P1 | Change device timezone; test DST, long title/location, failed image, and list-network recovery | Correct times; no overflow from long content; retry is available; activity text remains visible | Some date/retry coverage exists; timezone/broken-image cases are new |
| S01 / P0 | Cancel/confirm account deletion; return 500; asynchronous deletion in progress | Cancellation writes nothing; failure does not claim deletion; success removes visible profile data and revokes sessions; progress is explicit | Integration |
| S02 / P0 | Restart after deletion, access with an old token, export data, and send marketing notifications | The account is not restored; public data is cleaned up according to retention policy; marketing stops after deletion; retention/export have explicit contracts | Marketing pure-function unit coverage exists; other cases require integration |
| S03 / P0 | Enter report/block/unmatch flows from profile/chat/feed | Flows are reachable, cancellable, and confirmed; writes take effect consistently across all entry points; the reporter is not shown private status about the reported user | Integration; product flows are currently missing |
| S04 / P1 | Notifications off/allowed/denied; foreground/background; tap a notification; switch accounts | Route to the correct authorized conversation/activity; no duplicate unread counts; lock-screen privacy follows settings; denial still allows normal use | Integration; currently only an empty-notifications toast |

## Test Cases: Localization, Accessibility, and Resilience

| ID / priority | Preconditions and steps | Required result | Coverage status |
| --- | --- | --- | --- |
| L01 / P1 | Traverse all reachable pages, form validation, and failure/empty/loading states in en/zh/fr/es/de | No untranslated English in non-English locales, except original user text, brands, and agreed units; no raw localization keys | Dictionary-shape coverage exists; page traversal is new |
| L02 / P1 | Longest German/French copy, 200% font size, and Chinese at 440×702 | Buttons/tabs retain essential action text; dynamic height does not obscure submission; no horizontal overflow | New |
| L03 / P1 | Save language, then log out/restart/use a new device; round-trip data IDs across languages | This device remembers the language; backend preferences, if supported, remain consistent across devices; values do not change with display language | Local storage is implemented; automated tests are new |
| X01 / P1 | Inspect every input/button/state with keyboard and screen reader | Accessible names, associated errors, status announcements, and visible focus; color is not the sole state indicator | Basic DOM checks exist; device assistive-technology checks are new |
| X02 / P1 | Cycle Tab/Shift+Tab/Escape in standard modal, Plus, comments, and match-success dialogs | Focus remains in the active dialog and background is inert; exit restores focus to the trigger; focus cannot enter hidden pages | Some standard-modal coverage exists; full matrix is new |
| X03 / P1 | Operate Chat/Profile/Edit tabs with arrow keys, Home/End, and Tab | Standard tabs keyboard behavior, with correct tabindex/aria-selected/tabpanel relationships | New |
| X04 / P1 | System reduced motion, keyboard and screen magnification, and dark native select controls | No forced excessive motion; native dropdown text contrasts with its background; long forms remain operable | Reduced-motion unit coverage exists; visual/device checks are new |
| R01 / P0 | Any protected request returns 401/403/503/429; session expires after login | 401 requires reauthentication and clears stale private state; 403 does not incorrectly log out; 503 supports retry; 429 presents the server's wait time | Some session-startup coverage exists; shared handling requires integration |
| R02 / P1 | On a slow network, switch tabs/close a modal/log out before a response returns | Late results cannot take over the UI, show another user's data, reopen a closed dialog, or overwrite a newer request | Startup/Train requestId coverage exists; other features need new coverage |
| R03 / P1 | discover/feed/profile returns non-JSON, an invalid schema, or missing fields | Contained errors and recoverable UI; no silent substitution of demo data for real data | Some transport-error coverage exists; schema coverage is new |
| R04 / P1 | Cold/warm asset cache, first load, version upgrade, and offline reopening | No mixed old JS/CSS, no blank screen, and explicit offline state; network failure is not treated as empty results | Cache-stamp unit coverage exists; real offline/upgrade cases are new |
| R05 / P1 | Physical device portrait/landscape, safe area, keyboard opening/closing, and foreground restoration | Navigation does not jump; input/submission remains unobscured; scroll position is reasonable; scrolling does not trigger an accidental swipe | Only some viewport-size E2E exists; physical-device tests are new |
| R06 / P2 | Repeat upload/cancel/navigation/open-conversation operations 20 times; record resources and console output | No continuing accumulation of event listeners, unreleased object URLs, or errors; input remains responsive | New |

## Acceptance Order and Delivery Records

1. First complete this round's invitation-control design and submit alignment, then verify I01–I02 at the user's viewport sizes. Do not hide real errors to make screenshots pass.
2. Run syntax checks and the existing 94 Node tests. Before running the 36 existing E2E tests, check copy locators and snapshots. Screenshot updates require manual review, not blind replacement.
3. After the user reviews the backend backlog, answers the product decisions, and explicitly authorizes implementation, write API/database tests that can fail for each P0. Then implement the backend and frontend integration, and finally run cross-user integration cases.
4. Release gates: all P0 cases pass; P1 cases pass or have limitations explicitly accepted by the user; physical-device, payment Sandbox, notifications, deletion/privacy, and observability checks have independent evidence. The current 94/94 result does not replace these gates.

For each execution record, retain the case ID, build version, environment/device, test data, actual result, evidence file, and failure ticket. Mark unexecuted items “Not run” and items dependent on unresolved product rules “Decision pending”; do not replace either status with “Passed.”
