import assert from "node:assert/strict";
import { photoFocusStyle, withDefaultPhotoFocus } from "./features/photo_presentation.mjs";

const defaultPhoto = withDefaultPhotoFocus({ id: "photo_1", url: "/photo.jpg" });
assert.deepEqual(defaultPhoto.focus, { x: 50, y: 24 });
assert.equal(photoFocusStyle(defaultPhoto), "object-position:50% 24%");

const focusedPhoto = withDefaultPhotoFocus({ id: "photo_2", focus: { x: 62, y: 31 } });
assert.deepEqual(focusedPhoto.focus, { x: 62, y: 31 });

const boundedPhoto = withDefaultPhotoFocus({ id: "photo_3", focus: { x: 140, y: -12 } });
assert.deepEqual(boundedPhoto.focus, { x: 100, y: 0 });

console.log("\n3/3 photo presentation tests passed");
