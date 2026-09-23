/**
 * Deployment transform policy for the private R2 Preview.
 *
 * Runtime URLs are a frozen contract: Story JSON, Spine `.atlas` files and the
 * asset resolvers keep requesting `.png`. Only the physical R2 object may differ,
 * so the same pure policy must drive both the local exporter and the Pages
 * Function. Nothing here may touch the filesystem, Node built-ins or the DOM.
 */

// The whole PNG corpus is converted. `assets/brand/` is the single documented
// exception: it stays a real PNG so `verify-preview-http` keeps a control probe
// proving that an untransformed PNG request still serves PNG bytes. Expressed as
// an exclusion list rather than an allowlist because the intent is "all of it,
// with one named exception" -- an allowlist would silently skip any resource
// family added later.
export const PREVIEW_WEBP_EXCLUDED_PREFIXES = Object.freeze([
  'assets/brand/',
])

export const COPY_TRANSFORM = 'copy'
export const LOSSLESS_WEBP_TRANSFORM = 'webp-lossless-alpha0-rgb0'

const PNG_EXTENSION = /\.png$/i

export function isPreviewLosslessWebpCandidate(requestKey) {
  if (typeof requestKey !== 'string' || !PNG_EXTENSION.test(requestKey)) return false
  return !PREVIEW_WEBP_EXCLUDED_PREFIXES.some(prefix => requestKey.startsWith(prefix))
}

/** Logical request key -> physical R2 object key. Identity when not transformed. */
export function resolvePreviewObjectKey(requestKey) {
  return isPreviewLosslessWebpCandidate(requestKey)
    ? requestKey.replace(PNG_EXTENSION, '.webp')
    : requestKey
}

export function previewTransformKind(requestKey) {
  return isPreviewLosslessWebpCandidate(requestKey) ? LOSSLESS_WEBP_TRANSFORM : COPY_TRANSFORM
}
