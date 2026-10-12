import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ref = name => ({ $ref: `#/components/schemas/${name}` });
const str = { type: 'string' };
const id = { type: 'string', minLength: 1, description: 'Opaque canonical server ID.' };
const time = { type: 'string', format: 'date-time' };
const bool = { type: 'boolean' };
const integer = { type: 'integer', minimum: 0 };
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const arr = items => ({ type: 'array', items });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const enumStr = values => ({ type: 'string', enum: values });
const page = item => obj({ items: arr(ref(item)), next_cursor: nullable(str) });
const schemas = {
  Error: obj({ error: obj({ code: str, message: str, fieldErrors: { type: 'object', additionalProperties: arr(str) }, requestId: str, retryable: bool }) }),
  Authenticated: obj({ authenticated: { type: 'boolean', const: true } }),
  Accepted: obj({ accepted: { type: 'boolean', const: true } }),
  Credentials: obj({ email: { type: 'string', format: 'email' }, password: { type: 'string', writeOnly: true } }),
  Signup: obj({ email: { type: 'string', format: 'email' }, password: { type: 'string', writeOnly: true }, terms_version: str, privacy_version: str }),
  TokenInput: obj({ token: { type: 'string', writeOnly: true } }),
  EmailInput: obj({ email: { type: 'string', format: 'email' } }),
  ResetPassword: obj({ token: { type: 'string', writeOnly: true }, password: { type: 'string', writeOnly: true } }),
  OAuthInput: obj({ provider: enumStr(['apple', 'google']), credential: { type: 'string', writeOnly: true }, challenge_id: id }),
  OAuthChallengeInput: obj({ provider: enumStr(['apple', 'google']), client_type: enumStr(['web', 'ios', 'android']) }),
  OAuthChallenge: obj({ challenge_id: id, nonce: str, expires_at: time }),
  NativeCredentials: obj({ access_token: { type: 'string', description: 'Sensitive response credential. Never log/cache; native secure handling only.' }, refresh_token: { type: 'string', description: 'Sensitive response credential. Native OS secure storage only.' }, expires_at: time, token_type: { type: 'string', const: 'Bearer' } }),
  NativeRefresh: obj({ refresh_token: { type: 'string', writeOnly: true } }),
  SessionInfo: obj({ authenticated: { type: 'boolean', const: true }, user_id: id, onboarding_complete: bool, verification_state: enumStr(['none', 'pending', 'verified', 'rejected', 'expired']) }),
  Sport: obj({ id, label: str }),
  Sports: obj({ items: arr(ref('Sport')) }),
  PhotoInput: obj({ media_id: id, focal_x: { type: 'number', minimum: 0, maximum: 1 }, focal_y: { type: 'number', minimum: 0, maximum: 1 } }),
  Photo: obj({ media_id: id, url: { type: 'string', format: 'uri' }, focal_x: { type: 'number', minimum: 0, maximum: 1 }, focal_y: { type: 'number', minimum: 0, maximum: 1 } }),
  PublicProfile: obj({ id, display_name: str, age: { type: 'integer', minimum: 18 }, city: str, bio: str, sport_ids: arr(str), photos: arr(ref('Photo')), verified: { type: 'boolean', const: true }, distance_km: { type: 'number', minimum: 0, description: 'Coarsened public distance; never exact coordinates.' }, height_cm: { type: 'number' }, ethnicity: str }, ['id', 'display_name', 'age', 'city', 'bio', 'sport_ids', 'photos', 'verified']),
  ProfilePatch: obj({ version: { type: 'integer', minimum: 1 }, display_name: str, birth_date: { type: 'string', format: 'date' }, city: str, identity: nullable(str), intent: nullable(str), bio: str, height_cm: nullable({ type: 'number' }), ethnicity: nullable(str), show_height: bool, show_ethnicity: bool, sport_ids: { ...arr(str), uniqueItems: true }, photos: { ...arr(ref('PhotoInput')), maxItems: 6 }, weekly_frequency: nullable(str) }, ['version']),
  Preferences: obj({ version: { type: 'integer', minimum: 1 }, distance_km: { type: 'number', exclusiveMinimum: 0 }, sport_ids: { ...arr(str), uniqueItems: true }, goal: nullable(str), schedule: nullable(str) }),
  Discovery: obj({ state: enumStr(['results', 'empty']), candidates: arr(ref('PublicProfile')), next_cursor: nullable(str) }),
  DecisionInput: obj({ target_id: id, decision: enumStr(['like', 'pass']) }),
  Match: obj({ id, other_user: ref('PublicProfile'), conversation_id: id, created_at: time }),
  DecisionResult: obj({ decision: enumStr(['like', 'pass']), match: nullable(ref('Match')), quota_remaining: nullable(integer), quota_resets_at: nullable(time) }),
  Matches: page('Match'),
  Conversation: obj({ id, match_id: id, other_user: ref('PublicProfile'), unread_count: integer, last_sequence: integer }),
  Conversations: page('Conversation'),
  MessageInput: obj({ client_message_id: { type: 'string', format: 'uuid' }, text: { type: 'string', minLength: 1, description: 'Must remain nonempty after trimming; size/content limits pending policy.' } }),
  Message: obj({ id, conversation_id: id, sender_id: id, client_message_id: { type: 'string', format: 'uuid' }, sequence: { type: 'integer', minimum: 1 }, text: str, created_at: time }),
  Messages: page('Message'),
  ReadInput: obj({ sequence: integer }),
  ReadState: obj({ read_sequence: integer, unread_count: integer }),
  UploadInput: obj({ file_name: str, mime_type: str, size_bytes: { type: 'integer', minimum: 1 }, purpose: { type: 'string', const: 'profile_photo' } }),
  UploadGrant: obj({ media_id: id, upload_url: { type: 'string', format: 'uri' }, method: { type: 'string', const: 'PUT' }, required_headers: { type: 'object', additionalProperties: str }, expires_at: time }),
  Media: obj({ id, state: enumStr(['uploading', 'processing', 'ready', 'rejected', 'deleting']), rejection_code: nullable(str) }),
  Verification: obj({ id: nullable(id), state: enumStr(['none', 'pending', 'verified', 'rejected', 'expired']), expires_at: nullable(time) }),
  VerificationStart: obj({ id, state: { type: 'string', const: 'pending' }, provider_session_url: { type: 'string', format: 'uri' }, expires_at: time }),
  BlockInput: obj({ target_id: id }),
  ReportInput: obj({ target_type: enumStr(['user', 'message']), target_id: id, reason_code: str, details: str }, ['target_type', 'target_id', 'reason_code']),
  Report: obj({ id, state: { type: 'string', const: 'received' } }),
  DeviceInput: obj({ platform: enumStr(['ios', 'android']), push_token: { type: 'string', writeOnly: true } }),
  Device: obj({ id }),
  Job: obj({ id, state: enumStr(['queued', 'running', 'completed', 'failed']), created_at: time }),
  ConsentInput: obj({ purpose: { type: 'string', const: 'marketing' }, granted: bool }),
  Consent: obj({ purpose: { type: 'string', const: 'marketing' }, granted: bool, updated_at: time }),
  PolicyInput: obj({ terms_version: str, privacy_version: str }),
  DeleteInput: obj({ confirmation: { type: 'string', const: 'DELETE' } }),
};
schemas.PrivateProfile = obj({ user_id: id, version: { type: 'integer', minimum: 1 }, display_name: str, birth_date: nullable({ type: 'string', format: 'date' }), city: str, identity: nullable(str), intent: nullable(str), bio: str, height_cm: nullable({ type: 'number' }), ethnicity: nullable(str), show_height: bool, show_ethnicity: bool, sport_ids: arr(str), photos: { ...arr(ref('Photo')), maxItems: 6 }, weekly_frequency: nullable(str), onboarding_complete: bool, verification_state: enumStr(['none', 'pending', 'verified', 'rejected', 'expired']) });

