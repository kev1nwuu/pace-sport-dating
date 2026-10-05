# Muted lime + inline profile editor QA

final result: passed

## Approved scope
User selected concept 1 color (#B4CF42) with concept 3 layout. Updated the shared lime accent and related glows; modernized the profile editor with flat sections, underline personal-detail inputs, compact units, field-specific visibility switches, and Save changes. Existing photos, sports, preview, optional values and 300-character bio limit remain available.

## Visual evidence
- Source: artifacts/approved-design/muted-lime-editor.png, 1254 × 1254 concept board containing two app panels. This combines the exact selected layouts and accent using built-in ImageGen.
- Welcome: artifacts/qa-muted-lime-welcome.png, 390 × 844 CSS px, density 1.
- Personal details: artifacts/qa-muted-lime-details.png, 390 × 844 CSS px, density 1; scrolled to Personal details, height 178 cm, height visible, ethnicity empty/private.
- Compared approved board and actual browser captures together in tool inputs. Board panel widths are approximately 555 px; compare at 390/555 visual scale. The original product has photos and sports above About you, so full-page vertical positions differ intentionally. No device chrome was compared.
- Focused detail comparison covers typography, height value and units, underline fields, separators, eye icons, both toggle states and footer CTA in the saved 390px screenshot.
- Also inspected 320 × 700 viewport and desktop welcome at 1280 × 720. Narrow document width equals viewport width; no horizontal overflow.

## Findings and iterations
- P2 initial mobile side padding was still 14px due to a legacy media query. Changed to 24px and recaptured. Final detail screenshot confirms consistent margins.
- Initial welcome screenshot was captured during viewport resizing. Discarded and recaptured at 390 × 844 before final comparison.
- No remaining P0/P1/P2 findings within scope.

## Required fidelity surfaces
- Typography: Manrope hierarchy retained, section titles 23px, supporting copy 14px, editable text 16px, height value 28px. Existing welcome headline unchanged.
- Spacing: card-in-card framing removed; sections use space and separators; height and units share a row. Footer button has 56px height. Photos and sports retain their functions.
- Color: computed --lime is #b4cf42. Welcome P, kicker, primary CTA, selected units and switches use the chosen accent. Related neon glows softened.
- Assets: existing charcoal background retained; visibility and dropdown icons use the installed Material Symbols font. No new decorative raster assets needed for production.
- Content: translated labels added for all five supported languages. Accessible switch names distinguish height and ethnicity. Bio remains optional and capped at the existing 300 characters, rather than adopting the mock's invented 500-character counter.
- Acceptable differences: native select remains for accessible height picking and has a chevron; ethnicity defaults to private rather than copying the mock's on state. Existing edit/view tabs and other profile sections remain functional.

## Interaction verification
- Local mock login, Me, Edit profile, and preview navigation work.
- 178 cm converts to 70 inches (5 ft 10 in), then back to 178 cm.
- Height/ethnicity visibility switches control preview output; temporary ethnicity test value cleared afterward.
- Save changes saves, returns to profile and displays Profile saved.
- Code preserves disabled submit state for both save controls; error restoration was inspected in code, not exercised with a forced browser failure.
- No browser warning/error logs observed.
- Syntax check passed; 8 contract, 11 user logic, 7 repository, 3 photo presentation tests passed (29 total).
- Existing end-to-end selector updated for the new ft label. Full Playwright suite not run; relevant interactions verified through the in-app browser.

## Implementation checklist
- [x] Apply approved accent and layout.
- [x] Preserve localized labels, fields, conversion and privacy behavior.
- [x] Verify mobile layouts and primary interactions.
- [x] Keep preview available.

Previous background QA: artifacts/design-qa-charcoal-background.md.


## Follow-up: social sign-in buttons
Replaced square-backed symbols with transparent Google and Apple assets. Applied dark gray rounded buttons and matched icon/label spacing to the supplied reference. Captured artifacts/qa-social-buttons.png and inspected 480px, 390px and 320px widths. Both existing mock provider actions enter the basics step. Syntax and 29 unit/contract checks passed. Source screenshot was viewed when supplied; its Desktop file was subsequently unavailable during the final documentation step. Source URLs are recorded in assets/onboarding-symbol-sources.md.

## Follow-up: native profile dropdown contrast
The Training frequency select had color-scheme normal with light text and no explicit option background. Applied color-scheme dark to profile-editor selects and explicit #151815 option backgrounds with #f4f5ef text, also covering height pickers. Browser computed styles confirm dark scheme and the intended colors. Selection successfully changed to 3–4× / week and was restored to 4× / week; no console warnings/errors. Native OS popup was not included in the browser screenshot, so visual evidence for the popup itself is limited to computed styles and the user's reported original symptom. Release cache contract passed. No custom dropdown or behavior changes were introduced.

## Follow-up: Plus, direct invitations and Train — 2026-09-13

Release `pace-release-audit-50`. Design direction: editorial sports club, retaining Archivo Black / Manrope / DM Mono, charcoal surfaces and the approved #B4CF42 lime. A membership pass, ruled benefits and numbered date tiles connect the new screens. Internal DFII: impact 4 + fit 5 + feasibility 5 + performance 5 − consistency risk 4 = 15.

Implemented Plus interest card, localized paywall and account membership status; configured native-product offers, restore/manage flows; member-only unmatched invitation composer with submission-time checks; Train discovery, sport filters, Going, activity details, join/leave and verified-member hosting. Existing free matched-chat invitation entry remains separate. Local preview is free; there is no fake purchase activation.

Verification: all 19 production syntax checks and 67 unit/contract tests passed (9 contract, 11 user logic, 7 repository, 3 photo, 30 engagement and 7 StoreKit bridge). Updated core E2E and added seven engagement journeys; their syntax passed. The automated Playwright suite and visual baselines were not rerun in this turn. Browser verification used Codex in-app browser.

Main-app browser checks: returning login, free discovery invitation opens Plus, no purchase/restore enabled without native configuration, free billing state, Train sport filtering, join increments 12 to 13, Going contains the session, leave removes it and releases the seat, free hosting opens Plus, modal keyboard focus stays inside, English/Chinese navigation. Mobile layouts inspected at 390×844 and 320×740 with no document horizontal overflow. Chinese date suffix overflow found during visual review was corrected using the numeric day part.

Isolated `tests/fixtures/engagement-preview.html`: trusted Plus/verified test actor can send a pending invitation and create an activity that appears in Going. Advancing the repository clock after opening either form makes the submission fail with PLUS_REQUIRED and return to the paywall. These actions only changed test memory; no invitation was delivered externally. No browser errors/warnings observed on the main and fixture pages.

Evidence in `artifacts/qa-membership-train/`: Plus entry, English Plus, Chinese Plus, Train, joined activity, and final Chinese Train. Earlier captures show stages before the final verified-host wording and date-part correction; final Train captures document the corrected layout.

The backend modules are reference policy and API seams, not a deployed server. Real StoreKit purchases, signed Apple verification, Notifications V2, database transactions, authentication and recipient delivery/response workflows remain integration work documented in `docs/ENGAGEMENT_API.md` and `docs/APPLE_STOREKIT_INTEGRATION.md`. No actual Apple payment, refund or sandbox transaction was executed.

## Follow-up: invitation badge and collapsible sports — 2026-09-14

Release `pace-release-audit-51`. Reproduced the discovery issue at 447×752: the invite button inherited `overflow: hidden`, clipping the Plus badge above its circular boundary. Scoped the button to an opaque charcoal background with no backdrop blur, allowed the badge to sit outside its rim, and gave the badge a canvas-colored border. Browser verification confirms `overflow: visible`, no gradient/backdrop, and no clipping. The free-user action still opens the Plus sheet.

Replaced Train's horizontal sport chips with one dark disclosure control showing the current choice. The expanded panel searches the shared 43-sport catalog, includes All sports, displays empty search feedback, and scrolls within its list. Selection applies the existing repository sport ID filter and collapses the panel. Escape clears the query and restores focus to the summary; Enter reopens it. Existing membership and activity policy is unchanged.

All 19 production syntax checks and 67 unit/contract tests passed. Updated the existing filtering E2E journey and checked its syntax; the automated browser suite was not run. In-app browser checks passed for 44 radio options, Cycling search and matching activity results, Pickleball search, no-match feedback, Escape/Enter focus behavior, and All sports reset. Inspected collapsed/expanded Train and discovery at 447×752 and 320×740; no horizontal document overflow or browser warning/error logs. Screenshots: `artifacts/qa-filter-fix/`.

## Follow-up: discovery details and sport dating voice — 2026-09-15

Release `pace-release-audit-52`. Refined editorial direction, DFII 14: retain Archivo Black headings, Manrope body, charcoal and approved lime; emphasize shared interests and getting to know someone. Reused the welcome screen's charcoal texture in the discovery footer and removed the colorful ribbon. Three sport rows step diagonally down and right, with a smaller offset on narrow screens. Sport labels use readable sentence case. Replaced the floating Plus badge with a quiet tier label inside the invite button, and added a localized accessible description explaining pre-match Plus access. Removed the RUN CLUB decorative label.

Reviewed the interface copy across onboarding/login, discovery and filters, matches and chat, Moments and publishing, profiles/settings, Plus and Meet up. Updated generic training language to meeting people through shared activities with room for chemistry, retaining clear action, privacy, payment and permission wording. English and Chinese are the primary review languages; existing French, Spanish and German interface dictionaries were aligned. Onboarding remains English-only as in the existing implementation. Demo activity/post descriptions now include conversation, introductions and shared plans; real user content is not rewritten.

Representative changes: Train → Meet up / 相约; Suggest a training session → Invite to meet / 约 TA 一起运动; profile help → Share what makes you you, and who you’d love to meet; activity intro → Meet through a shared activity. See if there’s a spark. Eligibility and invite acceptance policies are unchanged.

Validation: 19 production syntax checks and all 67 unit/contract tests passed. Updated affected E2E text locators and the existing discovery layout test for the diagonal and new texture; all E2E files pass syntax checks, but the automated browser suite was not run. In-app browser verified English welcome/login, discovery, Plus access, Meet up, Moments/publishing, settings and Chinese discovery/Meet up. At 447×752 and 320×740, sports fit, diagonal offsets are present, and there is no document horizontal overflow. Evidence: `artifacts/qa-dating-copy/`.

Preview recovery: the previous Python server was listening but returned empty responses. Restarted the task-owned loopback server with logs redirected to `/tmp/pace-preview-4173.log`; confirmed HTTP 200 and successful browser loading.

## Follow-up: balanced diagonal sports — 2026-09-15

Release `pace-release-audit-53`. Retained the refined editorial direction (DFII 14), existing type, charcoal texture and colored sport icons. Replaced fixed diagonal padding with full-width rows: icon-and-label groups align start, center and end. This distributes the sports across the entire available region while retaining the separate weekly frequency column. Removed obsolete offset variables and narrow-screen grid declarations.

Verified the real in-app preview at 447×752 and 320×740 in English and at 320×740 in Chinese. At 447px the sport region spans x39–304; the first icon begins at x38.3 (its rotation extends 0.7px) and the final label ends at x304. Labels remain fully visible, with no horizontal document overflow. All nine existing contract checks passed, including the synchronized release cache stamp. No business logic changed; no additional tests or full automated browser suite were needed for this spacing adjustment.

## Follow-up: horizontal sports row — 2026-09-15

Release `pace-release-audit-54`. Applied the user's revised layout preference: three equal columns, with each sport icon above its centered label, all aligned on one horizontal row. Removed diagonal alignment rules; retained the charcoal footer and weekly frequency sidebar. Inspected the actual English preview at 447×752 and 320×740: all three labels are fully visible and the row fits alongside the statistic. Nine contract checks passed. Updated the existing narrow-screen E2E expectations from diagonal to equal top positions; its syntax check passed. The automated browser suite was not run.

## Follow-up: remembered login and returning launch — 2026-09-15

Release `pace-release-audit-55`. Startup now displays the existing charcoal PACE launch screen while restoring a session, without rendering the welcome/login page first. A valid returning session prepares Discovery and enters through a shorter version of the same reveal. Login and completed registration create a preview session; incomplete registration does not. Logout clears it. A missing/expired session shows welcome, while a server/network failure offers a localized Retry screen with the app kept inert. The static initial HTML also contains the launch surface to cover module loading.

Persistence stays behind the repository boundary. The local adapter stores only a versioned 30-day demo-session marker, with no credentials, profile or paid entitlement. HTTP mode always checks an uncached, bounded server session request and never trusts local storage. Registration completion requires an authenticated server response in HTTP mode. Production authentication, refresh, signup/OAuth exchange, and native credential storage are still integration work; see `docs/AUTH_SESSION.md`.

Validation: 19 production syntax checks and all 87 unit/contract checks passed, including 20 repository/session and six actual onboarding startup tests with doubled DOM/timer boundaries. New E2E scenarios cover reopen, logout, complete/incomplete signup, HTTP401 and retry; syntax checked, automated browser suite not run. In-app browser verified manual login → launch → Discovery, reload → launch → Discovery, a new tab restoring the same session, logout → reload → welcome, and incomplete signup → reload → welcome. Full signup replay reached photos but the browser file chooser timed out; the native Codex picker surface is unavailable to computer use, so the complete-signup persistence path was verified at the repository test boundary rather than claiming a completed browser signup.

## Follow-up: softer startup and stable reveal — 2026-09-16

Release `pace-release-audit-56`. Preserved the charcoal background, approved lime and horizontal sports layout. The static launch mark now enters gently without being recreated when JavaScript starts. Returning users see a 760ms opacity reveal into Discovery; the app shell no longer scales or blurs, so the fixed bottom navigation keeps its viewport anchor. Signed-out startup fades the centered brand before a small, soft welcome entrance. The welcome card has no fallback animation, preventing a second flash when its entry class is cleared. Reduced-motion settings remove movement and shorten transitions.

Added early preloads and a memoized preparation step for the charcoal texture, first demo profile image, and four critical font faces. Image decode/font failures cannot reject startup, and a 1200ms deadline prevents unavailable assets from trapping users. Session and member-data checks still gate app access; completing old asset work after logout cannot reopen it. The initial document canvas is dark.

Validation: all 20 production syntax checks and 94 unit/contract checks passed, including eight startup and five resource-preparation tests. In-app browser verified returning reload, logout/reload to welcome, and local demo login back to Discovery. At 447×752, navigation bounds stayed x12/y680/w423/h62 before and after reveal; at 710×752 they stayed x127/y680/w456/h62. Both had no horizontal overflow. Computed app transform/filter remain none; welcome settles at opacity 1 with animation none. Fonts were loaded at final display, and no browser warnings/errors were recorded. Temporary viewport overrides were reset and the localhost preview was shown. Automated Playwright journeys and native-device rendering were not rerun in this turn.

## Follow-up: quieter profiles and direct Moments navigation — 2026-09-16

Release `pace-release-audit-57`. Removed the matched-status subtitle from the chat header and inline profile summary, and removed photo-editor helper prose while retaining the photo count. Deleted the Moments footer Chat action and its obsolete handler/styles. Both the author avatar and name now open the existing Chat/Profile surface with Profile selected, preserving the author's identity and returning to Moments via Back. Own posts route to Me. Maya keeps her existing four-photo profile; other authors use supplied profile details or an initial placeholder rather than inheriting Maya's age, bio or tags. No new profile modal is opened by this path.

Validation: production syntax checks and all 94 unit/contract checks passed. Updated the existing feed and accessibility browser journeys; syntax checked, automated Playwright suite not run. In-app browser at 447×752 verified Maya avatar → Profile, switch to Chat, Back → Moments, Noah name → Noah Profile, absence of both matched-status labels and all footer Chat buttons, and the photo editor's title/count directly above its six slots. Screenshots inspected for header and photo-section spacing. No browser warnings/errors. Restored the default viewport and left the updated Moments preview open.

## Follow-up: invite control and handoff — implemented September 26, handed off October 4, 2026

Release `pace-release-audit-58`. Replaced the arrow/PLUS label with a calendar-heart SVG inside a quiet charcoal control; preserved its accessible invitation name, entitlement description and existing membership route. The primary Like retains visual prominence. Corrected the Invite submit button's inherited `space-between`/left alignment with explicit centered layout in both disabled and enabled states. This is the current implementation awaiting Kevin's visual acceptance.

The design draws on distinct action symbols in the official [Hinge Roses](https://help.hinge.co/hc/en-us/articles/36311177115027-Roses) and [Bumble icon guide](https://support.bumble.com/hc/en-us/articles/33284460795293-What-our-different-icons-mean); no brand assets were copied. The direction preserves PACE's charcoal texture and approved lime with a restrained secondary action.

Manual browser evidence collected September 26–28: at 440×702, button-to-row and text-to-button center offsets were both 0px for disabled/enabled Invite; a past date disabled submission; a free unmatched invitation opened Plus and unavailable purchase/restore stayed disabled. Additional local checks covered Moments comments/publisher, searchable sport selection, Tennis join/leave, membership/privacy settings and profile preview/cancel. At 320×700 in Chinese, Discovery had no horizontal overflow and the invitation control was 46×46px. These checks do not establish real message delivery, backend persistence, native purchases or iOS accessibility.

Existing E2E scenarios now assert label centering, minimum invitation target size, no visible PLUS label and keyboard access to the membership flow. They were syntax checked; the complete browser suite was not rerun. On October 4, all 20 production syntax checks and 94 Node checks passed again for handoff. The repository has 36 E2E declarations, not 36 newly verified passes. Product limitations and the 18-module backend/62-case plan are linked from `PROJECT_HANDOFF.txt`; no backend implementation was started.
