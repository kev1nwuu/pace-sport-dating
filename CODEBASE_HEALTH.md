# PACE codebase health review

**Reviewed:** 2026-09-08  
**Decision:** The frontend is suitable for starting backend integration. No release-blocking frontend defect remains in the tested prototype paths. The product is not yet production-ready because several server contracts and operational controls do not exist.

The Brooks health skill's shared scoring references are not present in this local skills installation, so this review intentionally does not invent a numeric score. The conclusions below are based on repository structure, source inspection, responsive browser measurements, and executed tests.

## Standards and consistency

- `app.js` is the composition root rather than the owner of every feature.
- Account, onboarding, moments, conversations, domain catalogs, repositories, and transport are separated into dedicated modules.
- Feature modules do not call `fetch` directly. HTTP details remain behind `PaceApiClient` and the repository boundary.
- Persisted sports use stable IDs; localized labels stay in the presentation layer.
- `styles.css` is an import manifest. Feature styles are owned by files under `styles/` instead of accumulating in one override sheet.
- The latest discovery layout remains contained at both 320 px and the standard app width.
- All production assets are local, and a browser gate fails if core visuals make third-party network requests.
- Every deployed JavaScript and CSS import uses the same release cache stamp, preventing mixed old/new modules after deployment.
- Global Home navigation, request-failure recovery, and noninteractive connection-status rows were corrected during the final user-path audit.

## Architecture

```mermaid
flowchart TD
  HTML[index.html] --> APP[app.js composition root]
  APP --> FEATURES[feature modules]
  APP --> REPOSITORY[pace_repository.mjs]
  FEATURES --> DOMAIN[domain and catalog modules]
  FEATURES --> REPOSITORY
  REPOSITORY --> API[api_client.mjs]
  API --> SERVER[/api/v1]
```

The production-module dependency direction is one-way and no circular dependency was found. UI behavior, domain data, persistence, and transport have explicit seams, so backend work can be added without moving request logic into view modules.

## Maintainability and technical debt

- The largest remaining orchestration files are `app.js` (566 lines), `features/onboarding.mjs` (498), `features/account.mjs` (446), and `features/moments.mjs` (342). Their public seams are already separated; split them further only when backend integration introduces a distinct responsibility, not merely to reduce line counts.
- Feature CSS still contains a small number of same-file overrides from responsive rules and earlier visual iteration. They are now localized to their owning feature and protected by visual snapshots; consolidate them one feature at a time only when a backend-driven change touches that area, rather than performing a risky mechanical merge before integration.
- The local adapter remains the default. This is intentional until authentication and the first server-backed read flows pass in a non-production environment.
- Authentication, discovery decisions, matches, chat, invitations, billing, deletion/privacy, and the full media lifecycle still need explicit server contracts. Their detailed rollout order is in `BACKEND_READINESS.md`.
- `PaceApiClient` is deliberately small but still needs session injection, cancellation/timeouts, structured problem responses, and request IDs before production use.

## Test quality

- 29/29 domain, repository, photo-presentation, localization, cache-stamp, and HTTP-contract tests passed.
- 21/21 browser tests passed serially: core journeys, baseline accessibility, local-asset enforcement, responsive containment, and seven visual-regression screens.
- All 13 production JavaScript modules passed syntax validation.
- The discovery screen was measured at 320 × 700 and 1077 × 752 without horizontal overflow or clipped sport rows.
- The final browser suite passed without snapshot-update mode. One worker and a 60-second per-test ceiling are configured so visual/mobile tests are stable under local and CI CPU contention.
- Manual user-path verification found no console-breaking behavior and confirmed that buttons recover after repository failures instead of remaining disabled.

## Backend connection gate

Before changing `<meta name="pace-data-adapter" content="local" />` to `http`, complete these gates:

1. Publish OpenAPI schemas and a common error envelope.
2. Implement session authentication and authorization.
3. Connect profile and discovery reads to a test server.
4. Run the same 29 domain/contract tests and 21 browser tests against that server, adding deterministic seeded backend fixtures.
5. Add CI so the checks run on every backend-integration change.

See `BACKEND_READINESS.md` for endpoint coverage, missing contracts, server guarantees, and the recommended rollout sequence. The current green result means “frontend integration baseline is healthy,” not “the service is ready for public traffic.”