const paths = {};
const parameter = (name, location, schema, required = false) => ({ name, in: location, required, schema });
const idem = parameter('Idempotency-Key', 'header', { type: 'string', minLength: 1, maxLength: 128 }, true);
const pagination = [parameter('cursor', 'query', str), parameter('limit', 'query', { type: 'integer', minimum: 1, maximum: 100, default: 20 })];
const content = schema => ({ 'application/json': { schema } });
function route(method, path, operationId, summary, { input, output, status = 200, publicRoute = false, parameters = [], idempotent = false, description = '', security } = {}) {
  const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map(m => parameter(m[1], 'path', id, true));
  const responses = { [status]: { description: status === 204 ? 'Completed; no body.' : 'Successful result.', ...(output ? { content: content(ref(output)) } : {}) } };
  for (const code of [400, 403, 404, 409, 422, 429, 503]) responses[code] = { $ref: `#/components/responses/Error${code}` };
  if (!publicRoute) responses[401] = { $ref: '#/components/responses/Error401' };
  const operation = { operationId, summary, description: `${description}\nDraft: inputs reject unknown fields. Resource authorization and current eligibility are rechecked, including retries. Private responses use Cache-Control: no-store. Cookie mutations require CSRF protection.`, responses, parameters: [...pathParameters, ...parameters, ...(idempotent ? [idem] : [])] };
  if (input) operation.requestBody = { required: true, content: content(ref(input)) };
  if (publicRoute) operation.security = [];
  if (security) operation.security = security;
  (paths[path] ??= {})[method] = operation;
}

