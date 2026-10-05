const DEFAULT_FOCUS = Object.freeze({ x: 50, y: 24 });

function clampPercent(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : fallback;
}

export function withDefaultPhotoFocus(photo) {
  return {
    ...photo,
    focus: {
      x: clampPercent(photo?.focus?.x, DEFAULT_FOCUS.x),
      y: clampPercent(photo?.focus?.y, DEFAULT_FOCUS.y),
    },
  };
}

export function photoFocusStyle(photo) {
  const focusedPhoto = withDefaultPhotoFocus(photo);
  return `object-position:${focusedPhoto.focus.x}% ${focusedPhoto.focus.y}%`;
}
