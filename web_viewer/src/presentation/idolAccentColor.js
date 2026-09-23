// The archive dictionary stores six-digit sRGB hex; do not pass arbitrary CSS into a style token.
export function normalizeIdolAccentColor(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : ''
}