route('get', '/sports', 'listSports', 'Read stable sport catalog', { output: 'Sports', publicRoute: true, parameters: [parameter('locale', 'query', str)] });
route('post', '/auth/register', 'register', 'Request email signup and verification', { input: 'Signup', output: 'Accepted', status: 202, publicRoute: true, description: 'Generic account-existence-safe response. Does not unlock discovery. Password/linking policy pending.' });
route('post', '/auth/email/verify', 'verifyEmail', 'Redeem a single-use email verification token', { input: 'TokenInput', output: 'Accepted', publicRoute: true });
route('post', '/auth/email/resend', 'resendEmail', 'Request verification mail', { input: 'EmailInput', output: 'Accepted', status: 202, publicRoute: true, description: 'Generic response and rate limiting; do not disclose email ownership.' });
route('post', '/auth/password/reset/request', 'requestPasswordReset', 'Request reset mail', { input: 'EmailInput', output: 'Accepted', status: 202, publicRoute: true });
route('post', '/auth/password/reset/complete', 'completePasswordReset', 'Consume token and replace password', { input: 'ResetPassword', output: 'Accepted', publicRoute: true });
route('post', '/auth/login', 'loginWeb', 'Login with a web session cookie', { input: 'Credentials', output: 'Authenticated', publicRoute: true, description: 'Existing path preserved. Set secure HttpOnly cookie. No native refresh credential in response.' });
route('post', '/auth/oauth/challenge', 'createOAuthChallenge', 'Create server-bound single-use provider nonce challenge', { input: 'OAuthChallengeInput', output: 'OAuthChallenge', publicRoute: true });
route('post', '/auth/oauth/exchange', 'exchangeOAuthWeb', 'Verify provider credential and create web session', { input: 'OAuthInput', output: 'Authenticated', publicRoute: true, description: 'Verify signature, audience, issuer, expiry, nonce and challenge client type; no email-string-only account merging.' });
route('post', '/auth/native/login', 'loginNative', 'Login for iOS/Android secure credential storage', { input: 'Credentials', output: 'NativeCredentials', publicRoute: true });
route('post', '/auth/native/oauth/exchange', 'exchangeOAuthNative', 'Exchange provider credential for native session', { input: 'OAuthInput', output: 'NativeCredentials', publicRoute: true });
route('post', '/auth/native/refresh', 'refreshNative', 'Rotate native refresh credential', { input: 'NativeRefresh', output: 'NativeCredentials', publicRoute: true, description: 'Body credential authenticates this operation. Rotation/reuse detection and concurrent-refresh policy must be finalized.' });
route('post', '/auth/refresh', 'refreshWeb', 'Renew web cookie session', { output: 'Authenticated', security: [{ cookieSession: [] }], description: 'Authenticate renewable server session cookie; enforce CSRF. No bearer/refresh JSON input.' });
route('get', '/auth/session', 'getSession', 'Verify current session', { output: 'SessionInfo', description: 'Preserve authenticated:true exactly. Onboarding/verification status does not itself unlock UI; GET /me/profile loads canonical state.' });
route('post', '/auth/logout', 'logout', 'Revoke current server session', { status: 204 });
route('post', '/auth/logout-all', 'logoutAll', 'Revoke all account sessions', { status: 204 });
route('get', '/me/profile', 'getOwnProfile', 'Read private profile and onboarding state', { output: 'PrivateProfile' });
route('patch', '/me/profile', 'patchOwnProfile', 'Update allowlisted fields with version check', { input: 'ProfilePatch', output: 'PrivateProfile', description: 'version is required; stale updates return 409. DOB becomes protected after verified completion; correction requires approved support flow. No verified/author/actor input.' });
route('get', '/me/preferences', 'getPreferences', 'Read own discovery preferences', { output: 'Preferences' });
route('put', '/me/preferences', 'putPreferences', 'Update preferences with version check', { input: 'Preferences', output: 'Preferences' });
route('put', '/me/policy-acceptance', 'acceptPolicies', 'Record current accepted policy versions', { input: 'PolicyInput', output: 'Accepted' });
route('post', '/auth/onboarding/complete', 'completeOnboarding', 'Complete saved onboarding after authoritative checks', { output: 'Authenticated', description: 'Existing body-free path preserved. Require adult DOB, approved required fields, ready owned photo, email and selfie verification. Pending profile rules need review.' });
route('get', '/profiles/{user_id}', 'getPublicProfile', 'Read profile in authorized discovery/match context', { output: 'PublicProfile', description: 'Unknown/inaccessible IDs have identical 404 shape; omit hidden fields instead of null placeholders.' });
route('post', '/me/media-uploads', 'createMediaUpload', 'Create owned expiring profile-photo upload grant', { input: 'UploadInput', output: 'UploadGrant', status: 201, idempotent: true });
route('post', '/me/media/{media_id}/complete', 'completeMediaUpload', 'Validate uploaded object and queue processing', { output: 'Media', status: 202, idempotent: true, description: 'Ownership, expiry, actual bytes, count, MIME/decoding and metadata checks. Completion does not declare processing successful.' });
route('get', '/me/media/{media_id}', 'getOwnMedia', 'Read owned processing state', { output: 'Media' });
route('delete', '/me/media/{media_id}', 'deleteOwnMedia', 'Remove owned eligible media reference safely', { status: 204, description: 'Deletion policy must preserve profile eligibility or restrict visibility; references and cleanup are transactional.' });
route('post', '/me/verification/sessions', 'startVerification', 'Start trusted selfie provider session', { output: 'VerificationStart', status: 201, idempotent: true });
route('get', '/me/verification', 'getVerification', 'Read authoritative selfie state', { output: 'Verification' });
route('get', '/discover', 'discover', 'Read eligible candidates inside requested filters', { output: 'Discovery', parameters: [...pagination, parameter('distance_km', 'query', { type: 'number', exclusiveMinimum: 0 }, true), ...['sport_id', 'goal', 'schedule'].map(n => parameter(n, 'query', str))], description: 'Both caller and candidates must be eligible verified adults. Never expand radius automatically. Filter-scoped signed cursor; recheck visibility each page. Source/precision of private location pending.' });
route('post', '/discover/decisions', 'createDiscoveryDecision', 'Record Like/Pass and create match only for reciprocal Likes', { input: 'DecisionInput', output: 'DecisionResult', idempotent: true, description: 'Lock canonical pair, quota bucket and current eligibility; unique match/conversation/outbox commit. quota values are nullable until approved policy exists; service implementation must finalize policy.' });
route('get', '/me/matches', 'listMatches', 'List active genuine matches', { output: 'Matches', parameters: pagination });
route('delete', '/matches/{match_id}', 'unmatch', 'End own match and prevent new chat writes', { status: 204 });
route('get', '/me/conversations', 'listConversations', 'List authorized active conversations', { output: 'Conversations', parameters: pagination });
route('get', '/conversations/{conversation_id}/messages', 'listMessages', 'Read authorized message history or incremental catch-up', { output: 'Messages', parameters: [...pagination, parameter('after_sequence', 'query', integer)], description: 'History newest page, older cursor; after_sequence catch-up ascending. Do not combine cursor and after_sequence. Continued catch-up cursor retains mode and boundary. Historical access after unmatch/block awaits policy.' });
route('post', '/conversations/{conversation_id}/messages', 'sendMessage', 'Persist a member message independently of live transport', { input: 'MessageInput', output: 'Message', status: 201, description: 'client_message_id is mandatory dedupe key; same key/different text conflicts. Repeat result remains permission-gated. Commit sequence/message/outbox atomically.' });
route('put', '/conversations/{conversation_id}/read', 'markRead', 'Advance monotonic read cursor', { input: 'ReadInput', output: 'ReadState' });
route('post', '/me/blocks', 'blockUser', 'Block a user and revoke pair access', { input: 'BlockInput', output: 'Accepted', idempotent: true });
route('delete', '/me/blocks/{user_id}', 'unblockUser', 'Remove own directional block without restoring an ended match', { status: 204 });
route('post', '/reports', 'report', 'Submit authorized user/message report', { input: 'ReportInput', output: 'Report', status: 201, idempotent: true });
route('put', '/me/devices', 'bindDevice', 'Bind push token to current account/session', { input: 'DeviceInput', output: 'Device', description: 'Atomically invalidate previous owner binding. Never trust a client-supplied account ID.' });
route('delete', '/me/devices/{device_id}', 'unbindDevice', 'Unregister owned device token', { status: 204 });
route('put', '/me/consents', 'setConsent', 'Grant or withdraw marketing consent', { input: 'ConsentInput', output: 'Consent' });
route('post', '/me/data-exports', 'requestDataExport', 'Queue own data export', { output: 'Job', status: 202, idempotent: true });
route('post', '/me/deletion', 'deleteAccount', 'Immediately deactivate and revoke sessions; queue cleanup', { input: 'DeleteInput', output: 'Job', status: 202, idempotent: true, description: 'Explicit confirmation and recent authentication required; recent-auth challenge design pending. Ordinary sessions become invalid. Restricted job status/download authorization will be designed separately.' });

