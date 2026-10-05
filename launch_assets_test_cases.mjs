import assert from "node:assert/strict";
import { createLaunchAssetPreparer } from "./features/launch_assets.mjs";

const tests = [];
const test = (name, run) => tests.push([name, run]);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

function fixture({ decode = true, failConstruction = false, failFonts = false } = {}) {
  const images = [];
  const fonts = [];
  const timers = new Map();
  const cleared = [];
  const prepare = createLaunchAssetPreparer({
    document: { baseURI: "https://pace.test/app/index.html", fonts: { load(font) {
      if (failFonts) throw new Error("Fonts unavailable");
      const pending = deferred();
      fonts.push({ font, ...pending });
      return pending.promise;
    } } },
    Image: class {
      constructor() {
        if (failConstruction) throw new Error("Images unavailable");
        const pending = deferred();
        if (decode) this.decode = () => pending.promise;
        images.push({ image: this, ...pending });
      }
    },
    setTimeout(callback, delay) { timers.set(1, { callback, delay }); return 1; },
    clearTimeout(id) { cleared.push(id); timers.delete(id); },
  });
  return { prepare, images, fonts, timers, cleared };
}

test("entry waits for both critical images to decode and all four fonts", async () => {
  const f = fixture();
  let ready = false;
  const pending = f.prepare().then(() => { ready = true; });
  await settle();
  assert.deepEqual(f.images.map(({ image }) => image.src), [
    "https://pace.test/app/assets/onboarding-charcoal-texture.jpg",
    "https://pace.test/app/assets/maya-profile-01.jpg",
  ]);
  assert.deepEqual(f.fonts.map(({ font }) => font), [
    '400 16px Manrope', '800 16px Manrope', '400 16px "Archivo Black"', '500 16px "DM Mono"',
  ]);
  f.images.forEach(({ image }) => image.onload());
  f.fonts.forEach(({ resolve }) => resolve([]));
  f.images[0].resolve();
  await settle();
  assert.equal(ready, false, "a downloaded but not decoded hero must still be awaited");
  f.images[1].resolve();
  await pending;
  assert.equal(ready, true);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.cleared, [1]);
});

test("repeated starts share one preparation before and after completion", async () => {
  const f = fixture();
  const first = f.prepare();
  assert.equal(f.prepare(), first);
  await settle();
  assert.equal(f.images.length, 2);
  assert.equal(f.fonts.length, 4);
  [...f.images, ...f.fonts].forEach(({ resolve }) => resolve());
  await first;
  assert.equal(f.prepare(), first);
});

test("image and font failures never reject or block entry", async () => {
  const f = fixture();
  const pending = f.prepare();
  await settle();
  [...f.images, ...f.fonts].forEach(({ reject }) => reject(new Error("Offline")));
  await pending;
  assert.equal(f.timers.size, 0);
  const throwing = fixture({ failConstruction: true, failFonts: true });
  await throwing.prepare();
  assert.equal(throwing.timers.size, 0);
});

test("hung resources release entry at the 1200 ms deadline and late rejection is harmless", async () => {
  const f = fixture();
  let ready = false;
  const pending = f.prepare().then(() => { ready = true; });
  await settle();
  assert.equal(ready, false);
  const timer = f.timers.get(1);
  assert.equal(timer.delay, 1200);
  timer.callback();
  await pending;
  assert.equal(ready, true);
  [...f.images, ...f.fonts].forEach(({ reject }) => reject(new Error("Late failure")));
  await settle();
  assert.deepEqual(f.cleared, [1]);
});

test("browsers without decode fall back to image load or error", async () => {
  const f = fixture({ decode: false });
  let ready = false;
  const pending = f.prepare().then(() => { ready = true; });
  await settle();
  f.fonts.forEach(({ resolve }) => resolve());
  f.images[0].image.onload();
  await settle();
  assert.equal(ready, false);
  f.images[1].image.onerror();
  await pending;
  assert.equal(ready, true);
});

for (const [name, run] of tests) {
  await run();
  console.log(`✓ ${name}`);
}
console.log(`\n${tests.length}/${tests.length} launch asset tests passed`);
