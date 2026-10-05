import assert from "node:assert/strict";
import { createOnboarding } from "./features/onboarding.mjs";

const tests = [];
const test = (name, run) => tests.push([name, run]);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

// Only the DOM/timer boundary is doubled. Production startup and logout run intact.
function element() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    innerHTML: "", textContent: "", dataset: {}, scrollTop: 0,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force = !classes.has(name)) { if (force) classes.add(name); else classes.delete(name); },
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    querySelector() { return null; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    clickAction(action) { listeners.get("click")?.({ target: { closest: () => ({ dataset: { action } }) } }); },
  };
}

function fixture({ reducedMotion = false, ...callbacks } = {}) {
  const original = { window: globalThis.window, document: globalThis.document, now: Date.now };
  const stage = element();
  const root = element();
  const app = element();
  const nodes = { "#onboarding-stage": stage, "#onboarding-back": element(), "#onboarding-progress": element() };
  root.querySelector = (selector) => nodes[selector] ?? null;
  const timers = new Map();
  let time = 0;
  let id = 0;
  let authenticated = 0;
  const schedule = (callback, delay) => { const key = ++id; timers.set(key, { callback, at: time + delay }); return key; };
  globalThis.window = {
    setTimeout: schedule, clearTimeout: (key) => timers.delete(key),
    requestAnimationFrame: (callback) => schedule(callback, 16),
    matchMedia: () => ({ matches: reducedMotion }),
  };
  globalThis.document = { body: element(), querySelector: () => null };
  Date.now = () => time;
  const flow = createOnboarding({ onboardingRoot: root, appShell: app, onAuthenticated: async () => { authenticated += 1; }, ...callbacks });
  return {
    flow, root, stage, app, authenticated: () => authenticated,
    async tick(ms) {
      const end = time + ms;
      await settle();
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        time = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await settle();
      }
      time = end;
      await settle();
    },
    blocked() {
      assert.equal(app.getAttribute("inert"), "");
      assert.equal(app.getAttribute("aria-hidden"), "true");
      assert.equal(root.getAttribute("aria-hidden"), "false");
    },
    ready() {
      assert.equal(app.getAttribute("inert"), null);
      assert.equal(app.getAttribute("aria-hidden"), "false");
      assert.equal(root.getAttribute("aria-hidden"), "true");
    },
    dispose() {
      Date.now = original.now;
      for (const key of ["window", "document"]) {
        if (original[key] === undefined) delete globalThis[key];
        else globalThis[key] = original[key];
      }
    },
  };
}

test("startup stays behind a branded status until both session and member data resolve", async () => {
  const session = deferred();
  const data = deferred();
  let loads = 0;
  const f = fixture({ restoreSession: () => session.promise, onAuthenticated: () => { loads += 1; return data.promise; } });
  try {
    const starting = f.flow.start();
    assert.match(f.stage.innerHTML, /role="status" aria-label="Opening PACE"/);
    assert.doesNotMatch(f.stage.innerHTML, /data-onboarding-form="login"|MEET SOMEONE/);
    await f.tick(10000);
    f.blocked();
    assert.equal(loads, 0);
    session.resolve({ authenticated: true });
    await f.tick(10000);
    f.blocked();
    assert.equal(loads, 1);
    data.resolve();
    await starting;
    await f.tick(2000);
    f.ready();
  } finally { f.dispose(); }
});

test("no session shows welcome without loading member data", async () => {
  const f = fixture({ restoreSession: async () => null });
  try {
    await f.flow.start();
    await f.tick(10000);
    assert.match(f.stage.innerHTML, /<h1>MEET SOMEONE/);
    assert.doesNotMatch(f.stage.innerHTML, /role="status"/);
    assert.equal(f.authenticated(), 0);
    f.blocked();
  } finally { f.dispose(); }
});

test("network failure and failed retry keep access locked; successful retry opens the app", async () => {
  let requests = 0;
  const f = fixture({ restoreSession: async () => {
    requests += 1;
    if (requests < 3) throw new TypeError("Network unavailable");
    return { authenticated: true };
  } });
  try {
    await f.flow.start();
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await f.tick(10000);
      assert.match(f.stage.innerHTML, /role="alert"/);
      assert.match(f.stage.innerHTML, /data-action="retry-session"/);
      f.blocked();
      assert.equal(requests, attempt);
      assert.equal(f.authenticated(), 0);
      f.root.clickAction("retry-session");
      await settle();
    }
    await f.tick(2000);
    f.ready();
    assert.equal(requests, 3);
    assert.equal(f.authenticated(), 1);
  } finally { f.dispose(); }
});

test("critical visuals finish before a restored session reveals the app", async () => {
  const visuals = deferred();
  const f = fixture({ restoreSession: async () => ({ authenticated: true }), prepareVisuals: () => visuals.promise });
  try {
    const starting = f.flow.start();
    await f.tick(10000);
    f.blocked();
    assert.equal(f.authenticated(), 1);
    assert.equal(f.app.classList.contains("launch-ready"), false);
    visuals.resolve();
    await starting;
    await f.tick(2000);
    f.ready();
  } finally { f.dispose(); }
});

for (const pendingPhase of ["session", "member data", "critical visuals"]) {
  test(`logout prevents a stale ${pendingPhase} response from reopening the app`, async () => {
    const pending = deferred();
    let signouts = 0;
    const f = fixture({
      restoreSession: () => pendingPhase === "session" ? pending.promise : Promise.resolve({ authenticated: true }),
      ...(pendingPhase === "member data" ? { onAuthenticated: () => pending.promise } : {}),
      ...(pendingPhase === "critical visuals" ? { prepareVisuals: () => pending.promise } : {}),
      signOut: async () => { signouts += 1; },
    });
    try {
      const starting = f.flow.start();
      await settle();
      await f.flow.logout();
      pending.resolve({ authenticated: true });
      await starting;
      await f.tick(10000);
      f.blocked();
      assert.match(f.stage.innerHTML, /data-onboarding-form="login"/);
      assert.equal(signouts, 1);
    } finally { f.dispose(); }
  });
}

test("reduced motion preserves the loading gate and completes a short reveal", async () => {
  const session = deferred();
  const f = fixture({ reducedMotion: true, restoreSession: () => session.promise });
  try {
    const starting = f.flow.start();
    await f.tick(10000);
    f.blocked();
    session.resolve({ authenticated: true });
    await starting;
    await f.tick(500);
    f.ready();
    assert.equal(f.authenticated(), 1);
  } finally { f.dispose(); }
});

for (const [name, run] of tests) {
  await run();
  console.log(`✓ ${name}`);
}
console.log(`\n${tests.length}/${tests.length} onboarding startup tests passed`);