const responses = {};
for (const [code, description] of Object.entries({ 400: 'Malformed request.', 401: 'Missing, invalid or expired credentials.', 403: 'Eligibility or role denies this action.', 404: 'Resource missing or inaccessible; no private existence disclosure.', 409: 'Version, idempotency or state conflict.', 422: 'Semantic validation failed.', 429: 'Rate limit exceeded.', 503: 'Temporary infrastructure/provider failure; safe retry according to operation.' })) {
  responses[`Error${code}`] = { description, content: content(ref('Error')), ...(code === '429' ? { headers: { 'Retry-After': { schema: { type: 'string' }, description: 'HTTP retry delay or date.' } } } : {}) };
}
const draft = {
  openapi: '3.1.0',
  info: { title: 'PACE free-core API — review draft', version: '0.1.0-draft', description: 'Contract design only, 2026-10-11. No service exists. iOS+Android; age 18+ and trusted selfie verification before visibility/Like/chat. Proposed session and technical limits need review. Deferred billing/feed/activities/invitations omitted. Companion PACE_BACKEND_DESIGN.md defines transactions, eligibility and open decisions.' },
  servers: [{ url: '/api/v1', description: 'Relative contract base; not a deployed endpoint.' }],
  security: [{ cookieSession: [] }, { bearerSession: [] }],
  paths,
  components: { schemas, responses, securitySchemes: { cookieSession: { type: 'apiKey', in: 'cookie', name: 'pace_session', description: 'Proposed name. Secure HttpOnly session; CSRF enforcement mandatory on cookie mutations.' }, bearerSession: { type: 'http', scheme: 'bearer', description: 'Native short-lived access credential; no URL tokens.' } } },
  'x-draft-omissions': ['Provider-signed verification webhook contract', 'Moderator API/role schemas', 'Private location update consent/source contract', 'Export/deletion restricted job status and download authorization', 'Notification preference API', 'Realtime connection/event schema and authorization', 'Recent-authentication challenge', 'Final native refresh concurrency and credential lifetime rules'],
};
const output = resolve('docs/PACE_CORE_API_DRAFT.json');
mkdirSync(resolve('docs'), { recursive: true });
writeFileSync(output, JSON.stringify(draft, null, 2) + '\n');
console.log(`Wrote ${Object.keys(paths).length} paths, ${Object.values(paths).reduce((n, p) => n + Object.keys(p).length, 0)} operations and ${Object.keys(schemas).length} schemas.`);
