import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const api = JSON.parse(readFileSync('docs/PACE_CORE_API_DRAFT.json', 'utf8'));
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
const resolveRef = pointer => pointer.slice(2).split('/').reduce((value, key) => value?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], api);
check('JSON parses and draft declares OpenAPI 3.1.0.', () => assert.equal(api.openapi, '3.1.0'));
check('Every local reference resolves.', () => {
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) { assert.ok(value.$ref.startsWith('#/')); assert.ok(resolveRef(value.$ref), value.$ref); }
    Object.values(value).forEach(walk);
  }
  walk(api);
});
check('Operation IDs are unique and all path parameters are required and declared.', () => {
  const ids = new Set();
  for (const [path, methods] of Object.entries(api.paths)) for (const [method, operation] of Object.entries(methods)) {
    assert.ok(['get', 'post', 'patch', 'put', 'delete'].includes(method));
    assert.ok(!ids.has(operation.operationId)); ids.add(operation.operationId);
    assert.ok(operation.responses && Object.keys(operation.responses).some(code => code.startsWith('2')));
    for (const match of path.matchAll(/\{([^}]+)\}/g)) assert.ok(operation.parameters.some(p => p.in === 'path' && p.name === match[1] && p.required));
  }
});
check('Object schemas have closed fields and required fields exist.', () => {
  for (const [name, schema] of Object.entries(api.components.schemas)) if (schema.type === 'object') {
    assert.ok(schema.properties, name);
    assert.equal(schema.additionalProperties, false, name);
    for (const field of schema.required ?? []) assert.ok(field in schema.properties, `${name}.${field}`);
  }
});
check('Public profiles exclude private and authentication fields.', () => {
  const fields = api.components.schemas.PublicProfile.properties;
  for (const name of ['birth_date', 'email', 'password', 'private_coordinates', 'refresh_token', 'show_height', 'show_ethnicity']) assert.ok(!(name in fields));
  assert.ok(!api.components.schemas.PublicProfile.required.includes('height_cm'));
  assert.ok(!api.components.schemas.PublicProfile.required.includes('ethnicity'));
  assert.equal(fields.age.minimum, 18);
  assert.equal(fields.verified.const, true);
});
check('Existing body-free completion/session/login/logout paths are retained.', () => {
  assert.ok(api.paths['/auth/login'].post);
  assert.ok(api.paths['/auth/session'].get);
  assert.ok(api.paths['/auth/logout'].post);
  assert.ok(!api.paths['/auth/onboarding/complete'].post.requestBody);
  assert.equal(api.components.schemas.Authenticated.properties.authenticated.const, true);
});
check('Photo binding remains capped at six and client cannot assign verification.', () => {
  const fields = api.components.schemas.ProfilePatch.properties;
  assert.equal(fields.photos.maxItems, 6);
  assert.ok(!('verified' in fields));
  assert.ok(api.components.schemas.ProfilePatch.required.includes('version'));
});
check('Messages require caller-scoped retry identity and decisions require idempotency.', () => {
  assert.ok(api.components.schemas.MessageInput.required.includes('client_message_id'));
  assert.ok(api.paths['/discover/decisions'].post.parameters.some(p => p.name === 'Idempotency-Key' && p.required));
});
check('Deferred feature routes are absent.', () => {
  assert.ok(Object.keys(api.paths).every(path => !/(billing|membership|activities|invitations|connections\/feed)/.test(path)));
});
check('All declared security schemes resolve.', () => {
  for (const methods of Object.values(api.paths)) for (const operation of Object.values(methods)) for (const security of operation.security ?? api.security) for (const scheme of Object.keys(security)) assert.ok(api.components.securitySchemes[scheme]);
});
console.log(`${checks.length} structural/consistency checks passed. Full OpenAPI validation and runtime integration remain unverified.`);
