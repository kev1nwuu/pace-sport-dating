const IMAGE_PATHS = ["assets/onboarding-charcoal-texture.jpg", "assets/maya-profile-01.jpg"];
const FONTS = ['400 16px Manrope', '800 16px Manrope', '400 16px "Archivo Black"', '500 16px "DM Mono"'];

export function createLaunchAssetPreparer({
  document = globalThis.document,
  Image = globalThis.Image,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  let preparation;

  async function prepareImage(path) {
    if (!Image) return;
    const image = new Image();
    const loaded = new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
    image.src = new URL(path, document?.baseURI || new URL("../", import.meta.url)).href;
    if (typeof image.decode === "function") await image.decode();
    else await loaded;
  }

  return function prepareLaunchAssets() {
    if (preparation) return preparation;
    preparation = new Promise((resolve) => {
      let finished = false;
      let deadline;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        resolve();
      };
      deadline = setTimeout(finish, 1200);
      const tasks = [
        ...IMAGE_PATHS.map((path) => prepareImage(path)),
        ...FONTS.map((font) => Promise.resolve().then(() => document?.fonts?.load(font))),
      ];
      Promise.allSettled(tasks).then(finish);
    });
    return preparation;
  };
}
