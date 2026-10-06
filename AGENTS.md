# PACE contributor entry point

Before changing this project, read `PROJECT_HANDOFF.txt` sections 0–4 for the current product decisions, implementation limits, and authorization boundary. Read sections 7–10 when changing architecture, security, tests, or collaboration workflow. This file is the router; the TXT is the main handoff for humans and agents. Maintain first-party project documentation in English; see handoff section 10 for scope.

## Current boundary

This is a browser prototype, not a deployed backend or native iOS app. Backend implementation requires Kevin's explicit instruction after he has reviewed the backlog and test cases. A request to package, push, review, or document this repository is not authorization to implement the backend. Prepare reviewable contracts and tests first; report unresolved product decisions before dependent implementation.

## Read by task

- Product behavior: `PRODUCT_SPEC.md` and `CONTEXT.md`, reconciled against the newer decisions and conflicts in `PROJECT_HANDOFF.txt`.
- Visual changes: the current owning file in `styles/`, `design-qa.md`, and handoff section 3. Preserve the approved charcoal/lime direction and horizontal sports summary.
- Authentication/startup: `docs/AUTH_SESSION.md` and the session/startup tests.
- Plus, direct invites, activities: `docs/ENGAGEMENT_API.md`; `engagement_service.mjs` is an in-memory reference, not a server security boundary.
- Apple purchases: `docs/APPLE_STOREKIT_INTEGRATION.md`; require server-verified transactions and account ownership. Native success alone grants no entitlement.
- Backend planning: `docs/BACKEND_AUDIT_DRAFT_2026-09-26.md` (B01–B18 and BE-01–BE-62).
- Frontend acceptance: `docs/FRONTEND_TEST_PLAN_2026-09-26.md` (68 scenarios). Written scenarios are not passing test evidence.

Use `package.json` for current commands. Keep data access behind `pace_repository.mjs`, HTTP inside `api_client.mjs`, domain rules DOM-free, and styles in their owning feature. For a behavior change, test the relevant failure and success path; record exactly what ran and what remains unverified. Never silently substitute demo data for a failed HTTP request.

For collaboration, use a scoped branch and a reviewable PR. Preserve others' changes. Keep secrets, signing keys, production data, and generated reports out of Git. Do not force-push shared history or claim production readiness from local reference tests.
