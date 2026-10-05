# Session restoration

The app checks the repository for an existing session during its loading screen. An authenticated returning user proceeds to Discovery without seeing the welcome or login form again. A missing or expired session proceeds to account entry. A failed server check stays on a retryable loading/error screen; a network failure does not mean the account has signed out.

## Local preview

`createLocalPaceRepository({ sessionStorage, now })` accepts an optional browser `Storage` object. The application passes guarded `localStorage`; the repository does not read browser globals. Without that object, a session lasts only within the current repository instance.

The only value this adapter writes is:

```text
key: pace-preview-session-v1
value: {"version":1,"expiresAt":<milliseconds since Unix epoch>}
```

The marker is created after local `authenticate()` or final `completeOnboarding()`, and expires 30 days later. Restoration does not extend the expiry. `restoreSession()` returns `{ authenticated: true }` for a current marker and `null` otherwise. Malformed, obsolete, or expired markers are removed. `signOut()` clears the in-memory marker and removes the stored marker.

This is preview continuity for the existing demo actor, not real authentication. It does not save a password, email, profile, payment token, Apple transaction, or membership. A returning preview session still receives the repository's configured demo data; profile and onboarding data are not restored by this marker. Altering the marker cannot grant Plus or alter server-side identity: the HTTP adapter never reads it, and local entitlements continue to come from explicit repository seeds.

If browser storage access fails or its quota is exceeded, the current instance retains its session in memory and the app keeps running. Reopening then may require login. Sign-out always clears memory and attempts stored-marker removal; if the browser refuses removal, this preview cannot guarantee deletion across a future reload. Production logout must invalidate the server session rather than relying on browser marker removal.

## HTTP contract

`PaceApiClient` sends the session operations through the existing same-origin credentials transport. No credentials are copied into browser storage.

| Repository operation | Request | Required behavior |
| --- | --- | --- |
| `authenticate(credentials)` | `POST /api/v1/auth/login` | Authenticate credentials and establish a server session. Existing login response contract remains unchanged. |
| `restoreSession()` | `GET /api/v1/auth/session` | Verify the current server session and return JSON `{ "authenticated": true }` only for a valid signed-in account. |
| `completeOnboarding()` | `POST /api/v1/auth/onboarding/complete` | Complete onboarding for an already authenticated signup/OAuth session. It accepts no invented password, token, or identity from this client. Return `{ "authenticated": true }` only after completion succeeds. |
| `signOut()` | `POST /api/v1/auth/logout` | Revoke the server session and clear its cookie. |

The session request uses `cache: "no-store"` and a 10-second abort timeout. The server must also prevent caching of session responses. The HTTP repository accepts only a literal boolean `authenticated: true`, normalizes its result to `{ authenticated: true }`, and treats other successful payloads as unauthenticated. HTTP 401 means the session is absent or expired. HTTP 403, 5xx, network failures, and timeouts remain errors so the UI can offer retry without falsely declaring logout.

The completion endpoint is a handoff contract, not account creation. Its repository operation rejects even a successful HTTP response unless `authenticated` is the literal boolean `true`, so an empty or malformed completion response cannot unlock the app. This repository still has no signup backend or Apple/Google OAuth credential exchange. Implement those first so onboarding completion can act on a real authenticated principal; it must not grant identity based on client profile fields. The preview must not be described as a production sign-in system merely because a device remembers it.

## Production web and native handoff

For web deployment, implement server-issued secure, HttpOnly session cookies with appropriate SameSite, expiry, refresh, revocation, and CSRF protections. The backend determines identity and permissions for each protected request; a visible loading screen or browser flag is not an authorization check.

For an iOS app, build the native authentication/session bridge and use platform-protected credential storage for any native refresh credential. Keep passwords and refresh tokens out of JavaScript `localStorage`. On launch, validate or refresh the native/server session before signaling authenticated state to the web UI. The native refresh/exchange endpoint and bridge are not implemented here. Do not reuse the preview marker or the StoreKit membership bridge as proof of login.

## Verification

`repository_test_cases.mjs` covers reopening after login and completed onboarding, logout across repository instances, 30-day expiry, corrupt markers, storage failures, no stored secrets, unchanged membership, strict HTTP session payload validation, 401 handling, and network/server/timeout propagation. `contract_test_cases.mjs` covers endpoint paths, methods, same-origin credentials, uncached restoration, an abort signal, and body-free onboarding completion.
